import type { GeoPoint, RouteEntry } from "../types.ts";
import type { RandomSource } from "../sim/random.ts";
import { decodePolyline, type Coordinate } from "./polyline.ts";

const EARTH_RADIUS_M = 6_371_000;

export interface RouteMovement {
  points: Coordinate[];
  cumulativeMeters: number[];
  geometricLengthM: number;
  distanceM: number;
  durationS: number;
  traveledM: number;
  elapsedS: number;
  variationPhase: number;
}

export interface MovementPosition extends GeoPoint {
  heading: number;
  speedKph: number;
  progressM: number;
  complete: boolean;
}

export function createRouteMovement(route: RouteEntry, random: RandomSource): RouteMovement {
  const points = decodePolyline(route.polyline);
  if (points.length < 2) {
    throw new TypeError("A movement route must contain at least two coordinates");
  }
  const cumulativeMeters = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulativeMeters.push(cumulativeMeters[index - 1]! + distanceMeters(points[index - 1]!, points[index]!));
  }
  const geometricLengthM = cumulativeMeters[cumulativeMeters.length - 1]!;
  if (geometricLengthM <= 0) {
    throw new TypeError("A movement route must have non-zero length");
  }
  return {
    points,
    cumulativeMeters,
    geometricLengthM,
    distanceM: route.distanceM,
    durationS: route.durationS,
    traveledM: 0,
    elapsedS: 0,
    variationPhase: random.next() * Math.PI * 2,
  };
}

export function advanceMovement(
  movement: RouteMovement,
  elapsedRealSeconds: number,
  speedFactor: number,
  random: RandomSource,
): MovementPosition {
  if (!Number.isFinite(elapsedRealSeconds) || elapsedRealSeconds < 0 || !Number.isFinite(speedFactor) || speedFactor < 1) {
    throw new RangeError("Movement time and speed factor must be valid positive numbers");
  }
  if (!Number.isFinite(movement.distanceM) || movement.distanceM <= 0 || movement.durationS <= 0) {
    throw new RangeError("Movement route metrics must be positive");
  }

  const remainingM = movement.distanceM - movement.traveledM;
  if (remainingM <= 2) {
    movement.traveledM = movement.distanceM;
    movement.elapsedS += elapsedRealSeconds * speedFactor;
    const endpoint = movement.points[movement.points.length - 1]!;
    return { lat: endpoint.lat, lng: endpoint.lng, heading: bearing(endpoint, endpoint), speedKph: 0, progressM: movement.distanceM, complete: true };
  }
  const baseSpeedMps = movement.distanceM / movement.durationS;
  const variation = 1 + 0.15 * Math.sin(movement.elapsedS / 31 + movement.variationPhase);
  const unconstrainedMeters = baseSpeedMps * variation * speedFactor * elapsedRealSeconds;
  const midpoint = movement.traveledM + Math.min(remainingM, unconstrainedMeters) / 2;
  const easing = Math.min(smoothstep(midpoint / 150), smoothstep(remainingM / 150));
  const traveledThisStep = Math.min(remainingM, unconstrainedMeters * easing);
  movement.traveledM += traveledThisStep;
  movement.elapsedS += elapsedRealSeconds * speedFactor;

  const complete = movement.traveledM >= movement.distanceM;
  const currentDistance = complete ? movement.geometricLengthM : movement.traveledM * movement.geometricLengthM / movement.distanceM;
  const current = pointAtDistance(movement, currentDistance);
  const next = pointAtDistance(movement, Math.min(movement.geometricLengthM, currentDistance + 15));
  const position = complete ? current : jitter(current, random, 3);

  return {
    lat: position.lat,
    lng: position.lng,
    heading: bearing(current, next),
    speedKph: complete ? 0 : baseSpeedMps * variation * speedFactor * easing * 3.6,
    progressM: movement.traveledM,
    complete,
  };
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const firstLatitude = radians(a.lat);
  const secondLatitude = radians(b.lat);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function pointAtDistance(movement: RouteMovement, distance: number): Coordinate {
  let low = 1;
  let high = movement.cumulativeMeters.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (movement.cumulativeMeters[middle]! < distance) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const segmentStart = movement.cumulativeMeters[low - 1]!;
  const segmentEnd = movement.cumulativeMeters[low]!;
  const fraction = segmentEnd === segmentStart ? 0 : (distance - segmentStart) / (segmentEnd - segmentStart);
  const from = movement.points[low - 1]!;
  const to = movement.points[low]!;
  return { lat: from.lat + (to.lat - from.lat) * fraction, lng: from.lng + (to.lng - from.lng) * fraction };
}

function jitter(point: Coordinate, random: RandomSource, maximumMeters: number): Coordinate {
  const radius = Math.sqrt(random.next()) * maximumMeters;
  const angle = random.next() * Math.PI * 2;
  const latitudeOffset = (radius * Math.cos(angle)) / 111_320;
  const longitudeScale = 111_320 * Math.max(0.01, Math.cos(radians(point.lat)));
  const longitudeOffset = (radius * Math.sin(angle)) / longitudeScale;
  return { lat: point.lat + latitudeOffset, lng: point.lng + longitudeOffset };
}

function bearing(from: Coordinate, to: Coordinate): number {
  const startLatitude = radians(from.lat);
  const endLatitude = radians(to.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x = Math.cos(startLatitude) * Math.sin(endLatitude)
    - Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

function smoothstep(value: number): number {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}
