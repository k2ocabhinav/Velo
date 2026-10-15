export interface FleetPosition {
  lat: number;
  lng: number;
  heading: number | null;
}

export interface FleetDriverVisualState {
  status: "AVAILABLE" | "EN_ROUTE_TO_PICKUP" | "ON_TRIP";
  stale: boolean;
}

export type FleetDriverTone = "available" | "to-pickup" | "on-trip";

export function getFleetDriverVisualState(
  status: FleetDriverVisualState["status"],
  stale: boolean,
): FleetDriverVisualState & { tone: FleetDriverTone } {
  const tone: FleetDriverTone = status === "ON_TRIP"
    ? "on-trip"
    : status === "EN_ROUTE_TO_PICKUP"
      ? "to-pickup"
      : "available";
  return { status, stale, tone };
}

export function shortestHeadingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function interpolateFleetPosition(
  from: FleetPosition,
  to: FleetPosition,
  progress: number,
): FleetPosition {
  const amount = Math.min(1, Math.max(0, progress));
  const fromHeading = from.heading ?? 0;
  const targetHeading = to.heading ?? fromHeading;
  return {
    lat: from.lat + (to.lat - from.lat) * amount,
    lng: from.lng + (to.lng - from.lng) * amount,
    heading: (fromHeading + shortestHeadingDelta(fromHeading, targetHeading) * amount + 360) % 360,
  };
}
