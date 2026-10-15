import type { Clock } from "./sim/clock.ts";
import type { ControlRecentError, TenantSlug } from "./types.ts";

export interface LogEvent {
  tenant?: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

interface RateLimitEntry {
  lastLoggedAt: number;
  suppressed: number;
}

export class SimLogger {
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly errors: ControlRecentError[] = [];
  private readonly clock: Clock;
  private readonly writeLine: (line: string) => void;
  private readonly errorIntervalMs: number;
  private publishEvent?: (event: LogEvent) => void;

  constructor(
    clock: Clock,
    writeLine: (line: string) => void = (line) => console.log(line),
    errorIntervalMs = 10_000,
    publishEvent?: (event: LogEvent) => void,
  ) {
    this.clock = clock;
    this.writeLine = writeLine;
    this.errorIntervalMs = errorIntervalMs;
    this.publishEvent = publishEvent;
  }

  setEventPublisher(publishEvent: (event: LogEvent) => void): void {
    this.publishEvent = publishEvent;
  }

  event(tenant: TenantSlug, actor: string, action: string, detail?: string | number): void {
    const suffix = detail === undefined ? "" : ` ${formatSegment(String(detail))}`;
    this.writeLine(`[sim] ${tenant} ${formatSegment(actor)} ${formatSegment(action)}${suffix}`);
    this.publish({
      tenant,
      type: eventType(action),
      message: `${formatSegment(actor)} ${formatSegment(action)}${suffix}`,
      data: { actor, action, ...(detail === undefined ? {} : { detail }) },
    });
  }

  error(tenant: TenantSlug, actor: string, context: string, error: unknown): void {
    const description = describeError(error);
    const key = `${tenant}:${actor}:${context}`;
    const now = this.clock.now();
    const previous = this.rateLimits.get(key);
    if (previous && now - previous.lastLoggedAt < this.errorIntervalMs) {
      previous.suppressed += 1;
      return;
    }
    const suppressed = previous?.suppressed ?? 0;
    this.rateLimits.set(key, { lastLoggedAt: now, suppressed: 0 });
    const suffix = suppressed > 0 ? ` (${suppressed} repeated)` : "";
    const line = `${formatSegment(context)}: ${description}${suffix}`;
    this.writeLine(`[sim] ${tenant} ${formatSegment(actor)} error ${line}`);
    this.errors.push({ at: new Date(now).toISOString(), message: `${tenant} ${formatSegment(actor)} ${line}` });
    if (this.errors.length > 20) this.errors.shift();
    this.publish({ tenant, type: "simulator.error", message: line, data: { actor, context } });
  }

  recentErrors(): ControlRecentError[] {
    return this.errors.map((error) => ({ ...error }));
  }

  private publish(event: LogEvent): void {
    try {
      this.publishEvent?.(event);
    } catch {
      // Event streaming must not interfere with simulator behavior.
    }
  }
}

function eventType(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized === "online") return "driver.online";
  if (normalized === "offline") return "driver.offline";
  if (normalized.includes("state") || normalized.includes("thinking") || normalized.includes("repositioning")) return "driver.state";
  if (normalized === "requested") return "trip.requested";
  if (normalized === "accepted") return "trip.accepted";
  if (normalized.includes("started")) return "trip.started";
  if (normalized.includes("completed")) return "trip.completed";
  if (normalized.includes("cancel") || normalized.includes("expired") || normalized.includes("closed")) return "trip.cancelled";
  if (normalized.includes("ignored offer") || normalized.includes("declined")) return "offer.declined";
  if (normalized.includes("config") || normalized === "paused" || normalized === "resumed" || normalized === "speed set") return "config.changed";
  if (normalized.includes("action accepted")) return "action.accepted";
  if (normalized.includes("reconnect")) return "bot.reconnecting";
  if (normalized.includes("connected")) return "bot.connected";
  if (normalized.includes("ready")) return "simulator.ready";
  if (normalized.includes("retry")) return "simulator.retry";
  return "simulator.event";
}

function describeError(error: unknown): string {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return `API ${error.status}`;
  }
  if (error instanceof Error) {
    return formatSegment(error.message || error.name).slice(0, 160);
  }
  return "unknown error";
}

function formatSegment(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}
