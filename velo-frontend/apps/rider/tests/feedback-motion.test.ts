import { describe, expect, it } from "vitest";
import { MOTION_SAFE_PULSE_CLASS, MOTION_SAFE_SPIN_CLASS } from "@velo/ui/feedback";

describe("shared loading motion", () => {
  it("gates skeleton and spinner animations behind motion-safe", () => {
    expect(MOTION_SAFE_PULSE_CLASS).toBe("motion-safe:animate-pulse");
    expect(MOTION_SAFE_SPIN_CLASS).toBe("motion-safe:animate-spin");
  });
});
