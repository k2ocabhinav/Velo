import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DispatchFallback } from "../src/landing/dispatch/DispatchFallback";
import { isDispatchCanvasEligible } from "../src/landing/dispatch/eligibility";
import { generateDispatchCoordinates } from "../src/landing/dispatch/scene/coordinates";
import { SAMPLE_TRIPS } from "../src/landing/dispatch/sample-trips";

describe("landing dispatch illustration", () => {
  it("only enables the canvas for capable desktop users without data or motion constraints", () => {
    const desktop = {
      viewportWidth: 1440,
      finePointer: true,
      reducedMotion: false,
      saveData: false,
      webgl2: true,
    };
    expect(isDispatchCanvasEligible(desktop)).toBe(true);
    expect(isDispatchCanvasEligible({ ...desktop, viewportWidth: 1023 })).toBe(false);
    expect(isDispatchCanvasEligible({ ...desktop, finePointer: false })).toBe(false);
    expect(isDispatchCanvasEligible({ ...desktop, reducedMotion: true })).toBe(false);
    expect(isDispatchCanvasEligible({ ...desktop, saveData: true })).toBe(false);
    expect(isDispatchCanvasEligible({ ...desktop, webgl2: false })).toBe(false);
  });

  it("creates the same neighbourhood from its fixed seed", () => {
    const first = generateDispatchCoordinates();
    const second = generateDispatchCoordinates();
    expect(first).toEqual(second);
    expect(first.buildings).toHaveLength(150);
    expect(first.landmarks.map((landmark) => landmark.label)).toEqual([
      "Airport",
      "Grand Hotel",
      "Harbor Hotel",
      "Business park",
    ]);
    expect(first.vehicles).toHaveLength(6);
    expect(Object.keys(first.routes)).toHaveLength(3);
  });

  it("renders a complete SVG fallback from the shared coordinates", () => {
    const markup = renderToStaticMarkup(createElement(DispatchFallback, { selectedTripId: "09:15" }));
    expect(markup).toContain('data-dispatch-fallback="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Grand Hotel");
    expect(markup).toContain("Business park");
    expect(markup).toContain("Harbor Hotel");
    expect(markup).toContain("polyline");
    expect(markup).not.toContain("<canvas");
  });

  it("keeps globally neutral trip details in 24-hour order", () => {
    expect(SAMPLE_TRIPS.map((trip) => trip.time)).toEqual(["05:40", "09:15", "18:30"]);
    expect(SAMPLE_TRIPS[0].pickup).toBe("Airport");
    expect(SAMPLE_TRIPS[1].dropOff).toBe("Business park");
    expect(SAMPLE_TRIPS.every((trip) => trip.statusSteps.length === 4)).toBe(true);
  });
});
