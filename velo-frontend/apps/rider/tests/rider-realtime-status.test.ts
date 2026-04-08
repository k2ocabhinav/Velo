import { describe, expect, it } from "vitest";
import { validateRatingInput } from "../app/_lib/ride-forms";
import { getRiderRealtimeStatusText } from "../app/_lib/rider-realtime-status";

describe("rider realtime status helpers", () => {
  it("describes realtime state transitions consistently", () => {
    expect(getRiderRealtimeStatusText("idle", 0)).toBe("Live updates are idle.");
    expect(getRiderRealtimeStatusText("connecting", 0)).toBe("Connecting to live updates...");
    expect(getRiderRealtimeStatusText("connected", 0)).toBe("Live updates connected.");
    expect(getRiderRealtimeStatusText("reconnecting", 0)).toBe("Reconnecting to live updates...");
    expect(getRiderRealtimeStatusText("reconnecting", 2)).toBe("Reconnecting to live updates (attempt 2)...");
    expect(getRiderRealtimeStatusText("error", 1)).toBe("Live updates are degraded. The page will continue using API refreshes.");
  });

  it("validates rider rating input for post-ride feedback", () => {
    expect(validateRatingInput("5")).toEqual({ ok: true, rating: 5 });
    expect(validateRatingInput("1")).toEqual({ ok: true, rating: 1 });
    expect(validateRatingInput("0")).toEqual({
      ok: false,
      error: "Rating must be between 1 and 5.",
    });
    expect(validateRatingInput("4.5")).toEqual({
      ok: false,
      error: "Rating must be a whole number.",
    });
    expect(validateRatingInput("abc")).toEqual({
      ok: false,
      error: "Rating must be a whole number.",
    });
  });
});
