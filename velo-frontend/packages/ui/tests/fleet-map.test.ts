import { describe, expect, it } from "vitest";
import type { Map as LeafletMap } from "leaflet";
import { getFleetDriverVisualState, interpolateFleetPosition, shortestHeadingDelta } from "../src/composed/fleet-map/animation";
import {
  DEFAULT_CENTER,
  fitFleetMap,
  fleetMapCameraPoints,
  fleetMapCameraView,
  focusZoom,
  type FleetMapPoint,
} from "../src/composed/fleet-map/camera";
import { formatFleetLastUpdate } from "../src/composed/fleet-map/format";
import type { FleetMapDriver, FleetMapRide } from "../src/composed/fleet-map/types";

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

type FakeLeafletMap = Pick<LeafletMap, "invalidateSize" | "setView" | "fitBounds" | "getZoom" | "setZoom">;

function fakeMap(zoom: number): { map: FakeLeafletMap; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    map: {
      invalidateSize: () => { calls.push("invalidateSize"); },
      setView: () => { calls.push("setView"); },
      fitBounds: () => { calls.push("fitBounds"); },
      getZoom: () => zoom,
      setZoom: (next: number) => { calls.push(`setZoom:${next}`); },
    } as unknown as FakeLeafletMap,
  };
}

function driver(driverId: number, lat: number, lng: number): FleetMapDriver {
  return {
    driverId,
    name: `Driver ${driverId}`,
    vehiclePlate: `KA01AA${driverId}`,
    rating: 4.8,
    status: "AVAILABLE",
    lat,
    lng,
    stale: false,
    simulated: false,
  };
}

function ride(rideRequestId: number, pickup: FleetMapPoint, dropOff: FleetMapPoint): FleetMapRide {
  return {
    rideId: null,
    rideRequestId,
    status: "REQUESTED",
    riderName: "Rider",
    pickup: { lat: pickup[0], lng: pickup[1] },
    dropOff: { lat: dropOff[0], lng: dropOff[1] },
    simulated: false,
  };
}

describe("fleet map camera", () => {
  it("focuses row selections at context zoom while preserving closer views", () => {
    expect(focusZoom(12)).toBe(14);
    expect(focusZoom(14)).toBe(14);
    expect(focusZoom(17)).toBe(17);
  });

  it("frames drivers and open-trip pickups, adding a drop-off only for the selected trip", () => {
    const drivers = [driver(1, 12.97, 77.59)];
    const rides = [
      ride(31, [12.98, 77.6], [13.1989, 77.7068]),
      ride(32, [12.95, 77.62], [12.9, 77.68]),
    ];

    expect(fleetMapCameraPoints({ drivers, rides })).toEqual([[12.97, 77.59], [12.98, 77.6], [12.95, 77.62]]);
    expect(fleetMapCameraPoints({ drivers, rides, selection: { type: "ride", id: 32 } })).toEqual([
      [12.97, 77.59], [12.98, 77.6], [12.95, 77.62], [12.9, 77.68],
    ]);
    expect(fleetMapCameraPoints({ drivers, rides, selection: { type: "driver", id: 1 } })).toEqual([
      [12.97, 77.59], [12.98, 77.6], [12.95, 77.62],
    ]);
  });

  it("centres the camera on one cluster instead of zooming past it", () => {
    expect(fleetMapCameraView([])).toEqual({ kind: "center", center: DEFAULT_CENTER, zoom: 12 });
    expect(fleetMapCameraView([[12.97, 77.59]])).toEqual({ kind: "center", center: [12.97, 77.59], zoom: 13 });

    const cluster: FleetMapPoint[] = [[12.97, 77.59], [12.975, 77.6]];
    expect(fleetMapCameraView(cluster)).toEqual({
      kind: "center",
      center: [(12.97 + 12.975) / 2, (77.59 + 77.6) / 2],
      zoom: 13,
    });
  });

  it("fits bounds when the fleet is spread out", () => {
    const points: FleetMapPoint[] = [[12.9, 77.5], [13.2, 77.71]];
    expect(fleetMapCameraView(points)).toEqual({ kind: "bounds", points });
  });

  it("refreshes the measured map size before fitting the first snapshot", () => {
    const { map, calls } = fakeMap(12);

    fitFleetMap(map, [[12.9, 77.5], [13.2, 77.71]]);

    expect(calls).toEqual(["invalidateSize", "fitBounds"]);
  });

  it("never zooms out further than the city view", () => {
    const { map, calls } = fakeMap(9);

    fitFleetMap(map, [[12.9, 77.5], [13.6, 78.1]]);

    expect(calls).toEqual(["invalidateSize", "fitBounds", "setZoom:11"]);
  });

  it("recentres a single cluster without a bounds fit", () => {
    const { map, calls } = fakeMap(9);

    fitFleetMap(map, [[12.97, 77.59], [12.975, 77.6]]);

    expect(calls).toEqual(["invalidateSize", "setView"]);
  });
});

describe("fleet location age labels", () => {
  it("uses quiet last-seen copy for stale positions", () => {
    const now = Date.parse("2026-10-16T12:02:00Z");
    expect(formatFleetLastUpdate("2026-10-16T12:00:00Z", true, now)).toBe("Last seen 2 min ago");
    expect(formatFleetLastUpdate("2026-10-16T12:01:48Z", false, now)).toBe("Updated 12 s ago");
    expect(formatFleetLastUpdate("not-a-time", true, now)).toBe("Last seen time unavailable");
  });
});
