import url from "node:url";
import http from "node:http";


export class Restful {
    private readonly server: http.Server;

    public constructor(
        callback: (name: string, message: string) => void,
    ) {
        this.server = http.createServer((request, response) => {
            if (!request.url) {
                return;
            }

            const parsedUrl = url.parse(request.url, true);
            if (parsedUrl.pathname === "/notify" && request.method === "GET") {
                response.statusCode = 200;
                response.end("ok");

                callback(parsedUrl.query.event as string, parsedUrl.query.message as string);
            } else {
                response.statusCode = 404;
                response.end("Not Found");
            }
        });
    }

    public start(socketPath: string): void {
        this.server.listen(socketPath);
    }

    public stop(): void {
        this.server.close();
    }
}
