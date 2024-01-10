import url from "node:url";
import http from "node:http";
import type { OVMEventData } from "./type";
import { OVMStatusName } from "./type";
import type { Remitter } from "remitter";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export class Restful {
    private readonly server: http.Server;

    public constructor(
        private readonly emitter: Remitter<OVMEventData>,
    ) {
        this.server = http.createServer((request, response) => {
            if (!request.url) {
                return;
            }

            const parsedUrl = url.parse(request.url, true);
            if (parsedUrl.pathname === "/notify" && request.method === "GET") {
                response.statusCode = 200;
                response.end("ok");

                const event = parsedUrl.query.event as OVMStatusName;
                const message = parsedUrl.query.message as string;

                if (event in OVMStatusName) {
                    this.emitter.emit("status", {
                        name: event,
                        message: message,
                    });
                }
            } else {
                response.statusCode = 404;
                response.end("Not Found");
            }
        });
    }

    public async start(): Promise<string> {
        const dir = await fs.mkdtemp(path.join(tmpdir(), "ovm-"));
        const socketPath = path.join(dir, "event-restful.sock");
        this.server.listen(socketPath);

        return socketPath;
    }

    public stop(): void {
        this.server.close();
    }
}
