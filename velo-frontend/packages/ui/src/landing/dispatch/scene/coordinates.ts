import { SAMPLE_TRIPS, type SampleTrip } from "../sample-trips";

export type Point2 = { x: number; z: number };

export type BuildingCoordinate = Point2 & {
  width: number;
  depth: number;
  height: number;
  kind: "building" | "airport" | "hotel" | "business";
  label?: string;
};

export type VehicleCoordinate = Point2 & {
  tripId: SampleTrip["id"];
  routeProgress: number;
};

export type DispatchCoordinates = {
  seed: number;
  buildings: BuildingCoordinate[];
  landmarks: BuildingCoordinate[];
  streets: Point2[][];
  routes: Record<SampleTrip["id"], Point2[]>;
  vehicles: VehicleCoordinate[];
};

const LANDMARKS: BuildingCoordinate[] = [
  { x: -8, z: -3, width: 1.9, depth: 1.35, height: 0.72, kind: "airport", label: "Airport" },
  { x: 4, z: -3, width: 1.45, depth: 1.2, height: 1.9, kind: "hotel", label: "Grand Hotel" },
  { x: -4, z: 3, width: 1.4, depth: 1.2, height: 1.55, kind: "hotel", label: "Harbor Hotel" },
  { x: 4, z: 3, width: 1.9, depth: 1.65, height: 1.28, kind: "business", label: "Business park" },
];

const ROUTES: DispatchCoordinates["routes"] = {
  "05:40": [
    { x: -8, z: -3 },
    { x: -4, z: -3 },
    { x: 0, z: -3 },
    { x: 4, z: -3 },
  ],
  "09:15": [
    { x: 4, z: -3 },
    { x: 4, z: 0 },
    { x: 4, z: 3 },
  ],
  "18:30": [
    { x: 4, z: 3 },
    { x: 0, z: 3 },
    { x: 0, z: 0 },
    { x: -4, z: 0 },
    { x: -8, z: 0 },
    { x: -8, z: -3 },
  ],
};

function randomFrom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function distanceToGridLine(value: number, interval: number): number {
  return Math.abs(value - Math.round(value / interval) * interval);
}

export function pointAlongRoute(points: readonly Point2[], progress: number): Point2 {
  if (points.length < 2) return points[0] ?? { x: 0, z: 0 };

  const segments = points.slice(1).map((point, index) => {
    const start = points[index] ?? point;
    return { start, end: point, length: Math.hypot(point.x - start.x, point.z - start.z) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let distance = Math.max(0, Math.min(1, progress)) * total;

  for (const segment of segments) {
    if (distance <= segment.length) {
      const ratio = segment.length === 0 ? 0 : distance / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        z: segment.start.z + (segment.end.z - segment.start.z) * ratio,
      };
    }
    distance -= segment.length;
  }

  return points[points.length - 1] ?? { x: 0, z: 0 };
}

export function generateDispatchCoordinates(seed = 0x5eeda11): DispatchCoordinates {
  const random = randomFrom(seed);
  const candidates: Point2[] = [];

  for (let xIndex = -19; xIndex <= 19; xIndex += 1) {
    const x = xIndex * 0.5;
    if (distanceToGridLine(x, 4) < 0.78) continue;

    for (let zIndex = -13; zIndex <= 13; zIndex += 1) {
      const z = zIndex * 0.5;
      if (distanceToGridLine(z, 3) < 0.68) continue;
      if (LANDMARKS.some((landmark) => Math.hypot(x - landmark.x, z - landmark.z) < 1.45)) continue;
      candidates.push({ x, z });
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const a = candidates[index];
    const b = candidates[other];
    if (a === undefined || b === undefined) continue;
    candidates[index] = b;
    candidates[other] = a;
  }

  const buildings = candidates.slice(0, 150).map(({ x, z }): BuildingCoordinate => ({
    x: x + (random() - 0.5) * 0.16,
    z: z + (random() - 0.5) * 0.16,
    width: 0.27 + random() * 0.2,
    depth: 0.27 + random() * 0.2,
    height: 0.22 + random() * 0.58,
    kind: "building",
  }));

  const vehicles: VehicleCoordinate[] = SAMPLE_TRIPS.flatMap((trip) => [
    { ...pointAlongRoute(ROUTES[trip.id], 0.2), tripId: trip.id, routeProgress: 0.2 },
    { ...pointAlongRoute(ROUTES[trip.id], 0.7), tripId: trip.id, routeProgress: 0.7 },
  ]);

  return {
    seed,
    buildings,
    landmarks: LANDMARKS.map((landmark) => ({ ...landmark })),
    streets: [
      ...[-8, -4, 0, 4, 8].map((x) => [{ x, z: -7 }, { x, z: 7 }]),
      ...[-6, -3, 0, 3, 6].map((z) => [{ x: -10, z }, { x: 10, z }]),
    ],
    routes: {
      "05:40": ROUTES["05:40"].map((point) => ({ ...point })),
      "09:15": ROUTES["09:15"].map((point) => ({ ...point })),
      "18:30": ROUTES["18:30"].map((point) => ({ ...point })),
    },
    vehicles,
  };
}
