import type { Poi } from "../types.ts";
import type { RandomSource } from "./random.ts";
import { weightedChoice } from "./random.ts";

export interface PoiPairOptions {
  airportShare?: number;
  hotspots?: readonly string[];
  from?: Poi;
  to?: Poi;
  near?: Poi;
  preferIntraCity?: boolean;
  intraCityPairs?: readonly [Poi, Poi][];
}

export function pickPoiPair(pois: Poi[], random: RandomSource, options: PoiPairOptions = {}): [Poi, Poi] {
  if (pois.length < 2) {
    throw new RangeError("The route catalogue needs at least two POIs");
  }
  const weighted = pois.map((poi) => ({
    ...poi,
    weight: poi.weight * (options.hotspots?.includes(poi.id) ? 4 : 1),
  }));
  const from = options.from;
  const to = options.to;
  if (from && to) {
    if (from.id === to.id) throw new RangeError("Pickup and drop-off POIs must differ");
    return [from, to];
  }
  if (from) return [from, chooseOther(weighted, from.id, random)];
  if (to) return [chooseOther(weighted, to.id, random), to];

  if (options.preferIntraCity && options.intraCityPairs && options.intraCityPairs.length > 0) {
    const near = options.near;
    const anchoredPairs = near
      ? options.intraCityPairs.filter(([pickup]) => pickup.id === near.id)
      : options.intraCityPairs;
    const candidates = anchoredPairs.length > 0 ? anchoredPairs : options.intraCityPairs;
    return candidates[Math.floor(random.next() * candidates.length)]!;
  }

  if (options.near) return [options.near, chooseOther(weighted, options.near.id, random)];

  const airports = pois.filter((poi) => poi.kind === "airport");
  const otherPois = pois.filter((poi) => poi.kind !== "airport");
  if (random.next() < (options.airportShare ?? 0.4) && airports.length > 0 && otherPois.length > 0) {
    const airport = choose(airports, options.hotspots, random);
    const other = choose(otherPois, options.hotspots, random);
    return random.next() < 0.5 ? [airport, other] : [other, airport];
  }
  const pickup = choose(pois, options.hotspots, random);
  const dropOff = chooseOther(weighted, pickup.id, random);
  return [pickup, dropOff];
}

function chooseOther(pois: Poi[], excludeId: string, random: RandomSource): Poi {
  return choose(pois.filter((poi) => poi.id !== excludeId), undefined, random);
}

function choose(pois: Poi[], hotspots: readonly string[] | undefined, random: RandomSource): Poi {
  const weighted = pois.map((poi) => ({ ...poi, weight: poi.weight * (hotspots?.includes(poi.id) ? 4 : 1) }));
  return weightedChoice(weighted, random);
}
