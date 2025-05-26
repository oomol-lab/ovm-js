import path from "node:path";
import http from "node:http";
import { Readable } from "node:stream";
import type { OVMDarwinInfo, OVMDarwinState, OVMWindowsInfo } from "./type";
import { createEventSource } from "eventsource-client";
import fetch from "node-fetch";
import { enableDebug } from "./utils";

enum Method {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
}

const DEFAULT_TIMEOUT = 200;
const NEVER_TIMEOUT = 0;

abstract class Request {
    public abstract info(): Promise<OVMDarwinInfo | OVMWindowsInfo>;

    protected readonly socketPath: string;

    protected constructor(socketPath: string, private readonly uri = "http://ovm/") {
        this.socketPath = socketPath;
    }

    protected async do(p: string, method: Method, timeout = DEFAULT_TIMEOUT, body?: Record<string, unknown>, socketPath?: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const r = http.request({
                timeout,
                method,
                socketPath: socketPath || this.socketPath,
                path: `${this.uri}${p}`,
            }, (response) => {
                response.setEncoding("utf8");

                let body = "";
                response.on("data", (chunk) => {
                    body += chunk;
                });

                response.on("end", () => {
                    const { statusCode } = response;
                    if (!statusCode || statusCode >= 400) {
                        return reject(new Error(`Request Failed. Status Code: ${statusCode}, Response: ${body}`));
                    }

                    if (enableDebug()) {
                        console.log(`[OVM] Request - ${method} ${p} ${statusCode} ${body}`);
                    }
                    return resolve(body);
                });
            })
                .once("error", (error) => {
                    reject(new Error(`Request Failed: ${p}. Error: ${error.message}`));
                });

            if (body && method !== "GET") {
                r.write(JSON.stringify(body));
            }

            r.end();
        });
    }

    public async requestStop(): Promise<void> {
        await this.do("request-stop", Method.POST);
    }

    public async stop(): Promise<void> {
        await this.do("stop", Method.POST);
    }

    public exec(command: string): Readable {
        const s = new Readable();
        s._read = function _read() {
            // do nothing
        };

        const agent = new http.Agent({
            // @ts-expect-error
            // https://github.com/node-fetch/node-fetch/issues/336#issuecomment-689623290
            socketPath: this.socketPath,
        });

        const es = createEventSource({
            url: `${this.uri}exec`,
            fetch: (url, init) => {
                return fetch(url, {
                    ...init,
                    agent,
                });
            },
            method: "POST",
            body: JSON.stringify({
                command,
            }),
            onDisconnect: () => {
                es.close();
                s.push(null);
            },
            onMessage: ({ event, data }) => {
                if (event === "error") {
                    s.destroy(new Error(data));
                } else if (event === "out") {
                    s.push(data);
                }
            },
        });

        s.on("close", () => {
            es.close();
        });

        return s;
    }
}

type RequestDarwinRawInfoResp = {
    podmanSocketPath: string;
    sshPort: number;
    sshUser: string;
    hostEndpoint: string;
}

export class RequestDarwin extends Request {
    public constructor(workspace: string) {
        super(path.join(workspace, "socks", "ovm_restapi.socks"), "http://ovm/");
    }

    public async info(): Promise<OVMDarwinInfo> {
        return JSON.parse(await this.do("info", Method.GET)) as RequestDarwinRawInfoResp;
    }

    public async state(): Promise<OVMDarwinState> {
        const result = JSON.parse(await this.do("vmstat", Method.GET)) as { CurrentStat: OVMDarwinState["state"] };
        return {
            state: result.CurrentStat,
            canStop: true,
            canRequestStop: true,
            canPause: false,
            canResume: false,
            canStart: true,
        };
    }

    public pause(): Promise<void> {
        return Promise.resolve();
    }

    public resume(): Promise<void> {
        return Promise.resolve();
    }

    public powerSaveMode(_enable: boolean): Promise<void> {
        return Promise.resolve();
    }
}

export class RequestWindows extends Request {
    private readonly initSocketPath: string;

    public constructor(name: string) {
        super(`//./pipe/ovm-${name}`);
        this.initSocketPath = `//./pipe/ovm-init-${name}`;
    }

    public async info(): Promise<OVMWindowsInfo> {
        return JSON.parse(await this.do("info", Method.GET)) as OVMWindowsInfo;
    }

    public async enableFeature(): Promise<void> {
        await this.do("enable-feature", Method.POST, NEVER_TIMEOUT, undefined, this.initSocketPath);
    }

    /**
     * reboot the system
     * @param runOnce {string} - is the command to run after the next system startup
     * @param later {boolean} - is whether to reboot later
     */
    public async reboot(runOnce: string, later: boolean): Promise<void> {
        await this.do("reboot", Method.POST, NEVER_TIMEOUT, {
            runOnce,
            later,
        }, this.initSocketPath);
    }

    public async updateWSL(): Promise<void> {
        await this.do("update-wsl", Method.PUT, NEVER_TIMEOUT, undefined, this.initSocketPath);
    }

    public async fixWSLConfig(method: "auto" | "open" | "skip"): Promise<void> {
        await this.do("fix-wsl-config", Method.PUT, NEVER_TIMEOUT, {
            method,
        }, this.initSocketPath);
    }

    public async shutdownWSL(): Promise<void> {
        await this.do("shutdown-wsl", Method.PUT, NEVER_TIMEOUT, undefined, this.initSocketPath);
    }
}
