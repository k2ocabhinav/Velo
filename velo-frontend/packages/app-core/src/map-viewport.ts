export function shouldFitMapBounds(hasFitted: boolean, pointCount: number): boolean {
  return !hasFitted && pointCount > 0;
}

export function shouldFollowDriverLocation(followEnabled: boolean, hasDriverLocation: boolean): boolean {
  return followEnabled && hasDriverLocation;
}
