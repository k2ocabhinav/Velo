import type { DriverRidePerson, PointDto } from "./driver-client";
import { parseApiTimestamp } from "@velo/app-core/formatters";
import { toMapPoint } from "./driver-ride-state";

export const OFFER_TTL_MS = 45_000;

/** Human wording for an offer stop whose address was never supplied by the request. */
export const PENDING_PICKUP_LABEL = "Pickup location pending";
export const PENDING_DROP_OFF_LABEL = "Drop-off location pending";

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
  const serverMs = serverExpiresAt ? parseApiTimestamp(serverExpiresAt).getTime() : Number.NaN;
  if (Number.isFinite(serverMs)) {
    return serverMs;
  }

  const createdMs = createdTime ? parseApiTimestamp(createdTime).getTime() : Number.NaN;
  if (!Number.isFinite(createdMs)) {
    return null;
  }

  return createdMs + OFFER_TTL_MS;
}

/**
 * Label for an offer stop: the address the request carries, or a human placeholder while its address
 * is being resolved. Raw coordinates never reach the offer card.
 */
export function formatOfferLocation(
  address: string | null | undefined,
  point: PointDto | null | undefined,
  pendingLabel: string,
): string | null {
  const normalized = address?.trim();
  if (normalized) {
    return normalized;
  }

  return toMapPoint(point) ? pendingLabel : null;
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
