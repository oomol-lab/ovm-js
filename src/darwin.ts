import cp from "node:child_process";
import fs from "node:fs/promises";
import { Remitter } from "remitter";
import { OVMDarwinStatusName } from "./type";
import type { OVMDarwinOptions, OVMDarwinEventData, OVMDarwinInfo, OVMDarwinState } from "./type";
import { Restful } from "./event_restful";
import { Request } from "./request";
import path from "node:path";
import { tmpdir } from "node:os";

export class DarwinOVM {
    private readonly remitter = new Remitter<OVMDarwinEventData>();
    private eventSocketPath: string;
    private request: Request;

    private constructor(private options: OVMDarwinOptions) {}

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        const ovm = new DarwinOVM(options);
        await Promise.all([
            ovm.initEventRestful(),
            ovm.initPath(),
        ]);
        ovm.initRequest();
        return ovm;
    }

    public on(event: keyof OVMDarwinEventData, listener: (datum: OVMDarwinEventData["status"]) => void): void {
        this.remitter.on(event, listener);
    }

    private async initEventRestful(): Promise<void> {
        const restful = new Restful((name, message) => {
            if (name in OVMDarwinStatusName) {
                this.remitter.emit("status", {
                    name: name as OVMDarwinStatusName,
                    message,
                });
            }
        });

        const dir = await fs.mkdtemp(path.join(tmpdir(), "ovm-"));
        const socketPath = path.join(dir, "event-restful.sock");
        restful.start(socketPath);
        this.eventSocketPath = socketPath;
    }

    private initRequest(): void {
        this.request = new Request(this.options.socketDir, this.options.name);
    }

    private async initPath(): Promise<void> {
        await fs.mkdir(this.options.targetDir, {
            recursive: true,
            mode: 0o755,
        });
    }

    public start(): void {
        const versions = Object.keys(this.options.versions).map((key) => {
            return `${key === "dataImg" ? "data_img" : key}=${this.options.versions[key]}`;
        }).join(",");

        const launchTimeout = new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => {
                disposer();
                // eslint-disable-next-line prefer-promise-reject-errors
                reject();
            }, 10 * 1000);

            const disposer = this.remitter.once("status", () => {
                clearTimeout(id);
                resolve();
            });
        });

        const ovm = cp.spawn(this.options.ovmPath, [
            "-name", this.options.name,
            "-log-path", this.options.logDir,
            "-socket-path", this.options.socketDir,
            "-ssh-key-path", this.options.sshKeyDir,
            "-cpus", String(this.options.cpu),
            "-memory", String(this.options.memory),
            "-kernel-path", this.options.linuxPath.kernel,
            "-initrd-path", this.options.linuxPath.initrd,
            "-rootfs-path", this.options.linuxPath.rootfs,
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
            cwd: this.options.targetDir,
        });

        ovm.unref();

        launchTimeout
            .catch(() => {
                this.remitter.emit("status", {
                    name: OVMDarwinStatusName.Error,
                    message: "OVM start timeout",
                });
            });
    }

    public async info(): Promise<OVMDarwinInfo> {
        return this.request.info();
    }

    public async state(): Promise<OVMDarwinState> {
        return this.request.state();
    }

    public async pause(): Promise<void> {
        await this.request.pause();
    }

    public async resume(): Promise<void> {
        await this.request.resume();
    }

    public async requestStop(): Promise<void> {
        await this.request.requestStop();
    }

    public async stop(): Promise<void> {
        await this.request.stop();
    }
}
