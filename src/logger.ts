import { existsFile, mkdir, rename } from "./utils";
import { createWriteStream } from "node:fs";
import path from "node:path";
import type { WriteStream } from "fs";

export class Logger {
    private ws: WriteStream;

    private constructor(private path: string, public name: string) {}

    public static async create(path: string, name: string): Promise<Logger> {
        const logger = new Logger(path, name);
        await logger.init();
        return logger;
    }

    private async init() {
        await mkdir(this.path);
        await this.adjustLogs();
    }

    private async adjustLogs() {
        const max = 3;

        for (let i = max - 1; i > 0; i--) {
            const currentLog = path.join(this.path, i === 1 ? `${this.name}.log` : `${this.name}.${i}.log`);

            if (await existsFile(currentLog)) {
                await rename(currentLog, `${this.name}.${i + 1}.log`);
            }

            if (i === 1) {
                this.ws = createWriteStream(currentLog, {
                    encoding: "utf8",
                });
            }
        }
    }

    public info(msg: string): void {
        this.ws.write(`${msg}\n`);
    }

    public close(): void {
        this.ws.close();
    }
}
