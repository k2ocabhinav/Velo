import { describe, expect, it } from "vitest";
import { poissonDelayMs, SeededRandom, weightedChoice } from "../src/sim/random.ts";
import { pickPoiPair } from "../src/sim/poi-selection.ts";
import type { Poi } from "../src/types.ts";

const pois: Poi[] = [
  { id: "airport", name: "Airport", kind: "airport", lat: 12, lng: 77, weight: 3 },
  { id: "hotel", name: "Hotel", kind: "hotel", lat: 13, lng: 78, weight: 2 },
  { id: "business", name: "Business", kind: "business", lat: 14, lng: 79, weight: 1 },
];

describe("seeded simulation random", () => {
  it("repeats the same seeded sequence", () => {
    const first = new SeededRandom(42);
    const second = new SeededRandom(42);
    expect(Array.from({ length: 10 }, () => first.next())).toEqual(Array.from({ length: 10 }, () => second.next()));
  });

  it("samples Poisson arrivals deterministically and scales by simulation speed", () => {
    const one = new SeededRandom(24);
    const two = new SeededRandom(24);
    const normalDelay = poissonDelayMs(one, 1);
    const fastDelay = poissonDelayMs(two, 4);
    expect(normalDelay).toBeGreaterThanOrEqual(0);
    expect(fastDelay).toBe(normalDelay / 4);
    expect(poissonDelayMs({ next: () => 0 }, 1)).toBe(0);
  });

  it("chooses distinct POIs and includes airport legs", () => {
    const airportRandom = { next: () => 0.1 };
    const [airportOrigin, airportDestination] = pickPoiPair(pois, airportRandom);
    expect([airportOrigin.kind, airportDestination.kind]).toContain("airport");
    expect(airportOrigin.id).not.toBe(airportDestination.id);

    const pair = pickPoiPair(pois, new SeededRandom(5));
    expect(pair[0].id).not.toBe(pair[1].id);
  });

  it("rejects empty and invalid weighted choices", () => {
    expect(() => weightedChoice([], new SeededRandom(1))).toThrow(/positive finite weights/);
    expect(() => poissonDelayMs(new SeededRandom(1), 0)).toThrow(/Speed factor/);
  });
});
