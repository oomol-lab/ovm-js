import {
    assertExistsFile,
    copy,
    existsFile,
    findUsablePort,
    generateSSHKey,
    getLocalTZ,
    isExecFile,
    mkdir,
    pRetry,
    readFile,
    request,
    rm,
    sleep,
    tryParseJSON,
    unzip,
    writeFile,
} from "./utils";
import { Logger } from "./logger";
import os from "node:os";
import cp from "node:child_process";
import path from "node:path";
import net from "node:net";
import { NodeSSH } from "node-ssh";
import { Remitter } from "remitter";
import { createMacPowerMonitor } from "@oomol-lab/mac-power-monitor";
import { createSparse } from "@oomol-lab/sparse-file";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
    type OVMInfo,
    type OVMDarwinOptions,
    type OVMEventData,
    type OVMVfkitFullState,
    OVMVfkitState,
} from "./type";

class Mount {
    public static list = [
        {
            tag: "vfkit-share-user",
            source: "/Users",
        },
        {
            tag: "vfkit-share-var-folders",
            source: "/var/folders",
        },
        {
            tag: "vfkit-share-private",
            source: "/private",
        },
    ];

    public static toVFKit(): string[] {
        return Mount.list.flatMap((m) => {
            return ["--device", `virtio-fs,sharedDir=${m.source},mountTag=${m.tag}`];
        });
    }

    public static toFSTAB(): string[] {
        return Mount.list.map((m) => {
            return `${m.tag} ${m.source} virtiofs defaults 0 0`;
        });
    }
}

export class DarwinOVM {
    private readonly remitter = new Remitter<OVMEventData>();

    private path: OVMDarwinOptions["originPath"] = {} as OVMDarwinOptions["originPath"];
    private socket = {
        network: "",
        vfkit: "",
        vfkitRestful: "",
        initrdVSock: "",
        readySock: "",
        podmanSock: "",
    };

    private gvproxyProcess?: ChildProcessWithoutNullStreams;
    private vfkitProcess?: ChildProcessWithoutNullStreams;

    private monitor = createMacPowerMonitor();

    private logGVProxy: Logger;
    private logVFKit: Logger;

    private sshPort: number;

    private publicKey: string;

    private ready: Promise<void>;

    private localTZ: string;

    private constructor(private options: OVMDarwinOptions) {}

    public static async create(options: OVMDarwinOptions): Promise<DarwinOVM> {
        const ovm = new DarwinOVM(options);
        await ovm.check();
        await Promise.all([
            ovm.initPath(),
            ovm.initSocket(),
            ovm.initLogs(),
            ovm.initSSHKey(),
            ovm.initPort(),
            ovm.initDisks(),
            ovm.initTZ(),
        ]);
        ovm.initReady();
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

    private async matchVersions() {
        const versionFilePath = path.join(this.options.targetDir, "versions.json");

        if (!await existsFile(versionFilePath)) {
            return (_key) => false;
        }

        const versionFileContent = await readFile(versionFilePath);
        const versions = tryParseJSON<OVMDarwinOptions["versions"]>(versionFileContent);

        if (!versions) {
            return (_key) => false;
        }

        return (key: string) => {
            return versions[key] === this.options.versions[key];
        };
    }

    private async overridePath(forceOverride: boolean): Promise<void> {
        await mkdir(this.options.targetDir);

        const matchVersion = await this.matchVersions();

        await Promise.all(Object.keys(this.options.originPath)
            .map(async (k) => {
                const filename = path.basename(this.options.originPath[k]);
                const isZIP = filename.toLowerCase().endsWith(".zip");
                const targetPath = path.join(this.options.targetDir, isZIP ? filename.slice(0, -4) : filename);

                const shouldOverride = forceOverride || !await existsFile(targetPath) || !matchVersion(k);
                if (shouldOverride) {
                    if (isZIP) {
                        await unzip(this.options.originPath[k], this.options.targetDir);
                    } else {
                        await copy(this.options.originPath[k], targetPath);
                    }
                }

                this.path[k] = targetPath;
            }));

        await writeFile(path.join(this.options.targetDir, "versions.json"), this.options.versions);
    }

    private async initPath() {
        await this.overridePath(false);
    }

    private async initSocket(): Promise<void> {
        await mkdir(this.options.socketDir);
        this.socket.vfkit = path.join(this.options.socketDir, "vfkit.sock");
        this.socket.vfkitRestful = path.join(this.options.socketDir, "vfkit-restful.sock");
        this.socket.initrdVSock = path.join(this.options.socketDir, "initrd-vsock.sock");
        this.socket.readySock = path.join(this.options.socketDir, "ready.sock");
        this.socket.podmanSock = path.join(this.options.socketDir, "podman.sock");

        await this.removeSocket();
    }

    private async removeSocket(): Promise<void> {
        await Promise.all([
            rm(this.socket.vfkit),
            rm(this.socket.vfkitRestful),
            rm(this.socket.initrdVSock),
            rm(this.socket.readySock),
            rm(this.socket.podmanSock),
        ]);
    }

    private async initLogs(): Promise<void> {
        const logs = await Promise.all([
            Logger.create(this.options.logDir, "gvproxy"),
            Logger.create(this.options.logDir, "vfkit"),
        ]);
        this.logGVProxy = logs[0];
        this.logVFKit = logs[1];
    }

    private async initPort(): Promise<void> {
        this.sshPort = await findUsablePort(2223);
    }

    private async initSSHKey(): Promise<void> {
        await mkdir(this.options.sshKeyDir, 0o700);
        const privatePath = path.join(this.options.sshKeyDir, "ovm");

        if (!await existsFile(privatePath)) {
            await generateSSHKey(privatePath);
        }

        this.publicKey = await readFile(`${privatePath}.pub`);
    }

    private initReady(): void {
        this.ready = new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                server.close();
                reject(new Error("ready timeout"));
            }, 1000 * 30);

            const server = net.createServer((conn) => {
                conn.on("data", () => {
                    clearTimeout(id);
                    conn.end();
                    server.close();
                    resolve();
                });
            });

            server.listen(this.socket.readySock);

            server.once("error", (error) => {
                clearTimeout(id);
                server.close();
                reject(error);
            });
        });
    }

    private async initTZ(): Promise<void> {
        this.localTZ = await getLocalTZ();
    }

    private async initDisks(): Promise<[void, void]> {
        return Promise.all([
            this.createDisk("data", 8 * 1024 * 1024 * 1024 * 1024),
            this.createDisk("tmp", 1 * 1024 * 1024 * 1024 * 1024),
        ]);
    }

    private async createDisk(name: string, size: number): Promise<void> {
        const p = path.join(this.options.targetDir, `${name}.img`);

        if (!await existsFile(p)) {
            return createSparse(p, size);
        }
    }

    public on(event: "ready" | "close" | "vmPause" | "vmResume", listener: () => void): void;
    public on(event: "error", listener: (error: Error) => void): void;
    public on(event: keyof OVMEventData, listener: (...args: any[]) => void): void {
        this.remitter.on(event, listener);
    }

    public info(): OVMInfo {
        return {
            podmanSocket: this.socket.podmanSock,
            sshPort: this.sshPort,
        };
    }

    public async start(): Promise<void> {
        try {
            await this.startGVProxy();
            await this.startVFKit();
            await this.initVM();
        } catch (error) {
            this.remitter.emit("error", error);
            await this.stop();
        }
    }

    private async startGVProxy(): Promise<void> {
        this.gvproxyProcess = cp.spawn(this.path.gvproxy, [
            "-ssh-port", `${this.sshPort}`,
            "-listen", "vsock://:1024",
            "-listen", `unix://${this.socket.vfkit}`,
            "-forward-user", "root",
            "-forward-identity", path.join(this.options.sshKeyDir, "ovm"),
            "-forward-sock", `${this.socket.podmanSock}`,
            "-forward-dest", "/run/podman/podman.sock",
            "--disable-orphan-process",
        ], {
            timeout: 0,
            windowsHide: true,
            stdio: [null, "pipe", "pipe"],
            cwd: this.options.targetDir,
        });

        this.gvproxyProcess.once("exit", (_code, _signal) => {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            this.stop().catch((_error) => {});
        });

        this.gvproxyProcess.stdout.on("data", (data) => {
            this.logGVProxy.info(data.toString());
        });

        this.gvproxyProcess.stderr.on("data", (data) => {
            this.logGVProxy.info(data.toString());
        });

        await pRetry(async () => assertExistsFile(this.socket.vfkit), {
            interval: 100,
            retries: 3,
        });
    }

    private async startVFKit() {
        const ignition = this.ignition();
        this.vfkitProcess = cp.spawn(this.path.vfkit, [
            "--cpus", `${Math.floor(os.cpus().length / 2)}`,
            "--memory", "2048",
            "--restful-uri", `unix://${this.socket.vfkitRestful}`,
            "--bootloader", `linux,kernel=${this.path.kernel},initrd=${this.path.initrd},cmdline="fb_tunnels=none"`,
            "--device", `virtio-blk,path=${this.path.rootfs}`,
            "--device", `virtio-vsock,port=1024,socketURL=${this.socket.vfkit}`,
            "--device", `virtio-vsock,port=1025,socketURL=${this.socket.initrdVSock}`,
            "--device", `virtio-vsock,port=1026,socketURL=${this.socket.readySock}`,
            ...Mount.toVFKit(),
            "--device", `virtio-blk,path=${this.options.targetDir}/tmp.img`,
            "--device", `virtio-blk,path=${this.options.targetDir}/data.img`,
            "--disable-orphan-process",
        ], {
            timeout: 0,
            windowsHide: true,
            stdio: [null, "pipe", "pipe"],
            cwd: this.options.targetDir,
        });

        this.vfkitProcess.once("exit", (_code, _signal) => {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            this.stop().catch((_error) => {});
        });

        this.vfkitProcess.stdout.on("data", (data) => {
            this.logVFKit.info(data.toString());
        });

        this.vfkitProcess.stderr.on("data", (data) => {
            this.logVFKit.info(data.toString());
        });

        await ignition;
    }

    private async ignition(): Promise<void> {
        const mount = `echo -e ${Mount.toFSTAB().join("\\\\n")} >> /mnt/overlay/etc/fstab`;
        const authorizedKeys = `mkdir -p /mnt/overlay/root/.ssh; echo ${this.publicKey} >> /mnt/overlay/root/.ssh/authorized_keys`;
        const ready = "echo -e \"echo Ready | socat - VSOCK-CONNECT:2:1026\" > /mnt/overlay/opt/ready.command";
        const tz = `ln -sf /usr/share/zoneinfo/${this.localTZ} /mnt/overlay/etc/localtime; echo ${this.localTZ} > /mnt/overlay/etc/timezone`;

        const cmd = [mount, authorizedKeys, ready, tz].join(";");

        return new Promise((resolve, reject) => {
            const timeout = this.options.timeout ?? 1000 * 20;
            const id = setTimeout(() => {
                server.close();
                reject(new Error("ignition timeout"));
            }, timeout);

            const server = net.createServer((conn) => {
                clearTimeout(id);
                conn.write(cmd);
                conn.end();
                server.close();
                resolve();
            });

            server.listen(this.socket.initrdVSock);

            server.once("error", (error) => {
                clearTimeout(id);
                server.close();
                reject(error);
            });
        });
    }

    private async initVM(): Promise<void> {
        await this.ready;

        this.addPowerMonitor();
        this.remitter.emit("ready");
    }

    private async killProcess(): Promise<void> {
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
        await sleep(500);
        this.gvproxyProcess?.kill("SIGKILL");
        this.vfkitProcess?.kill("SIGKILL");
    }

    public async stop(): Promise<void> {
        this.removePowerMonitor();

        await Promise.all([
            this.removeSocket(),
            this.killProcess(),
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ]).catch((_error) => {});

        this.logVFKit.close();
        this.logGVProxy.close();

        this.remitter.emit("close");
        this.remitter.dispose();
    }

    public async clocksync(): Promise<void> {
        const ssh = new NodeSSH();
        await ssh.connect({
            host: "127.0.0.1",
            username: "root",
            password: "1",
            port: this.sshPort,
            timeout: 20,
        });

        const commands = [
            `date -s @${Math.floor(Date.now() / 1000)}`,
            "systemctl restart chrony",
        ];

        await pRetry(async () => {
            await ssh.execCommand(commands.join(" && "));
        }, {
            retries: 3,
            interval: 100,
        });

        ssh.dispose();
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
    }

    public async vmResume(): Promise<void> {
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

        await this.clocksync();
    }
}
