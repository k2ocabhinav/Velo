export type ReconnectBackoffOptions = {
  initialDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
};

/** Equal-jitter exponential backoff. Delays stay between half and all of the capped interval. */
export class ExponentialReconnectBackoff {
  private attempt = 0;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly random: () => number;

  constructor({ initialDelayMs = 1_000, maxDelayMs = 60_000, random = Math.random }: ReconnectBackoffOptions = {}) {
    this.initialDelayMs = Math.max(1, initialDelayMs);
    this.maxDelayMs = Math.max(this.initialDelayMs, maxDelayMs);
    this.random = random;
  }

  nextDelay(): number {
    this.attempt += 1;
    const exponent = Math.min(this.attempt - 1, 52);
    const interval = Math.min(this.initialDelayMs * 2 ** exponent, this.maxDelayMs);
    const randomValue = Math.min(1, Math.max(0, this.random()));
    return Math.round(interval / 2 + randomValue * (interval / 2));
  }

  reset(): void {
    this.attempt = 0;
  }

  get attempts(): number {
    return this.attempt;
  }
}
