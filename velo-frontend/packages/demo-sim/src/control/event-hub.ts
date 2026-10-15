import type { IncomingMessage, ServerResponse } from "node:http";

export interface SimEvent {
  id: number;
  at: string;
  tenant?: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface SseFrame {
  id?: number;
  event?: string;
  data: string;
}

export interface SseOptions {
  heartbeatMs?: number;
}

const RING_CAPACITY = 300;
const DEFAULT_HEARTBEAT_MS = 15_000;

/** In-process pub/sub with a bounded replay buffer for the SSE stream. */
export class EventHub {
  private nextId = 1;
  private readonly buffer: SimEvent[] = [];
  private readonly subscribers = new Set<(event: SimEvent) => void>();

  publish(input: Omit<SimEvent, "id" | "at">): SimEvent {
    const event: SimEvent = { id: this.nextId, at: new Date().toISOString(), ...input };
    this.nextId += 1;

    this.buffer.push(event);
    if (this.buffer.length > RING_CAPACITY) this.buffer.shift();

    for (const subscriber of [...this.subscribers]) {
      try {
        subscriber(event);
      } catch {
        // A broken subscriber must never block the others.
      }
    }

    return event;
  }

  subscribe(fn: (event: SimEvent) => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  recent(sinceId?: number): SimEvent[] {
    if (sinceId === undefined) return [...this.buffer];
    return this.buffer.filter((event) => event.id > sinceId);
  }
}

/** Formats one SSE frame, splitting any newline in `data` into a separate `data:` line. */
export function formatSseFrame(frame: SseFrame): string {
  const lines: string[] = [];
  if (frame.id !== undefined) lines.push(`id: ${frame.id}`);
  if (frame.event !== undefined) lines.push(`event: ${frame.event}`);
  for (const line of frame.data.replace(/\r\n?/g, "\n").split("\n")) lines.push(`data: ${line}`);
  return `${lines.join("\n")}\n\n`;
}

/** Streams hub events to an HTTP client as Server-Sent Events, replaying after `Last-Event-ID`. */
export function handleSse(
  req: IncomingMessage,
  res: ServerResponse,
  hub: EventHub,
  options: SseOptions = {},
): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const lastEventId = readLastEventId(req.headers["last-event-id"]);
  if (lastEventId !== undefined) {
    for (const event of hub.recent(lastEventId)) writeEvent(res, event);
  }

  let closed = false;
  const unsubscribe = hub.subscribe((event) => {
    if (!closed) writeEvent(res, event);
  });

  const heartbeat = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
  heartbeat.unref();

  res.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  });
}

function writeEvent(res: ServerResponse, event: SimEvent): void {
  res.write(formatSseFrame({ id: event.id, event: event.type, data: JSON.stringify(event) }));
}

function readLastEventId(header: string | string[] | undefined): number | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
