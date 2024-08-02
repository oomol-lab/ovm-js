import cp from "node:child_process";
import type { EventReceiver } from "remitter";
import { Remitter } from "remitter";
import type { OVMWindowsEventData, OVMWindowsOptions } from "./type";
import { Restful } from "./event_restful";
import { RequestWindows } from "./request";
import { resource } from "./utils";

export class WindowsOVM extends RequestWindows {
    public readonly events : EventReceiver<OVMWindowsEventData>;
    readonly #events: Remitter<OVMWindowsEventData>;
    private restful: Record<"run" | "prepare", Restful>;
    private readonly restfulNPipeRunName: string;
    private readonly restfulNPipePrepareName: string;

    private constructor(private options: OVMWindowsOptions) {
        super(options.name);
        this.restfulNPipeRunName = `ovm-${options.name}-restful`;
        this.restfulNPipePrepareName = `ovm-prepare-${options.name}-restful`;

        this.events = this.#events = new Remitter();
    }

    public static create(options: OVMWindowsOptions): WindowsOVM {
        const ovm = new WindowsOVM(options);
        ovm.initEventRestful();
        return ovm;
    }

    private initEventRestful(): void {
        this.restful = {
            run: new Restful(),
            prepare: new Restful(),
        };

        this.#events.remitAny((o) => {
            return this.restful.run.events.onAny((data) => {
                o.emit(data.event as keyof Omit<OVMWindowsEventData, "prepare">, data.data);
            });
        });

        this.#events.remitAny((o) => {
            return this.restful.prepare.events.onAny((data) => {
                o.emit(data.event as keyof Omit<OVMWindowsEventData, "run">, data.data);
            });
        });

        this.restful.run.start(`//./pipe/${this.restfulNPipeRunName}`);
        this.restful.prepare.start(`//./pipe/${this.restfulNPipePrepareName}`);
    }

    public prepare(): void {
        const prepareTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 30 * 1000);

            const disposer = this.#events.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        const ovm = cp.spawn(this.options.ovmPath || resource("ovm"), [
            "prepare",
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-event-npipe-name", this.restfulNPipePrepareName,
            "-bind-pid", String(process.pid),
        ], {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.imageDir,
        });

        ovm.unref();

        prepareTimeout
            .catch(() => {
                this.#events.emit("error", "OVM prepare timeout");
            });
    }

    public run(): void {
        const versions = Object.keys(this.options.versions).map((key) => {
            return `${key}=${this.options.versions[key]}`;
        }).join(",");

        const launchTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 30 * 1000);

            const disposer = this.#events.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        const ovm = cp.spawn(this.options.ovmPath || resource("ovm"), [
            "run",
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-image-dir", this.options.imageDir,
            "-rootfs-path", this.options.linuxPath?.rootfs || resource("rootfs"),
            "-versions", versions,
            "-event-npipe-name", this.restfulNPipeRunName,
            "-bind-pid", String(process.pid),
        ], {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.cwd,
        });

        ovm.unref();

        launchTimeout
            .catch(() => {
                this.#events.emit("error", "OVM run timeout");
            });
    }
}
