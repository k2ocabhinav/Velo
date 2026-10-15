import { describe, expect, it } from "vitest";
import type { Map as LeafletMap } from "leaflet";
import { getFleetDriverVisualState, interpolateFleetPosition, shortestHeadingDelta } from "../src/composed/fleet-map/animation";
import { fitFleetMap, focusZoom } from "../src/composed/fleet-map/camera";

describe("fleet map marker animation", () => {
  it("maps driver statuses to semantic marker tones and preserves stale state", () => {
    expect(getFleetDriverVisualState("AVAILABLE", false)).toEqual({ status: "AVAILABLE", stale: false, tone: "available" });
    expect(getFleetDriverVisualState("EN_ROUTE_TO_PICKUP", true)).toEqual({ status: "EN_ROUTE_TO_PICKUP", stale: true, tone: "to-pickup" });
    expect(getFleetDriverVisualState("ON_TRIP", false)).toEqual({ status: "ON_TRIP", stale: false, tone: "on-trip" });
  });

  it("interpolates a position linearly and follows the shortest heading turn", () => {
    expect(interpolateFleetPosition(
      { lat: 12, lng: 77, heading: 350 },
      { lat: 14, lng: 79, heading: 10 },
      0.5,
    )).toEqual({ lat: 13, lng: 78, heading: 0 });
    expect(shortestHeadingDelta(5, 355)).toBe(-10);
  });

  it("clamps tween progress at both ends", () => {
    const start = { lat: 12, lng: 77, heading: 40 };
    const end = { lat: 14, lng: 79, heading: 80 };
    expect(interpolateFleetPosition(start, end, -1)).toEqual(start);
    expect(interpolateFleetPosition(start, end, 2)).toEqual(end);
  });
});

describe("fleet map camera", () => {
  it("focuses row selections at context zoom while preserving closer views", () => {
    expect(focusZoom(12)).toBe(14);
    expect(focusZoom(14)).toBe(14);
    expect(focusZoom(17)).toBe(17);
  });

  it("refreshes the measured map size before fitting the first snapshot", () => {
    const calls: string[] = [];
    const map = {
      invalidateSize: () => { calls.push("invalidateSize"); },
      setView: () => { calls.push("setView"); },
      fitBounds: () => { calls.push("fitBounds"); },
    };

    fitFleetMap(map as unknown as Pick<LeafletMap, "invalidateSize" | "setView" | "fitBounds">, [[12.9, 77.5], [13.1, 77.7]]);

    expect(calls).toEqual(["invalidateSize", "fitBounds"]);
  });
});
