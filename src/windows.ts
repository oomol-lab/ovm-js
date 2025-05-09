import cp from "node:child_process";
import type { EventReceiver } from "remitter";
import { Remitter } from "remitter";
import type {
    OVMWindowsInitEvent,
    OVMWindowsOptions,
    OVMWindowsRunEvent,
    OVMWindowsRunEventValueType,
    OVMWindowsInitEventValueType,
} from "./type";
import { OVMWindowsInitEventValue, OVMWindowsRunEventValue } from "./type";
import { Restful } from "./event_restful";
import { RequestWindows } from "./request";
import { enableDebug, resource } from "./utils";

export class WindowsOVM extends RequestWindows {
    public readonly events: {
        init: EventReceiver<OVMWindowsInitEvent>;
        run: EventReceiver<OVMWindowsRunEvent>;
    };
    readonly #events: {
        init: Remitter<OVMWindowsInitEvent>;
        run: Remitter<OVMWindowsRunEvent>;
    };
    private restful: Record<"run" | "init", Restful>;
    private readonly restfulNPipeRunName: string;
    private readonly restfulNPipePrepareName: string;

    private constructor(private options: OVMWindowsOptions) {
        super(options.name);
        this.restfulNPipeRunName = `ovm-${options.name}-restful`;
        this.restfulNPipePrepareName = `ovm-prepare-${options.name}-restful`;

        this.events = this.#events = {
            init: new Remitter(),
            run: new Remitter(),
        };
    }

    public static create(options: OVMWindowsOptions): WindowsOVM {
        const ovm = new WindowsOVM(options);
        ovm.initEventRestful();
        return ovm;
    }

    private initEventRestful(): void {
        this.restful = {
            run: new Restful(),
            init: new Restful(),
        };

        this.#events.init.remitAny((o) => {
            return this.restful.init.events.onAny((data) => {
                o.emit(data.event as OVMWindowsInitEventValueType, data.data);
            });
        });

        this.#events.run.remitAny((o) => {
            return this.restful.run.events.onAny((data) => {
                o.emit(data.event as OVMWindowsRunEventValueType, data.data);
            });
        });

        this.restful.run.start(`//./pipe/${this.restfulNPipeRunName}`);
        this.restful.init.start(`//./pipe/${this.restfulNPipePrepareName}`);
    }

    public init(): void {
        const initTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 30 * 1000);

            const disposer = this.#events.init.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        this.#events.init.once(OVMWindowsInitEventValue.Exit, async () => {
            await this.restful.init.stop();
        });

        const ovmBin = resource("ovm", this.options.resource);
        const ovmArgs = [
            "init",
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-event-npipe-name", this.restfulNPipePrepareName,
            "-bind-pid", String(process.pid),
        ];

        if (enableDebug()) {
            console.log(`[OVM] executing: ${ovmBin} ${ovmArgs.join(" ")}`);
            console.log(`[OVM] cwd: ${this.options.cwd}`);
        }

        const ovm = cp.spawn(ovmBin, ovmArgs, {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.imageDir,
        });

        ovm.unref();

        initTimeout
            .catch(() => {
                this.#events.init.emit(OVMWindowsInitEventValue.Error, {
                    value: "OVM prepare timeout",
                });
                this.#events.init.emit(OVMWindowsInitEventValue.Exit, {});
            });
    }

    public run(): void {
        const versions = Object.keys(this.options.versions).map((key) => {
            return `${key}=${this.options.versions[key]}`;
        }).join(",");

        const runTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 30 * 1000);

            const disposer = this.#events.run.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        this.#events.run.once(OVMWindowsRunEventValue.Exit, async () => {
            await this.restful.run.stop();
        });

        const ovmBin = resource("ovm", this.options.resource);
        const ovmArgs = [
            "run",
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-image-dir", this.options.imageDir,
            "-rootfs-path", resource("rootfs", this.options.resource),
            "-versions", versions,
            "-event-npipe-name", this.restfulNPipeRunName,
            "-bind-pid", String(this.options.bindPID || process.pid),
        ];

        if (enableDebug()) {
            console.log(`[OVM] executing: ${ovmBin} ${ovmArgs.join(" ")}`);
            console.log(`[OVM] cwd: ${this.options.cwd}`);
        }

        const ovm = cp.spawn(ovmBin, ovmArgs, {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.cwd,
        });

        ovm.unref();

        runTimeout
            .catch(() => {
                this.#events.run.emit(OVMWindowsRunEventValue.Error, {
                    value: "OVM run timeout",
                });
                this.#events.run.emit(OVMWindowsRunEventValue.Exit, {});
            });
    }

    public migrate(oldImageDir: string, newImageDir: string): Promise<void> {
        const ovmBin = resource("ovm", this.options.resource);
        const ovmArgs = [
            "migrate",
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-old-image-dir", oldImageDir,
            "-new-image-dir", newImageDir,
        ];

        if (enableDebug()) {
            console.log(`[OVM] executing: ${ovmBin} ${ovmArgs.join(" ")}`);
            console.log(`[OVM] cwd: ${this.options.cwd}`);
        }

        const ovm = cp.spawn(ovmBin, ovmArgs, {
            timeout: 0,
            windowsHide: true,
            detached: false,
            stdio: "ignore",
            cwd: this.options.cwd,
        });

        return new Promise((resolve, reject) => {
            ovm.once("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error("OVM migrate failed"));
                }
            });
        });
    }

    public override async stop(): Promise<void> {
        const p = new Promise<void>((r) => {
            this.#events.run.once(OVMWindowsRunEventValue.Exit, () => {
                r();
            });
        });

        await super.stop();
        await p;
    }
}
