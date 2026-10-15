import type { Poi } from "../types.ts";
import type { RandomSource } from "./random.ts";
import { weightedChoice } from "./random.ts";

export function pickPoiPair(pois: Poi[], random: RandomSource): [Poi, Poi] {
  if (pois.length < 2) {
    throw new RangeError("The route catalogue needs at least two POIs");
  }
  const airports = pois.filter((poi) => poi.kind === "airport");
  const otherPois = pois.filter((poi) => poi.kind !== "airport");
  if (random.next() < 0.4 && airports.length > 0 && otherPois.length > 0) {
    const airport = airports[Math.floor(random.next() * airports.length)]!;
    const other = weightedChoice(otherPois, random);
    return random.next() < 0.5 ? [airport, other] : [other, airport];
  }
  const pickup = weightedChoice(pois, random);
  const dropOff = weightedChoice(pois.filter((poi) => poi.id !== pickup.id), random);
  return [pickup, dropOff];
}
