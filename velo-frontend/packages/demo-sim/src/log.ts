import type { Clock } from "./sim/clock.ts";
import type { TenantSlug } from "./types.ts";

interface RateLimitEntry {
  lastLoggedAt: number;
  suppressed: number;
}

export class SimLogger {
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly errors = new Map<TenantSlug, string[]>();
  private readonly clock: Clock;
  private readonly writeLine: (line: string) => void;
  private readonly errorIntervalMs: number;

  constructor(
    clock: Clock,
    writeLine: (line: string) => void = (line) => console.log(line),
    errorIntervalMs = 10_000,
  ) {
    this.clock = clock;
    this.writeLine = writeLine;
    this.errorIntervalMs = errorIntervalMs;
  }

  event(tenant: TenantSlug, actor: string, action: string, detail?: string | number): void {
    const suffix = detail === undefined ? "" : ` ${formatSegment(String(detail))}`;
    this.writeLine(`[sim] ${tenant} ${formatSegment(actor)} ${formatSegment(action)}${suffix}`);
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
    const recent = this.errors.get(tenant) ?? [];
    recent.push(line);
    this.errors.set(tenant, recent.slice(-10));
  }

  recentErrors(tenant: TenantSlug): string[] {
    return [...(this.errors.get(tenant) ?? [])];
  }
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
