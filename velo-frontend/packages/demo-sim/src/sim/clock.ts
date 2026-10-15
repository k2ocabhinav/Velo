export interface Clock {
  now(): number;
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
  every(milliseconds: number, callback: () => void): () => void;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new Error("Operation aborted"));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, Math.max(0, milliseconds));
      const abort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(signal?.reason ?? new Error("Operation aborted"));
      };
      signal?.addEventListener("abort", abort, { once: true });
    });
  }

  every(milliseconds: number, callback: () => void): () => void {
    const timer = setInterval(callback, milliseconds);
    return () => clearInterval(timer);
  }
}

export class SimulationClock {
  private readonly clock: Clock;
  private readonly speed: () => number;

  constructor(clock: Clock, speed: () => number) {
    this.clock = clock;
    this.speed = speed;
  }

  async sleep(simulatedMilliseconds: number, signal?: AbortSignal): Promise<void> {
    let remaining = simulatedMilliseconds;
    while (remaining > 0) {
      const speedFactor = this.speed();
      const elapsedRealMs = Math.min(100, remaining / speedFactor);
      await this.clock.sleep(elapsedRealMs, signal);
      remaining -= elapsedRealMs * speedFactor;
    }
  }
}
