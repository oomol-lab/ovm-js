import {
    assertExistsFile,
    findUsablePort,
    isExecFile,
    pRetry,
    request,
    rm,
    sleep,
} from "./utils";
import type { OVMDarwinOptions, OVMEventData } from "./type";
import os from "os";
import cp from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { Logger } from "./logger";
import { NodeSSH } from "node-ssh";
import { Remitter } from "remitter";
import type { OVMInfo } from "./type";

export class DarwinOVM {
    private readonly remitter = new Remitter<OVMEventData>();

    private gvproxyProcess?: ChildProcessWithoutNullStreams;
    private vfkitProcess?: ChildProcessWithoutNullStreams;

    private logGVProxy: Logger;
    private logVFKit: Logger;

    private podmanPort: number;
    private sshPort: number;

    private constructor(private options: OVMDarwinOptions) {}

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        const ovm = new DarwinOVM(options);
        await ovm.check();
        await ovm.removeSocket();
        await ovm.initLogs();
        await ovm.initPort();
        return ovm;
    }

    private async check(): Promise<void> {
        await Promise.all([
            isExecFile(this.options.gvproxyPath),
            isExecFile(this.options.vfkitPath),
            assertExistsFile(this.options.initrdPath),
            assertExistsFile(this.options.kernelPath),
            assertExistsFile(this.options.rootfsPath),
        ]);
    }

    private async removeSocket(): Promise<void> {
        await Promise.all([
            rm(this.options.vfkitSocketPath),
            rm(this.options.networkSocketPath),
            rm(this.options.vfkitRestfulSocketPath),
        ]);
    }

    private async initLogs(): Promise<void> {
        this.logGVProxy = await Logger.create(this.options.logDir, "gvproxy");
        this.logVFKit = await Logger.create(this.options.logDir, "vfkit");
    }

    private async initPort(): Promise<void> {
        this.podmanPort = await findUsablePort(58_125);
        this.sshPort = await findUsablePort(2223);
    }

    public on(event: "ready", listener: () => void): void;
    public on(event: "close", listener: () => void): void;
    public on(event: "error", listener: (error: Error) => void): void;
    public on(event: keyof OVMEventData, listener: (...args: any[]) => void): void {
        this.remitter.on(event, listener);
    }

    public info(): OVMInfo {
        return {
            podmanPort: this.podmanPort,
            sshPort: this.sshPort,
        };
    }

    public async start(): Promise<void> {
        await pRetry(async () => {
            await this.startGVProxy();
            await this.startVFKit();

            await this.initVM().catch(async (error) => {
                await this.removeSocket();
                await this.internalStop();
                throw error;
            });
        }, {
            interval: 100,
            retries: 2,
        }).catch(async (error) => {
            this.remitter.emit("error", error);
            await this.stop();
        });
    }

    private async startGVProxy(): Promise<void> {
        this.gvproxyProcess = cp.spawn(this.options.gvproxyPath, [
            "-ssh-port", `${this.sshPort}`,
            "-listen", "vsock://:1024",
            "-listen", `unix://${this.options.vfkitSocketPath}`,
            "-listen", `unix://${this.options.networkSocketPath}`,
        ], {
            timeout: 0,
            windowsHide: true,
            stdio: [null, "pipe", "pipe"],
        });

        this.gvproxyProcess.once("close", (_code, _signal) => {
            if (!this.vfkitProcess?.killed) {
                this.vfkitProcess?.kill();
            }
        });

        this.gvproxyProcess.stdout.on("data", (data) => {
            this.logGVProxy.info(data.toString());
        });

        this.gvproxyProcess.stderr.on("data", (data) => {
            this.logGVProxy.info(data.toString());
        });

        await pRetry(async () => assertExistsFile(this.options.networkSocketPath), {
            interval: 50,
            retries: 200,
        });
    }

    private async startVFKit() {
        this.vfkitProcess = cp.spawn(this.options.vfkitPath, [
            "--cpus", `${Math.floor(os.cpus().length / 2)}`,
            "--memory", "2048",
            "--restful-uri", `unix://${this.options.vfkitRestfulSocketPath}`,
            "--bootloader", `linux,kernel=${this.options.kernelPath},initrd=${this.options.initrdPath},cmdline="\\"root=/dev/vda\\""`,
            "--device", `virtio-blk,path=${this.options.rootfsPath}`,
            "--device", `virtio-vsock,port=1024,socketURL=${this.options.vfkitSocketPath}`,
            "--device", "virtio-fs,sharedDir=/Users/,mountTag=vfkit-share-user",
            "--device", "virtio-fs,sharedDir=/var/folders/,mountTag=vfkit-share-var-folders",
            "--device", "virtio-fs,sharedDir=/private/,mountTag=vfkit-share-private",
        ], {
            timeout: 0,
            windowsHide: true,
            stdio: [null, "pipe", "pipe"],
        });

        this.vfkitProcess.once("close", (_code, _signal) => {
            if (!this.gvproxyProcess?.killed) {
                this.gvproxyProcess?.kill();
            }
        });

        this.vfkitProcess.stdout.on("data", (data) => {
            this.logVFKit.info(data.toString());
        });

        this.vfkitProcess.stderr.on("data", (data) => {
            this.logVFKit.info(data.toString());
        });

        await pRetry(async () => assertExistsFile(this.options.vfkitRestfulSocketPath), {
            interval: 50,
            retries: 200,
        });
    }

    private async initVM(): Promise<void> {
        await request.post(
            "http://unix/services/forwarder/expose",
            JSON.stringify({
                local: `:${this.podmanPort}`,
                remote: "192.168.127.2:58125",
            }),
            this.options.networkSocketPath,
            500,
        );

        await sleep(1000);
        await pRetry(() => request.get(`http://localhost:${this.podmanPort}/libpod/_ping`, 100), {
            interval: 10,
            retries: 20,
        });

        const ssh = new NodeSSH();
        await ssh.connect({
            host: "127.0.0.1",
            username: "root",
            password: "1",
            port: this.sshPort,
            timeout: 20,
        });

        const commands = [
            "ls",
            "mkdir -p {/User/,/var/folders/,/private/}",
            "mount -t virtiofs vfkit-share-user /User/",
            "mount -t virtiofs vfkit-share-var-folders /var/folders/",
            "mount -t virtiofs vfkit-share-private /private/",
        ];

        await ssh.execCommand(commands.join(" && "));
        ssh.dispose();

        this.remitter.emit("ready");
    }

    private async internalStop(): Promise<void> {
        await request.post("http://vf/vm/state",
            JSON.stringify({
                state: "Stop",
            }),
            this.options.vfkitRestfulSocketPath,
            500,
        ).catch((_error) => {
            // ignore error
        });

        this.gvproxyProcess?.kill();
        await sleep(200);
        this.gvproxyProcess?.kill("SIGKILL");
        this.vfkitProcess?.kill("SIGKILL");

        this.logVFKit.close();
        this.logGVProxy.close();
    }

    public async stop(): Promise<void> {
        await this.internalStop();
        this.remitter.emit("close");
        this.remitter.dispose();
    }

    public async exportPort(hostPort: number, guestPort: number): Promise<void> {
        await request.post(
            "http://unix/services/forwarder/expose",
            JSON.stringify({
                local: `:${hostPort}`,
                remote: `192.168.127.2:${guestPort}`,
            }),
            this.options.networkSocketPath,
            500,
        );
    }
}
