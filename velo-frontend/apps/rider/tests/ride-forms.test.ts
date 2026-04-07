import { describe, expect, it, vi } from "vitest";
import {
  mapApiError,
  shouldDisableSubmit,
  validatePointInput,
  validateScheduleInput,
} from "../app/_lib/ride-forms";

describe("ride form helpers", () => {
  it("validates point coordinates and returns GeoJSON point", () => {
    const valid = validatePointInput({ lat: "12.9", lng: "77.5" }, "Pickup");
    expect(valid).toEqual({
      ok: true,
      point: {
        type: "Point",
        coordinates: [77.5, 12.9],
      },
    });

    const invalid = validatePointInput({ lat: "foo", lng: "77.5" }, "Pickup");
    expect(invalid).toEqual({
      ok: false,
      error: "Pickup coordinates must be valid numbers.",
    });
  });

  it("validates scheduled time and rejects past timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));

    expect(validateScheduleInput("   ")).toEqual({
      ok: false,
      error: "Scheduled time is required.",
    });
    expect(validateScheduleInput("2026-04-07T09:00:00.000Z")).toEqual({
      ok: false,
      error: "Scheduled time must be in the future.",
    });

    const future = validateScheduleInput("2026-04-08T11:00:00.000Z");
    expect(future.ok).toBe(true);
    vi.useRealTimers();
  });

  it("maps API error payloads and submit disabled state", () => {
    expect(mapApiError({ error: { message: "Invalid payload" } }, "fallback")).toBe("Invalid payload");
    expect(mapApiError({}, "fallback")).toBe("fallback");

    expect(shouldDisableSubmit(true, ["a"])).toBe(true);
    expect(shouldDisableSubmit(false, ["a", "b"])).toBe(false);
    expect(shouldDisableSubmit(false, ["a", ""])).toBe(true);
  });
});
