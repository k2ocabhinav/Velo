import type { MapPoint } from "./map/routing";

export type SelectionTarget = "pickup" | "dropoff";

export interface BookingMapState {
  pickupPoint: MapPoint | null;
  dropOffPoint: MapPoint | null;
  activeTarget: SelectionTarget;
}

export function mapPointToInputStrings(point: MapPoint): { lat: string; lng: string } {
  return {
    lat: String(point.lat),
    lng: String(point.lng),
  };
}

export function inputStringsToMapPoint(lat: string, lng: string): MapPoint | null {
  const trimmedLat = lat.trim();
  const trimmedLng = lng.trim();

  if (!trimmedLat || !trimmedLng) {
    return null;
  }

  const parsedLat = Number(trimmedLat);
  const parsedLng = Number(trimmedLng);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }

  if (parsedLat < -90 || parsedLat > 90) {
    return null;
  }

  if (parsedLng < -180 || parsedLng > 180) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
}
