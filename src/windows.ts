import cp from "node:child_process";
import type { EventReceiver } from "remitter";
import { Remitter } from "remitter";
import type { OVMWindowsEventData, OVMWindowsOptions } from "./type";
import { Restful } from "./event_restful";
import { RequestWindows } from "./request";

export class WindowsOVM extends RequestWindows {
    public readonly events : EventReceiver<OVMWindowsEventData>;
    readonly #events: Remitter<OVMWindowsEventData>;
    private restful: Restful;
    private readonly restfulNPipeName: string;

    private constructor(private options: OVMWindowsOptions) {
        super(options.name);
        this.restfulNPipeName = `ovm-${options.name}-restful`;
        this.events = this.#events = new Remitter();
    }

    public static create(options: OVMWindowsOptions): WindowsOVM {
        const ovm = new WindowsOVM(options);
        ovm.initEventRestful();
        return ovm;
    }

    private initEventRestful(): void {
        this.restful = new Restful();

        this.#events.remitAny((o) => {
            return this.restful.events.onAny((data) => {
                o.emit(data.event as keyof OVMWindowsEventData, data.data);
            });
        });

        this.restful.start(`//./pipe/${this.restfulNPipeName}`);
    }

    public start(): void {
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

        const ovm = cp.spawn(this.options.ovmPath, [
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-image-dir", this.options.imageDir,
            "-rootfs-path", this.options.linuxPath.rootfs,
            "-versions", versions,
            "-event-npipe-name", this.restfulNPipeName,
            "-bind-pid", String(process.pid),
        ], {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.imageDir,
        });

        ovm.unref();

        launchTimeout
            .catch(() => {
                this.#events.emit("error", "OVM start timeout");
            });
    }
}
