import type { Map as LeafletMap } from "leaflet";
import type { FleetMapDriver, FleetMapRide, FleetMapSelection } from "./types";

export type FleetMapPoint = [number, number];

export const DEFAULT_CENTER: FleetMapPoint = [12.9716, 77.5946];

const FIT_PADDING: [number, number] = [48, 48];
const FIT_MAX_ZOOM = 14;
const FIT_MIN_ZOOM = 11;
const CLUSTER_ZOOM = 13;
/** A spread this small reads as one group of vehicles, so the camera centres on them instead of zooming in further. */
const CLUSTER_SPAN_DEGREES = 0.02;

export type FleetMapCameraView =
  | { kind: "center"; center: FleetMapPoint; zoom: number }
  | { kind: "bounds"; points: FleetMapPoint[] };

export interface FleetMapCameraInput {
  drivers: FleetMapDriver[];
  rides: FleetMapRide[];
  selection?: FleetMapSelection | null;
}

export function focusZoom(currentZoom: number): number {
  return Math.max(currentZoom, 14);
}

/**
 * Points the initial fit and Recenter consider: every driver, every open trip pickup, and the drop-off
 * of the selected trip only. Distant drop-offs would otherwise zoom the whole fleet into a blob.
 */
export function fleetMapCameraPoints({ drivers, rides, selection }: FleetMapCameraInput): FleetMapPoint[] {
  const points: FleetMapPoint[] = drivers.map((driver) => [driver.lat, driver.lng]);
  for (const ride of rides) {
    points.push([ride.pickup.lat, ride.pickup.lng]);
    if (selection?.type === "ride" && selection.id === ride.rideRequestId) {
      points.push([ride.dropOff.lat, ride.dropOff.lng]);
    }
  }
  return points;
}

export function fleetMapCameraView(points: FleetMapPoint[]): FleetMapCameraView {
  if (points.length === 0) {
    return { kind: "center", center: DEFAULT_CENTER, zoom: 12 };
  }

  let minLat = points[0]![0];
  let maxLat = minLat;
  let minLng = points[0]![1];
  let maxLng = minLng;
  for (const [lat, lng] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const center: FleetMapPoint = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  if (maxLat - minLat <= CLUSTER_SPAN_DEGREES && maxLng - minLng <= CLUSTER_SPAN_DEGREES) {
    return { kind: "center", center, zoom: CLUSTER_ZOOM };
  }
  return { kind: "bounds", points };
}

export function fitFleetMap(
  map: Pick<LeafletMap, "invalidateSize" | "setView" | "fitBounds" | "getZoom" | "setZoom">,
  points: FleetMapPoint[],
): void {
  map.invalidateSize({ animate: false });

  const view = fleetMapCameraView(points);
  if (view.kind === "center") {
    map.setView(view.center, view.zoom, { animate: false });
    return;
  }

  map.fitBounds(view.points, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate: false });
  if (map.getZoom() < FIT_MIN_ZOOM) {
    map.setZoom(FIT_MIN_ZOOM);
  }
}
