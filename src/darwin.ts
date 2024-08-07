import cp from "node:child_process";
import fs from "node:fs/promises";
import type { EventReceiver } from "remitter";
import { Remitter } from "remitter";
import type { OVMDarwinEventData, OVMDarwinOptions } from "./type";
import { Restful } from "./event_restful";
import { RequestDarwin } from "./request";
import path from "node:path";
import { tmpdir } from "node:os";
import { resource } from "./utils";

export class DarwinOVM extends RequestDarwin {
    public readonly events : EventReceiver<OVMDarwinEventData>;
    readonly #events: Remitter<OVMDarwinEventData>;
    private restful: Restful;
    private eventSocketPath: string;

    private constructor(private options: OVMDarwinOptions) {
        super(options.socketDir, options.name);
        this.events = this.#events = new Remitter();
    }

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        const ovm = new DarwinOVM(options);
        await Promise.all([
            ovm.initEventRestful(),
            ovm.initPath(),
        ]);
        return ovm;
    }

    private async initEventRestful(): Promise<void> {
        this.restful = new Restful();

        this.#events.remitAny((o) => {
            return this.restful.events.onAny((data) => {
                o.emit(data.event as keyof OVMDarwinEventData, data.data);
            });
        });

        const dir = await fs.mkdtemp(path.join(tmpdir(), "ovm-"));
        const socketPath = path.join(dir, "event-restful.sock");
        this.restful.start(socketPath);
        this.eventSocketPath = socketPath;
    }

    private async initPath(): Promise<void> {
        await fs.mkdir(this.options.targetDir, {
            recursive: true,
            mode: 0o755,
        });
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
            }, 10 * 1000);

            const disposer = this.#events.onceAny(() => {
                clearTimeout(id);
                resolve();
            });
        });

        const ovm = cp.spawn(resource("ovm", this.options.resource), [
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-socket-path", this.options.socketDir,
            "-ssh-key-path", this.options.sshKeyDir,
            "-cpus", String(this.options.cpu),
            "-memory", String(this.options.memory),
            "-kernel-path", resource("kernel", this.options.resource),
            "-initrd-path", resource("initrd", this.options.resource),
            "-rootfs-path", resource("rootfs", this.options.resource),
            "-target-path", this.options.targetDir,
            "-versions", versions,
            "-event-socket-path", this.eventSocketPath,
            "-bind-pid", String(process.pid),
            `-power-save-mode=${String(this.options.powerSaveMode)}`,
            `-extend-share-dir=${this.options.extendShareDir || ""}`,
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
                this.#events.emit("error", "OVM start timeout");
            });
    }

    public dispose(): void {
        this.restful.stop();
        this.#events.dispose();
    }
}
