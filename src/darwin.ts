import { RequestDarwin } from "./request";
import cp from "node:child_process";
import type { EventReceiver } from "remitter";
import { Remitter } from "remitter";
import {
    OVMDarwinInitEventValue,
    OVMDarwinRunEventValue,
    type OVMDarwinInitEvent,
    type OVMDarwinInitEventValueType,
    type OVMDarwinOptions,
    type OVMDarwinRunEvent,
    type OVMDarwinRunEventValueType,
} from "./type";
import { Restful } from "./event_restful";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { enableDebug, resource } from "./utils";

export class DarwinOVM extends RequestDarwin {
    public readonly events: {
        init: EventReceiver<OVMDarwinInitEvent>;
        run: EventReceiver<OVMDarwinRunEvent>;
    };
    readonly #events: {
        init: Remitter<OVMDarwinInitEvent>;
        run: Remitter<OVMDarwinRunEvent>;
    };

    private restful: Record<"init" | "run", Restful>;
    private restfulWithInit: string;
    private restfulWithRun: string;

    private constructor(private options: OVMDarwinOptions) {
        super(options.workspace);
        this.events = this.#events = {
            init: new Remitter(),
            run: new Remitter(),
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
            run: new Restful(),
        };

        this.#events.init.remitAny((o) => {
            return this.restful.init.events.onAny((data) => {
                o.emit(data.event as OVMDarwinInitEventValueType, data.data);
            });
        });

        this.#events.run.remitAny((o) => {
            return this.restful.run.events.onAny((data) => {
                o.emit(data.event as OVMDarwinRunEventValueType, data.data);
            });
        });

        const dir = await fs.mkdtemp(path.join(tmpdir(), "ovm-"));
        this.restfulWithInit = path.join(dir, "event-restful-init.sock");
        this.restfulWithRun = path.join(dir, "event-restful-run.sock");

        this.restful.init.start(this.restfulWithInit);
        this.restful.run.start(this.restfulWithRun);
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

        this.#events.init.once(OVMDarwinInitEventValue.Exit, async () => {
            await this.restful.init.stop();
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
                this.#events.init.emit(OVMDarwinInitEventValue.Error, {
                    value: "OVM init timeout",
                });
                this.#events.init.emit(OVMDarwinInitEventValue.Exit, {});
            });

    }

    public start(): void {
        const startTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 10 * 1000);

            const disposer = this.#events.run.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        this.#events.run.once(OVMDarwinRunEventValue.Exit, async () => {
            await this.restful.run.stop();
        });

        const ovmBin = resource("ovm", this.options.resource);
        const ovmArgs = [
            "machine",
            "start",
            "--report-url", `unix://${this.restfulWithRun}`,
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
                this.#events.run.emit(OVMDarwinRunEventValue.Error, {
                    value: "OVM run timeout",
                });
                this.#events.run.emit(OVMDarwinRunEventValue.Exit, {});
            });
    }

    public override async stop(): Promise<void> {
        const p = new Promise<void>((r) => {
            this.#events.run.once(OVMDarwinRunEventValue.Exit, () => {
                r();
            });
        });

        await super.stop();
        await p;
    }
}
