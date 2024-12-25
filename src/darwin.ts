import { RequestDarwin } from "./request";
import cp from "node:child_process";
import type { EventReceiver } from "remitter";
import { Remitter } from "remitter";
import type { OVMDarwinInitEvent, OVMDarwinOptions, OVMDarwinStartEvent } from "./type";
import { Restful } from "./event_restful";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { enableDebug, resource } from "./utils";

export class DarwinOVM extends RequestDarwin {
    public readonly events: {
        init: EventReceiver<OVMDarwinInitEvent>;
        start: EventReceiver<OVMDarwinStartEvent>;
    };
    readonly #events: {
        init: Remitter<OVMDarwinInitEvent>;
        start: Remitter<OVMDarwinStartEvent>;
    };

    private restful: Record<"init" | "start", Restful>;
    private restfulWithInit: string;
    private restfulWithStart: string;

    private constructor(private options: OVMDarwinOptions) {
        super(options.workspace);
        this.events = this.#events = {
            init: new Remitter(),
            start: new Remitter(),
        };
    }

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        await fs.mkdir(options.workspace, {
            recursive: true,
        });
        const ovm = new DarwinOVM(options);
        await Promise.all([
            ovm.initEventRestful(),
        ]);
        return ovm;
    }

    private async initEventRestful(): Promise<void> {
        this.restful = {
            init: new Restful(),
            start: new Restful(),
        };

        this.#events.init.remitAny((o) => {
            return this.restful.init.events.onAny((data) => {
                o.emit(data.event as keyof OVMDarwinInitEvent, data.data);
            });
        });

        this.#events.start.remitAny((o) => {
            return this.restful.start.events.onAny((data) => {
                o.emit(data.event as keyof OVMDarwinStartEvent, data.data);
            });
        });

        const dir = await fs.mkdtemp(path.join(tmpdir(), "ovm-"));
        this.restfulWithInit = path.join(dir, "event-restful-init.sock");
        this.restfulWithStart = path.join(dir, "event-restful-start.sock");

        this.restful.init.start(this.restfulWithInit);
        this.restful.start.start(this.restfulWithStart);
    }

    public init(): void {
        const initTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 10 * 1000);

            const disposer = this.#events.init.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        const ovmBin = resource("ovm", this.options.resource);
        const ovmArgs = [
            "machine",
            "init",
            "--cpus", String(this.options.cpu),
            "--memory", String(this.options.memory),
            "--boot", resource("image", this.options.resource),
            "--boot-version", this.options.versions.image,
            "--data-version", this.options.versions.data,
            "--report-url", `unix://${this.restfulWithInit}`,
            "--workspace", this.options.workspace,
            "--ppid", String(this.options.bindPID),
            "--volume", "/Users:/Users",
            "default",
        ];

        for (const item of this.options.appendVolume || []) {
            ovmArgs.push("--volume", `${item}:${item}`);
        }

        if (enableDebug()) {
            console.log(`[OVM] executing: ${ovmBin} ${ovmArgs.join(" ")}`);
        }

        const ovm = cp.spawn(ovmBin, ovmArgs, {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.workspace,
        });

        ovm.unref();

        initTimeout
            .catch(() => {
                this.#events.init.emit("error", "OVM init timeout");
            });

    }

    public start(): void {
        const startTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 10 * 1000);

            const disposer = this.#events.start.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        const ovmBin = resource("ovm", this.options.resource);
        const ovmArgs = [
            "machine",
            "start",
            "--report-url", `unix://${this.restfulWithStart}`,
            "--workspace", this.options.workspace,
            "--ppid", String(this.options.bindPID),
            "default",
        ];

        if (enableDebug()) {
            console.log(`[OVM] executing: ${ovmBin} ${ovmArgs.join(" ")}`);
        }

        const ovm = cp.spawn(ovmBin, ovmArgs, {
            timeout: 0,
            windowsHide: true,
            detached: true,
            stdio: "ignore",
            cwd: this.options.workspace,
        });

        ovm.unref();

        startTimeout
            .catch(() => {
                this.#events.start.emit("error", "OVM start timeout");
            });
    }
}
