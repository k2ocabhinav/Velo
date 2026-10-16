import { describe, expect, it } from "vitest";
import { loginStaggerDelayMs, loginStaggerIntervalMs } from "../src/sim/login-stagger.ts";

describe("simulator login stagger", () => {
  it("uses the configured IP limit and the 600 ms contract floor", () => {
    expect(loginStaggerIntervalMs()).toBe(600);
    expect(loginStaggerIntervalMs({ windowMs: 60_000, ipLimit: 30 })).toBe(2_000);
    expect(loginStaggerIntervalMs({ windowMs: 60_000, ipLimit: 240 })).toBe(600);
  });

  it("waits only for the remaining interval", () => {
    expect(loginStaggerDelayMs(null)).toBe(0);
    expect(loginStaggerDelayMs(250)).toBe(350);
    expect(loginStaggerDelayMs(600)).toBe(0);
    expect(loginStaggerDelayMs(1_000)).toBe(0);
  });

  it("starts all 32 local demo accounts below the configured IP limit", () => {
    const starts: number[] = [];
    for (let index = 0; index < 32; index += 1) {
      const lastStart = starts.at(-1);
      const elapsed = lastStart === undefined ? null : 0;
      const nextStart = (lastStart ?? 0) + loginStaggerDelayMs(elapsed);
      starts.push(nextStart);
    }

    expect(starts[31] - starts[0]).toBe(31 * 600);
    expect(starts.every((start, index) => index === 0 || start - starts[index - 1]! >= 600)).toBe(true);
    expect(starts.at(-1)!).toBeLessThan(60_000);
  });

  it("rejects invalid configured limits", () => {
    expect(() => loginStaggerIntervalMs({ windowMs: 60_000, ipLimit: 0 })).toThrow(RangeError);
    expect(() => loginStaggerDelayMs(-1)).toThrow(RangeError);
  });
});
