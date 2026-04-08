import { getRoutingProviderConfig, type RoutingProviderConfig } from "./providers";

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface RoutePath {
  points: MapPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  encodedPolyline?: string | null;
}

interface OsrmRouteGeometry {
  coordinates?: Array<[number, number]>;
}

interface OsrmRouteRecord {
  distance?: number;
  duration?: number;
  geometry?: OsrmRouteGeometry;
}

interface OsrmRouteResponse {
  code?: string;
  routes?: OsrmRouteRecord[];
}

function parseCoordinatePair(value: unknown): MapPoint | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export function parseOsrmRouteResponse(payload: unknown): RoutePath | null {
  const response = payload as OsrmRouteResponse;
  if (!response || response.code !== "Ok" || !Array.isArray(response.routes) || response.routes.length === 0) {
    return null;
  }

  const primaryRoute = response.routes[0];
  if (!primaryRoute || !Array.isArray(primaryRoute.geometry?.coordinates)) {
    return null;
  }

  const points = primaryRoute.geometry.coordinates
    .map(parseCoordinatePair)
    .filter((point): point is MapPoint => point !== null);

  if (points.length < 2) {
    return null;
  }

  return {
    points,
    distanceMeters: typeof primaryRoute.distance === "number" ? primaryRoute.distance : null,
    durationSeconds: typeof primaryRoute.duration === "number" ? primaryRoute.duration : null,
    encodedPolyline: null,
  };
}

export function buildFallbackRoutePath(start: MapPoint, end: MapPoint): RoutePath {
  return {
    points: [start, end],
    distanceMeters: null,
    durationSeconds: null,
    encodedPolyline: null,
  };
}

export function buildOsrmRouteUrl(
  start: MapPoint,
  end: MapPoint,
  config: RoutingProviderConfig = getRoutingProviderConfig(),
): string {
  const url = new URL(
    `/route/v1/${config.profile}/${start.lng},${start.lat};${end.lng},${end.lat}`,
    `${config.baseUrl}/`,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  if (config.apiToken) {
    url.searchParams.set("access_token", config.apiToken);
  }

  return url.toString();
}

export async function fetchRoutePath(
  start: MapPoint,
  end: MapPoint,
  fetchImpl: typeof fetch = fetch,
  config: RoutingProviderConfig = getRoutingProviderConfig(),
): Promise<RoutePath> {
  const requestUrl = buildOsrmRouteUrl(start, end, config);

  try {
    const response = await fetchImpl(requestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return buildFallbackRoutePath(start, end);
    }

    const payload = await response.json();
    return parseOsrmRouteResponse(payload) ?? buildFallbackRoutePath(start, end);
  } catch {
    return buildFallbackRoutePath(start, end);
  }
}
