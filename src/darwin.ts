import cp from "node:child_process";
import { Remitter } from "remitter";
import { OVMStatusName } from "./type";
import type { OVMDarwinOptions, OVMEventData, OVMInfo, OVMState } from "./type";
import { Restful } from "./event_restful";
import { Request } from "./request";

export class DarwinOVM {
    private readonly remitter = new Remitter<OVMEventData>();
    private eventSocketPath: string;
    private request: Request;

    private constructor(private options: OVMDarwinOptions) {}

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        const ovm = new DarwinOVM(options);
        await ovm.initEventRestful();
        ovm.initRequest();
        return ovm;
    }

    public on(event: keyof OVMEventData, listener: (datum: OVMEventData["status"]) => void): void {
        this.remitter.on(event, listener);
    }

    private async initEventRestful(): Promise<void> {
        const restful = new Restful(this.remitter);
        this.eventSocketPath = await restful.start();
    }

    private initRequest(): void {
        this.request = new Request(this.options.socketDir, this.options.name);
    }

    public start(): void {
        const versions = Object.keys(this.options.versions).map((key) => `${key}=${this.options.versions[key]}`).join(",");

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
            "-power-save-mode", String(this.options.powerSaveMode),
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
                    name: OVMStatusName.Error,
                    message: "OVM start timeout",
                });
            });
    }

    public async info(): Promise<OVMInfo> {
        return this.request.info();
    }

    public async state(): Promise<OVMState> {
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
