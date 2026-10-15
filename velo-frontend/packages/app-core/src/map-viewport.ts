export function shouldFitMapBounds(hasFitted: boolean, pointCount: number): boolean {
  return !hasFitted && pointCount > 0;
}

export function shouldFollowDriverLocation(followEnabled: boolean, hasDriverLocation: boolean): boolean {
  return followEnabled && hasDriverLocation;
}

/** Minimal shape of a Leaflet map needed to detect whether it is still alive. */
export interface LeafletMapHandle {
  getPane(name: string): unknown;
}

/**
 * Leaflet's pan/zoom animations are scheduled with requestAnimationFrame. If a
 * map unmounts before that frame runs, Leaflet touches the removed map pane and
 * throws "Cannot read properties of undefined (reading '_leaflet_pos')".
 * `getPane("mapPane")` only exists while the map is live, so guard imperative
 * setView/fitBounds/panTo calls with this (and pass `{ animate: false }`).
 */
export function isLeafletMapReady(map: LeafletMapHandle | null | undefined): boolean {
  return Boolean(map?.getPane("mapPane"));
}
