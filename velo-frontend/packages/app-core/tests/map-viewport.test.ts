import { describe, expect, it } from "vitest";
import { shouldFitMapBounds, shouldFollowDriverLocation } from "../src/map-viewport";

describe("live map viewport", () => {
  it("fits initial bounds once when locations are available", () => {
    expect(shouldFitMapBounds(false, 2)).toBe(true);
    expect(shouldFitMapBounds(true, 3)).toBe(false);
    expect(shouldFitMapBounds(false, 0)).toBe(false);
  });

  it("follows location updates only when follow mode is enabled", () => {
    expect(shouldFollowDriverLocation(true, true)).toBe(true);
    expect(shouldFollowDriverLocation(false, true)).toBe(false);
    expect(shouldFollowDriverLocation(true, false)).toBe(false);
  });
});
