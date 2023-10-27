import {
    assertExistsFile,
    copy,
    existsFile,
    findUsablePort,
    isExecFile,
    mkdir,
    pRetry,
    request,
    rm,
    sleep,
    unzip,
} from "./utils";
import { Logger } from "./logger";
import os from "node:os";
import cp from "node:child_process";
import path from "node:path";
import { NodeSSH } from "node-ssh";
import { Remitter } from "remitter";
import { createMacPowerMonitor } from "@oomol-lab/mac-power-monitor";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
    type OVMInfo,
    type OVMDarwinOptions,
    type OVMEventData,
    type OVMVfkitFullState,
    OVMVfkitState,
} from "./type";

export class DarwinOVM {
    private readonly remitter = new Remitter<OVMEventData>();

    private path: OVMDarwinOptions["originPath"] = {} as OVMDarwinOptions["originPath"];
    private socket = {
        network: "",
        vfkit: "",
        vfkitRestful: "",
    };

    private gvproxyProcess?: ChildProcessWithoutNullStreams;
    private vfkitProcess?: ChildProcessWithoutNullStreams;

    private monitor = createMacPowerMonitor();

    private logGVProxy: Logger;
    private logVFKit: Logger;

    private podmanPort: number;
    private sshPort: number;

    private constructor(private options: OVMDarwinOptions) {}

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        const ovm = new DarwinOVM(options);
        await ovm.check();
        await ovm.initPath();
        await ovm.initSocket();
        await ovm.initLogs();
        await ovm.initPort();
        return ovm;
    }

    private async check(): Promise<void> {
        await Promise.all([
            isExecFile(this.options.originPath.gvproxy),
            isExecFile(this.options.originPath.vfkit),
            assertExistsFile(this.options.originPath.initrd),
            assertExistsFile(this.options.originPath.kernel),
            assertExistsFile(this.options.originPath.rootfs),
        ]);
    }

    private async overridePath(forceOverride: boolean): Promise<void> {
        await mkdir(this.options.targetDir);
        await Promise.all(Object.keys(this.options.originPath)
            .map(async (k) => {
                const filename = path.basename(this.options.originPath[k]);
                const isZIP = filename.toLowerCase().endsWith(".zip");
                const targetPath = path.join(this.options.targetDir, isZIP ? filename.slice(0, -4) : filename);

                if (forceOverride || !await existsFile(targetPath)) {
                    if (isZIP) {
                        await unzip(this.options.originPath[k], this.options.targetDir);
                    } else {
                        await copy(this.options.originPath[k], targetPath);
                    }
                }

                this.path[k] = targetPath;
            }));
    }

    private async initPath() {
        await this.overridePath(false);
    }

    private async initSocket(): Promise<void> {
        await mkdir(this.options.socketDir);
        this.socket.vfkit = path.join(this.options.socketDir, "vfkit.sock");
        this.socket.network = path.join(this.options.socketDir, "network.sock");
        this.socket.vfkitRestful = path.join(this.options.socketDir, "vfkit-restful.sock");

        await this.removeSocket();
    }

    private async removeSocket(): Promise<void> {
        await Promise.all([
            rm(this.socket.vfkit),
            rm(this.socket.network),
            rm(this.socket.vfkitRestful),
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

    public on(event: "ready" | "close" | "vmPause" | "vmResume", listener: () => void): void;
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
        this.gvproxyProcess = cp.spawn(this.path.gvproxy, [
            "-ssh-port", `${this.sshPort}`,
            "-listen", "vsock://:1024",
            "-listen", `unix://${this.socket.vfkit}`,
            "-listen", `unix://${this.socket.network}`,
            "--disable-orphan-process",
        ], {
            timeout: 0,
            windowsHide: true,
            stdio: [null, "pipe", "pipe"],
            cwd: this.options.targetDir,
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

        await pRetry(async () => assertExistsFile(this.socket.network), {
            interval: 50,
            retries: 200,
        });
    }

    private async startVFKit() {
        this.vfkitProcess = cp.spawn(this.path.vfkit, [
            "--cpus", `${Math.floor(os.cpus().length / 2)}`,
            "--memory", "2048",
            "--restful-uri", `unix://${this.socket.vfkitRestful}`,
            "--bootloader", `linux,kernel=${this.path.kernel},initrd=${this.path.initrd},cmdline="\\"root=/dev/vda\\""`,
            "--device", `virtio-blk,path=${this.path.rootfs}`,
            "--device", `virtio-vsock,port=1024,socketURL=${this.socket.vfkit}`,
            "--device", "virtio-fs,sharedDir=/Users/,mountTag=vfkit-share-user",
            "--device", "virtio-fs,sharedDir=/var/folders/,mountTag=vfkit-share-var-folders",
            "--device", "virtio-fs,sharedDir=/private/,mountTag=vfkit-share-private",
            "--disable-orphan-process",
        ], {
            timeout: 0,
            windowsHide: true,
            stdio: [null, "pipe", "pipe"],
            cwd: this.options.targetDir,
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

        await pRetry(async () => assertExistsFile(this.socket.vfkitRestful), {
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
            this.socket.network,
            500,
        );

        await sleep(1000);
        await pRetry(() => request.get(`http://localhost:${this.podmanPort}/libpod/_ping`, null, 100), {
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

        this.addPowerMonitor();
        this.remitter.emit("ready");
    }

    private async internalStop(): Promise<void> {
        this.removePowerMonitor();
        await request.post("http://vf/vm/state",
            JSON.stringify({
                state: "Stop",
            }),
            this.socket.vfkitRestful,
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
            this.socket.network,
            500,
        );
    }

    public async resetPath(): Promise<void> {
        await this.overridePath(true);
    }

    private addPowerMonitor() {
        this.removePowerMonitor();
        this.monitor.listenOnWillSleep(async () => {
            await this.vmPause();
        });
        this.monitor.listenOnWillWake(async () => {
            await this.vmResume();
        });
    }

    private removePowerMonitor() {
        this.monitor.unregisterAll();
    }

    public async vmState(): Promise<OVMVfkitFullState> {
        const currentState = await request.get("http://vf/vm/state",
            this.socket.vfkitRestful,
            100,
        );

        return JSON.parse(currentState);
    }

    public async vmPause(): Promise<void> {
        await pRetry(async () => {
            const { state: currentState, canPause } = await this.vmState();
            if (currentState === OVMVfkitState.VirtualMachineStatePaused || currentState === OVMVfkitState.VirtualMachineStatePausing) {
                this.remitter.emit("vmPause");
                return;
            }

            if (!canPause) {
                throw new Error("vm can not pause");
            }

            await request.post("http://vf/vm/state",
                JSON.stringify({
                    state: "Pause",
                }),
                this.socket.vfkitRestful,
                100,
            );

            this.remitter.emit("vmPause");
        }, {
            retries: 3,
            interval: 500,
        });
    }

    public async vmResume(): Promise<void> {
        await pRetry(async () => {
            const { state: currentState, canResume } = await this.vmState();
            if (currentState === OVMVfkitState.VirtualMachineStateRunning || currentState === OVMVfkitState.VirtualMachineStateResuming) {
                this.remitter.emit("vmResume");
                return;
            }

            if (!canResume) {
                throw new Error("vm can not resume");
            }

            await request.post("http://vf/vm/state",
                JSON.stringify({
                    state: "Resume",
                }),
                this.socket.vfkitRestful,
                100,
            );

            this.remitter.emit("vmResume");
        }, {
            retries: 3,
            interval: 500,
        });


    }
}
