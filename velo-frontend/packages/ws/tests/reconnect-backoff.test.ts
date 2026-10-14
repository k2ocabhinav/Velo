import { describe, expect, it, vi } from "vitest";
import { ExponentialReconnectBackoff } from "../src/reconnect-backoff";

describe("exponential reconnect backoff", () => {
  it("doubles intervals and adds equal jitter", () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1);
    const backoff = new ExponentialReconnectBackoff({ initialDelayMs: 1_000, maxDelayMs: 8_000, random });

    expect(backoff.nextDelay()).toBe(500);
    expect(backoff.nextDelay()).toBe(2_000);
    expect(backoff.attempts).toBe(2);
  });

  it("caps jittered delays at the configured maximum", () => {
    const backoff = new ExponentialReconnectBackoff({ initialDelayMs: 1_000, maxDelayMs: 2_500, random: () => 1 });

    expect(backoff.nextDelay()).toBe(1_000);
    expect(backoff.nextDelay()).toBe(2_000);
    expect(backoff.nextDelay()).toBe(2_500);
    expect(backoff.nextDelay()).toBe(2_500);
  });

  it("resets the attempt after a successful connection", () => {
    const backoff = new ExponentialReconnectBackoff({ initialDelayMs: 1_000, maxDelayMs: 8_000, random: () => 0.5 });
    backoff.nextDelay();
    backoff.nextDelay();
    backoff.reset();

    expect(backoff.attempts).toBe(0);
    expect(backoff.nextDelay()).toBe(750);
  });
});
