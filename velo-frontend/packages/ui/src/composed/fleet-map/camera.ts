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
/** Open-trip pickups beyond this from the fleet centroid are left out, so one airport request cannot zoom the city out. */
const PICKUP_RADIUS_KM = 12;
const EARTH_RADIUS_KM = 6_371;

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

function centroid(points: readonly FleetMapPoint[]): FleetMapPoint | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const [pointLat, pointLng] of points) {
    lat += pointLat;
    lng += pointLng;
  }
  return [lat / points.length, lng / points.length];
}

function kilometersBetween(from: FleetMapPoint, to: FleetMapPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to[0] - from[0]);
  const longitudeDelta = toRadians(to[1] - from[1]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from[0])) * Math.cos(toRadians(to[0])) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

/**
 * Points the initial fit and Recenter consider: every driver, open-trip pickups only when they sit within
 * {@link PICKUP_RADIUS_KM} of the drivers' centroid (all pickups when no driver is online), and both
 * endpoints of the selected trip. A lone distant pickup would otherwise zoom the whole fleet into a blob.
 */
export function fleetMapCameraPoints({ drivers, rides, selection }: FleetMapCameraInput): FleetMapPoint[] {
  const points: FleetMapPoint[] = drivers.map((driver) => [driver.lat, driver.lng]);
  const fleetCentroid = centroid(points);
  const selectedRideId = selection?.type === "ride" ? selection.id : null;

  for (const ride of rides) {
    if (ride.rideRequestId === selectedRideId) continue;
    const pickup: FleetMapPoint = [ride.pickup.lat, ride.pickup.lng];
    if (fleetCentroid && kilometersBetween(fleetCentroid, pickup) > PICKUP_RADIUS_KM) continue;
    points.push(pickup);
  }

  const selectedRide = selectedRideId === null ? undefined : rides.find((ride) => ride.rideRequestId === selectedRideId);
  if (selectedRide) {
    points.push([selectedRide.pickup.lat, selectedRide.pickup.lng], [selectedRide.dropOff.lat, selectedRide.dropOff.lng]);
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
