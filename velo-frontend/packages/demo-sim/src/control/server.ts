import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ControlStatus } from "../types.ts";

export interface ControlActions {
  status(): ControlStatus;
  pause(): void;
  resume(): void;
  setSpeed(factor: number): void;
}

export class ControlServer {
  private server: Server | null = null;
  private readonly port: number;
  private readonly actions: ControlActions;

  constructor(port: number, actions: ControlActions) {
    this.port = port;
    this.actions = actions;
  }

  async listen(): Promise<void> {
    if (this.server) {
      return;
    }
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
    if (!server?.listening) {
      return;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!isLoopbackAddress(request.socket.remoteAddress)) {
      sendJson(response, 403, { error: "Control server is loopback only" });
      return;
    }
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (request.method === "GET" && path === "/status") {
      sendJson(response, 200, this.actions.status());
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    if (path === "/pause") {
      this.actions.pause();
      sendJson(response, 200, { paused: true });
      return;
    }
    if (path === "/resume") {
      this.actions.resume();
      sendJson(response, 200, { paused: false });
      return;
    }
    if (path === "/speed") {
      try {
        const payload = await readJson(request);
        const factor = payload.factor;
        if (typeof factor !== "number" || !Number.isInteger(factor) || factor < 1 || factor > 20) {
          sendJson(response, 400, { error: "factor must be an integer from 1 to 20" });
          return;
        }
        this.actions.setSpeed(factor);
        sendJson(response, 200, { speed: factor });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid JSON body" });
      }
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024) {
      throw new Error("Request body is too large");
    }
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
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
