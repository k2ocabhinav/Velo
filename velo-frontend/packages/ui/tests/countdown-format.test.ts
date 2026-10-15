import { describe, expect, it } from "vitest";
import { formatCountdownDuration } from "../src/feedback/countdown-format";

describe("formatCountdownDuration", () => {
  it("keeps short countdowns in mm:ss format", () => {
    expect(formatCountdownDuration(125)).toBe("02:05");
    expect(formatCountdownDuration(59)).toBe("00:59");
  });

  it("formats hour-long countdowns as hours and minutes", () => {
    expect(formatCountdownDuration(2 * 60 * 60 + 5 * 60)).toBe("2 h 5 min");
    expect(formatCountdownDuration(60 * 60)).toBe("1 h");
  });

  it("rounds multi-day countdowns up to a humane day count", () => {
    expect(formatCountdownDuration(7 * 24 * 60 * 60 - 60)).toBe("7 days");
    expect(formatCountdownDuration(24 * 60 * 60)).toBe("1 day");
  });
});
