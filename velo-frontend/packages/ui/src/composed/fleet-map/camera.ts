import type { Map as LeafletMap } from "leaflet";

export type FleetMapPoint = [number, number];

export const DEFAULT_CENTER: FleetMapPoint = [12.9716, 77.5946];

export function focusZoom(currentZoom: number): number {
  return Math.max(currentZoom, 14);
}

export function fitFleetMap(
  map: Pick<LeafletMap, "invalidateSize" | "setView" | "fitBounds">,
  points: FleetMapPoint[],
): void {
  map.invalidateSize({ animate: false });
  if (!points.length) {
    map.setView(DEFAULT_CENTER, 12, { animate: false });
  } else if (points.length === 1) {
    map.setView(points[0]!, 14, { animate: false });
  } else {
    map.fitBounds(points, { padding: [38, 38], maxZoom: 14, animate: false });
  }
}
