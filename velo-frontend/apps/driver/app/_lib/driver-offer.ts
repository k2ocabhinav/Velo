import type { DriverRidePerson, PointDto } from "./driver-client";
import { formatMapPoint, toMapPoint } from "./driver-ride-state";

export const OFFER_TTL_MS = 45_000;

export function getRiderFirstName(rider: DriverRidePerson | null | undefined): string | null {
  const name = rider?.user?.name?.trim();
  if (!name) {
    return null;
  }

  const [first] = name.split(/\s+/);
  return first || null;
}

export function resolveOfferExpiresAtMs(
  serverExpiresAt: string | null | undefined,
  createdTime: string | null | undefined,
): number | null {
  const serverMs = serverExpiresAt ? new Date(serverExpiresAt).getTime() : Number.NaN;
  if (Number.isFinite(serverMs)) {
    return serverMs;
  }

  const createdMs = createdTime ? new Date(createdTime).getTime() : Number.NaN;
  if (!Number.isFinite(createdMs)) {
    return null;
  }

  return createdMs + OFFER_TTL_MS;
}

export function formatOfferLocation(
  address: string | null | undefined,
  point: PointDto | null | undefined,
): string | null {
  const normalized = address?.trim();
  if (normalized) {
    return normalized;
  }

  const mapPoint = toMapPoint(point);
  return mapPoint ? formatMapPoint(mapPoint) : null;
}
