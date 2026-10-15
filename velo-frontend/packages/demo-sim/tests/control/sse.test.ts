import { createServer, get, type IncomingHttpHeaders, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { EventHub, formatSseFrame, handleSse } from "../../src/control/event-hub.ts";

interface Waiter {
  predicate: (body: string) => boolean;
  resolve: (body: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface SseClient {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
  waitFor(predicate: (body: string) => boolean, timeoutMs?: number): Promise<string>;
  close(): void;
}

const servers: Server[] = [];

function startServer(hub: EventHub, heartbeatMs?: number): Promise<number> {
  const server = createServer((req, res) => {
    if (req.url === "/events") {
      handleSse(req, res, hub, heartbeatMs === undefined ? {} : { heartbeatMs });
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  servers.push(server);

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address !== null ? address.port : 0);
    });
  });
}

function openSse(port: number, headers: Record<string, string> = {}): Promise<SseClient> {
  return new Promise((resolve, reject) => {
    const request = get({ host: "127.0.0.1", port, path: "/events", headers }, (res) => {
      let body = "";
      const waiters: Waiter[] = [];

      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
        for (let index = waiters.length - 1; index >= 0; index -= 1) {
          const waiter = waiters[index];
          if (waiter && waiter.predicate(body)) {
            clearTimeout(waiter.timer);
            waiters.splice(index, 1);
            waiter.resolve(body);
          }
        }
      });

      resolve({
        statusCode: res.statusCode ?? 0,
        headers: res.headers,
        get body() {
          return body;
        },
        waitFor(predicate, timeoutMs = 2_000) {
          return new Promise<string>((resolveWaiter, rejectWaiter) => {
            if (predicate(body)) {
              resolveWaiter(body);
              return;
            }
            const timer = setTimeout(
              () => rejectWaiter(new Error(`timed out waiting for SSE frame; received: ${JSON.stringify(body)}`)),
              timeoutMs,
            );
            waiters.push({ predicate, resolve: resolveWaiter, reject: rejectWaiter, timer });
          });
        },
        close() {
          request.destroy();
        },
      });
    });
    request.on("error", reject);
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe("handleSse", () => {
  it("streams published events as id/event/data frames", async () => {
    const hub = new EventHub();
    const port = await startServer(hub);
    const client = await openSse(port);

    expect(client.statusCode).toBe(200);
    expect(String(client.headers["content-type"])).toContain("text/event-stream");

    hub.publish({ type: "trip.requested", tenant: "default", message: "hello", data: { rideRequestId: 7 } });
    const body = await client.waitFor((received) => received.includes("event: trip.requested"));

    expect(body).toContain("id: 1");
    expect(body).toContain("event: trip.requested");
    const dataLine = body.split("\n").find((line) => line.startsWith("data: "));
    expect(dataLine).toBeDefined();
    expect(JSON.parse((dataLine as string).slice("data: ".length))).toMatchObject({
      id: 1,
      type: "trip.requested",
      message: "hello",
      data: { rideRequestId: 7 },
    });

    client.close();
  });

  it("does not replay history without a Last-Event-ID", async () => {
    const hub = new EventHub();
    hub.publish({ type: "old", message: "before" });
    const port = await startServer(hub);
    const client = await openSse(port);

    await client.waitFor((received) => received.includes(": connected"));
    expect(client.body).not.toContain("id:");

    client.close();
  });

  it("replays events newer than Last-Event-ID", async () => {
    const hub = new EventHub();
    hub.publish({ type: "a", message: "1" });
    hub.publish({ type: "b", message: "2" });
    hub.publish({ type: "c", message: "3" });

    const port = await startServer(hub);
    const client = await openSse(port, { "Last-Event-ID": "1" });
    const body = await client.waitFor((received) => received.includes("id: 3"));

    expect(body).not.toContain("id: 1\n");
    expect(body).toContain("id: 2");
    expect(body).toContain("id: 3");

    client.close();
  });

  it("sends a periodic heartbeat comment", async () => {
    const hub = new EventHub();
    const port = await startServer(hub, 40);
    const client = await openSse(port);

    const body = await client.waitFor((received) => received.includes(": ping"));

    expect(body).toContain(": ping");
    client.close();
  });

  it("stops writing once the client disconnects", async () => {
    const hub = new EventHub();
    const port = await startServer(hub, 40);
    const client = await openSse(port);

    hub.publish({ type: "a", message: "1" });
    await client.waitFor((received) => received.includes("id: 1"));
    client.close();

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(() => hub.publish({ type: "b", message: "2" })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(client.body).not.toContain("id: 2");
  });
});

describe("formatSseFrame", () => {
  it("splits multi-line data into separate data lines", () => {
    expect(formatSseFrame({ id: 5, event: "config.changed", data: "a\nb\nc" })).toBe(
      "id: 5\nevent: config.changed\ndata: a\ndata: b\ndata: c\n\n",
    );
  });

  it("normalises CRLF and CR line endings", () => {
    expect(formatSseFrame({ data: "a\r\nb\rc" })).toBe("data: a\ndata: b\ndata: c\n\n");
  });

  it("omits absent id and event fields", () => {
    expect(formatSseFrame({ data: "x" })).toBe("data: x\n\n");
  });
});
