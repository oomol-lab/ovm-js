import url from "node:url";
import http from "node:http";
import { Remitter } from "remitter";


export class Restful {
    private readonly server: http.Server;
    public readonly events = new Remitter();

    public constructor() {
        this.server = http.createServer((request, response) => {
            if (!request.url) {
                return;
            }

            const parsedUrl = url.parse(request.url, true);
            if (parsedUrl.pathname === "/notify" && request.method === "GET") {
                response.statusCode = 200;
                response.end("ok");

                this.events.emit(parsedUrl.query.name as string, {
                    value: parsedUrl.query.value as string,
                });
            } else {
                response.statusCode = 404;
                response.end("Not Found");
            }
        });
    }

    public start(socketPath: string): void {
        this.server.listen(socketPath).once("error", (error) => {
            console.trace(`Failed to listen RESTful server: ${error.message}`);
        });
    }

    public stop(): Promise<void> {
        return new Promise<void>((r) => {
            this.server.close((_err) => {
                r();
            });
        });
    }
}
