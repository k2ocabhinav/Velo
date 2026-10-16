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

/** Compact heading for an incoming offer card, worded with the tenant's trip noun. */
export function getIncomingOfferTitle(
  type: string | null | undefined,
  tripWord: string,
): string {
  if (type === "RIDE_DISPATCHED") {
    return `Scheduled ${tripWord} offer`;
  }

  return `New ${tripWord} offer`;
}

/** Label for the next action on the current-work card, worded with the tenant's trip noun. */
export function getNextTripActionLabel(status: string | null | undefined, tripWord: string): string {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "CONFIRMED") return `Start ${tripWord}`;
  if (normalized === "ONGOING") return `Complete ${tripWord}`;
  return `Continue ${tripWord}`;
}
