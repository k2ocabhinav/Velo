import type { RiderRideUpdateEvent } from "./rider-ws";

export type RideLifecycleStatus =
  | "IDLE"
  | "PENDING"
  | "CONFIRMED"
  | "ONGOING"
  | "ENDED"
  | "CANCELLED";

const ACTIVE_STATUSES = new Set<RideLifecycleStatus>(["PENDING", "CONFIRMED", "ONGOING"]);

export function normalizeRideLifecycleStatus(value: string | null | undefined): RideLifecycleStatus {
  const normalized = (value ?? "").trim().toUpperCase();

  if (normalized === "PENDING") return "PENDING";
  if (normalized === "CONFIRMED") return "CONFIRMED";
  if (normalized === "ONGOING") return "ONGOING";
  if (normalized === "ENDED") return "ENDED";
  if (normalized === "CANCELLED") return "CANCELLED";
  return "IDLE";
}

export function isInFlightStatus(status: RideLifecycleStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function resolveActiveRidePollingIntervalMs(status: RideLifecycleStatus): number {
  return isInFlightStatus(status) ? 5_000 : 25_000;
}

export function applyRideUpdateStatus(
  currentStatus: RideLifecycleStatus,
  event: RiderRideUpdateEvent,
): RideLifecycleStatus {
  const nextStatus = normalizeRideLifecycleStatus(event.status);

  if (event.eventType === "RIDE_COMPLETED") {
    return "ENDED";
  }

  if (event.eventType === "RIDE_CANCELLED") {
    return "CANCELLED";
  }

  if (event.eventType === "RIDE_STATUS_CHANGED" || event.eventType === "DRIVER_LOCATION_UPDATED") {
    return nextStatus === "IDLE" ? currentStatus : nextStatus;
  }

  return currentStatus;
}

export function shouldRedirectToActiveRide(status: RideLifecycleStatus): boolean {
  return isInFlightStatus(status);
}
