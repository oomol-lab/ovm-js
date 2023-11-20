import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import unzipper from "unzipper";
import { constants, createReadStream } from "node:fs";

export const isExecFile = (p: string): Promise<void> => {
    return fs.access(p, constants.X_OK);
};

export const assertExistsFile = (p: string): Promise<void> => {
    return fs.access(p, constants.F_OK);
};

export const existsFile = async (p: string): Promise<boolean> => {
    try {
        await assertExistsFile(p);
        return true;
    } catch (_error) {
        return false;
    }
};

export const copy = (origin: string, target: string): Promise<void> => {
    return fs.copyFile(origin, target);
};

export const unzip = async (zipFile: string, target: string): Promise<void> => {
    const stream = createReadStream(zipFile).pipe(unzipper.Extract({ path: target }));
    return new Promise((resolve, reject) => {
        stream.on("error", (error) => {
            reject(error);
        });
        stream.on("close", () => {
            resolve();
        });
    });
};

export const rename = async (oldPath: string, newName: string): Promise<void> => {
    const dir = path.dirname(oldPath);
    await fs.rename(oldPath, path.join(dir, newName));
};

export const mkdir = async (p: string): Promise<void> => {
    try {
        await assertExistsFile(p);
    } catch (_error) {
        await fs.mkdir(p, { recursive: true });
        return;
    }

    const stat = await fs.stat(p);
    if (!stat.isDirectory()) {
        throw new Error(`${p} is not a directory`);
    }
};

export const readFile = async (p: string): Promise<string> => {
    const raw = await fs.readFile(p, "utf8");
    return raw.trim();
};

export const writeFile = async (p: string, data: string | Record<string, string>): Promise<void> => {
    const d = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    await fs.writeFile(p, d, "utf8");
};

export const tryParseJSON = <T>(raw: string): T | false => {
    const r = raw.trim();
    if (!r.startsWith("{") || !r.endsWith("}")) {
        return false;
    }

    try {
        return JSON.parse(r) as T;
    } catch (_error) {
        return false;
    }
};

export const rm = (p: string): Promise<void> => {
    return fs.rm(p, {
        force: true,
        recursive: true,
        maxRetries: 3,
        retryDelay: 100,
    });
};

export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

export const pRetry = <T>(fn: () => Promise<T>, options: { retries: number, interval: number }): Promise<T> => {
    return new Promise((resolve, reject) => {
        const retry = (count: number) => {
            fn().then(resolve).catch((error) => {
                if (count === 0) {
                    reject(error);
                    return;
                }

                setTimeout(() => {
                    retry(count - 1);
                }, options.interval);
            });
        };

        retry(options.retries);
    });
};

class Request {
    public get(url: string, socketPath: string | null, timeout: number) {
        return new Promise<string>((resolve, reject) => {
            http.get(url, {
                timeout,
                socketPath: socketPath ?? undefined,
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
                    } else {
                        resolve(body);
                    }
                });
            })
                .once("error", (error) => {
                    reject(error);
                });
        });
    }

    public post(url: string, data: string, socketPath: string, timeout: number) {
        return new Promise<void>((resolve, reject) => {
            const req = http.request({
                socketPath,
                path: url,
                method: "POST",
                timeout,
            }, (response) => {
                const { statusCode } = response;
                if (!statusCode || statusCode >= 400) {
                    response.resume();
                    reject(new Error(`Request Failed. Status Code: ${statusCode}`));
                } else {
                    resolve();
                }
            });

            req.once("error", (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }
}

export const request = new Request();

const portOccupied = (port: number) => {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer().listen(port);
        server.on("listening", () => {
            server.close();
            resolve(port);
        });
        server.on("error", (error) => {
            if ("code" in error && error.code === "EADDRINUSE") {
                reject(new Error(`port: ${port} is occupied`));
            } else {
                reject(error);
            }
        });
    });
};


export const findUsablePort = async (startPort: number): Promise<number> => {
    const port = startPort;
    const maxPort = 65_535;
    let lastError = "";

    for (let i = port; i <= maxPort; i++) {
        try {
            await portOccupied(i);
            return i;
        } catch (error) {
            lastError = error.message;
        }
    }

    throw new Error(`no available port from ${startPort} to ${maxPort}, last error: ${lastError}`);
};
