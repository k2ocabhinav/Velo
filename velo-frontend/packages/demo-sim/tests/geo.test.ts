import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createRouteMovement, advanceMovement, distanceMeters } from "../src/geo/movement.ts";
import { decodePolyline } from "../src/geo/polyline.ts";
import { getRoute, loadRouteCatalogue } from "../src/geo/route-catalogue.ts";
import type { RandomSource } from "../src/sim/random.ts";

const fixedRandom: RandomSource = { next: () => 0.5 };
const fixtureDirectory = fileURLToPath(new URL("./fixtures/", import.meta.url));

describe("polyline and route catalogue", () => {
  it("decodes the standard precision-five vector", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it("rejects a truncated or empty polyline", () => {
    expect(() => decodePolyline("")).toThrow(/empty/);
    expect(() => decodePolyline("_")).toThrow(/ended/);
  });

  it("loads hand-made fixture data and requires every ordered pair", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    expect(catalogue.pois).toHaveLength(3);
    expect(getRoute(catalogue, "kia-t1", "station").distanceM).toBe(100);
    expect(() => getRoute(catalogue, "station", "unknown")).toThrow(/missing/);
  });

  it("loads the production Bengaluru catalogue and resolves every ordered POI pair", async () => {
    const realDirectory = fileURLToPath(new URL("../data/bengaluru/", import.meta.url));
    const catalogue = await loadRouteCatalogue(realDirectory);

    expect(catalogue.pois.length).toBeGreaterThan(2);
    for (const from of catalogue.pois) {
      for (const to of catalogue.pois) {
        if (from.id !== to.id) {
          expect(getRoute(catalogue, from.id, to.id)).toBeDefined();
        }
      }
    }
  });
});

describe("route movement", () => {
  it("interpolates along the decoded route and limits GPS jitter to three metres", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const movement = createRouteMovement(getRoute(catalogue, "hotel", "kia-t1"), fixedRandom);
    const position = advanceMovement(movement, 0.1, 1, fixedRandom);
    const routeDistance = movement.traveledM * movement.geometricLengthM / movement.distanceM;
    const expected = pointAt(movement.points, movement.cumulativeMeters, routeDistance);

    expect(position.progressM).toBeGreaterThan(0);
    expect(position.progressM).toBeLessThan(100);
    expect(distanceMeters(position, expected)).toBeLessThanOrEqual(3.01);
    expect(position.heading).toBeGreaterThanOrEqual(0);
    expect(position.heading).toBeLessThan(360);
  });

  it("eases at both ends, completes cleanly, and stops at the route endpoint", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const movement = createRouteMovement(getRoute(catalogue, "hotel", "kia-t1"), fixedRandom);
    const first = advanceMovement(movement, 0.1, 1, fixedRandom);
    expect(first.speedKph).toBeLessThan(36);

    let position = first;
    for (let tick = 0; tick < 100 && !position.complete; tick += 1) {
      position = advanceMovement(movement, 3, 20, fixedRandom);
    }
    const endpoint = movement.points[movement.points.length - 1]!;
    expect(position.complete).toBe(true);
    expect(position.progressM).toBe(100);
    expect(position.speedKph).toBe(0);
    expect(position).toMatchObject({ lat: endpoint.lat, lng: endpoint.lng });
  });
});

function pointAt(points: { lat: number; lng: number }[], cumulative: number[], distance: number): { lat: number; lng: number } {
  let segment = 1;
  while (segment < cumulative.length - 1 && cumulative[segment]! < distance) {
    segment += 1;
  }
  const fraction = (distance - cumulative[segment - 1]!) / (cumulative[segment]! - cumulative[segment - 1]!);
  const from = points[segment - 1]!;
  const to = points[segment]!;
  return { lat: from.lat + (to.lat - from.lat) * fraction, lng: from.lng + (to.lng - from.lng) * fraction };
}
