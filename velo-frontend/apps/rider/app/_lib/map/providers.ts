export interface TileProviderConfig {
  urlTemplate: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

export interface RoutingProviderConfig {
  baseUrl: string;
  profile: string;
  apiToken?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getTileProviderConfig(): TileProviderConfig {
  const urlTemplate =
    process.env.NEXT_PUBLIC_RIDER_TILE_URL ??
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution =
    process.env.NEXT_PUBLIC_RIDER_TILE_ATTRIBUTION ??
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const subdomains = process.env.NEXT_PUBLIC_RIDER_TILE_SUBDOMAINS ?? "abc";
  const maxZoom = Number(process.env.NEXT_PUBLIC_RIDER_TILE_MAX_ZOOM ?? "19");

  return {
    urlTemplate,
    attribution,
    subdomains,
    maxZoom: Number.isFinite(maxZoom) ? maxZoom : 19,
  };
}

export function getRoutingProviderConfig(): RoutingProviderConfig {
  const baseUrl = trimTrailingSlash(
    process.env.NEXT_PUBLIC_RIDER_ROUTING_BASE_URL ?? "https://router.project-osrm.org",
  );
  const profile = process.env.NEXT_PUBLIC_RIDER_ROUTING_PROFILE ?? "driving";
  const apiToken = process.env.NEXT_PUBLIC_RIDER_ROUTING_API_TOKEN;

  return {
    baseUrl,
    profile,
    apiToken: apiToken && apiToken.trim() ? apiToken : undefined,
  };
}
