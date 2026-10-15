import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dispatchControlRequest, type ControlActions } from "./http-handlers.ts";

export class ControlServer {
  private server: Server | null = null;
  private readonly port: number;
  private readonly actions: ControlActions;

  constructor(port: number, actions: ControlActions) {
    this.port = port;
    this.actions = actions;
  }

  get listeningPort(): number {
    const address = this.server?.address();
    return typeof address === "object" && address !== null ? (address as AddressInfo).port : this.port;
  }

  async listen(): Promise<void> {
    if (this.server) return;
    const server = createServer((request, response) => {
      void this.handle(request, response);
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server?.listening) return;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!isLoopbackAddress(request.socket.remoteAddress)) {
      sendJson(response, 403, { error: "Control server is loopback only" });
      return;
    }
    const host = request.headers.host?.toLowerCase();
    const allowedHosts = new Set([`127.0.0.1:${this.listeningPort}`, `localhost:${this.listeningPort}`]);
    if (!host || !allowedHosts.has(host)) {
      sendJson(response, 403, { error: "Control server Host is invalid" });
      return;
    }
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== `http://${host}`) {
      sendJson(response, 403, { error: "Control server Origin is invalid" });
      return;
    }
    if (request.method !== "GET") {
      const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "application/json" || request.headers["x-velo-sim"] !== "1") {
        sendJson(response, 403, { error: "Control writes require JSON and X-Velo-Sim: 1" });
        return;
      }
    }
    await dispatchControlRequest(request, response, this.actions);
  }
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}
