import path from "node:path";
import http from "node:http";
import { Readable } from "node:stream";
import type { OVMDarwinInfo, OVMDarwinState, OVMWindowsInfo } from "./type";
import { createEventSource } from "eventsource-client";
import fetch from "node-fetch";

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

    protected constructor(socketPath: string) {
        this.socketPath = socketPath;
    }

    protected async do(p: string, method: Method, timeout = DEFAULT_TIMEOUT, body?: Record<string, unknown>, socketPath?: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const r = http.request({
                timeout,
                method,
                socketPath: socketPath || this.socketPath,
                path: `http://ovm/${p}`,
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

                    return resolve(body);
                });
            })
                .once("error", (error) => {
                    reject(error);
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
            url: "http://ovm/exec",
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

export class RequestDarwin extends Request {
    public constructor(socketDir: string, name: string) {
        super(path.join(socketDir, `${name}-restful.sock`));
    }

    public async info(): Promise<OVMDarwinInfo> {
        return JSON.parse(await this.do("info", Method.GET)) as Promise<OVMDarwinInfo>;
    }

    public async state(): Promise<OVMDarwinState> {
        return JSON.parse(await this.do("state", Method.GET)) as Promise<OVMDarwinState>;
    }

    public async pause(): Promise<void> {
        await this.do("pause", Method.POST);
    }

    public async resume(): Promise<void> {
        await this.do("resume", Method.POST);
    }

    public async powerSaveMode(enable: boolean): Promise<void> {
        await this.do("power-save-mode", Method.PUT, DEFAULT_TIMEOUT, {
            enable,
        });
    }
}

export class RequestWindows extends Request {
    private readonly prepareSocketPath: string;

    public constructor(name: string) {
        super(`//./pipe/ovm-${name}`);
        this.prepareSocketPath = `//./pipe/ovm-prepare-${name}`;
    }

    public async info(): Promise<OVMWindowsInfo> {
        return JSON.parse(await this.do("info", Method.GET)) as OVMWindowsInfo;
    }

    public async enableFeature(): Promise<void> {
        await this.do("enable-feature", Method.POST, NEVER_TIMEOUT, undefined, this.prepareSocketPath);
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
        }, this.prepareSocketPath);
    }

    public async updateWSL(): Promise<void> {
        await this.do("update-wsl", Method.PUT, NEVER_TIMEOUT, undefined, this.prepareSocketPath);
    }
}
