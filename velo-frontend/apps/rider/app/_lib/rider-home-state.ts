import type { DecimalValue, SpringPage } from "./rider-client";
import type { ISODateTime } from "@velo/api";
import { parseApiTimestamp } from "@velo/app-core/formatters";

export type RiderHomeRide = {
  id: number;
  rideStatus: string;
  paymentMethod: string;
  createdTime?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  fare?: DecimalValue | null;
  /** True once this ride's driver has been rated by the rider. */
  driverRated?: boolean;
};

export type RiderHomePendingRequest = Readonly<{
  id?: number;
  rideRequestStatus?: string | null;
  paymentMethod?: string | null;
  requestedTime?: ISODateTime | null;
  createdTime?: string | null;
  expiresAt?: string | null;
}>;

export type RiderHomeTripLane = Readonly<{
  ride: RiderHomeRide | null;
  mode: "empty" | "pending" | "recent" | "active";
  title: string;
  description: string;
  statusLabel: string | null;
  timeLabel: string | null;
  count: number;
}>;

export function shouldShowTripBanner(lane: RiderHomeTripLane): boolean {
  return lane.mode === "active" || lane.mode === "pending";
}

/**
 * True when the rider has no active trip and their most recent completed ride
 * is still unrated, so home can prompt them to rate it.
 */
export function shouldPromptRating(lane: RiderHomeTripLane): boolean {
  return lane.mode === "recent" && isCompletedRideStatus(lane.ride?.rideStatus) && lane.ride?.driverRated !== true;
}

export function isCompletedRideStatus(status: string | null | undefined): boolean {
  return COMPLETED_STATUSES.has(normalizeStatus(status));
}

const ACTIVE_STATUSES = new Set(["CONFIRMED", "ONGOING"]);
const CANCELLABLE_STATUSES = new Set(["CONFIRMED"]);
const PENDING_REQUEST_STATUSES = new Set(["PENDING", "CONFIRMED", "SCHEDULED"]);
const REQUEST_BLOCKING_STATUSES = new Set(["PENDING", "CONFIRMED"]);
const COMPLETED_STATUSES = new Set(["ENDED", "COMPLETED"]);

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").toUpperCase();
}

export function normalizeCurrentRideRequest(
  request: RiderHomePendingRequest | null | undefined,
): RiderHomePendingRequest | null {
  if (!request) {
    return null;
  }

  return {
    ...request,
    createdTime: request.requestedTime ?? request.createdTime ?? null,
  };
}

export function hasInFlightRideRequest(request: RiderHomePendingRequest | null | undefined): boolean {
  return REQUEST_BLOCKING_STATUSES.has(normalizeStatus(request?.rideRequestStatus));
}

function isActiveStatus(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has(normalizeStatus(status));
}

function isPendingRequestStatus(status: string | null | undefined): boolean {
  return PENDING_REQUEST_STATUSES.has(normalizeStatus(status));
}

function getRideTimestamp(ride: RiderHomeRide): number {
  const primary = ride.startedAt ?? ride.createdTime ?? ride.endedAt ?? null;
  if (!primary) {
    return 0;
  }

  const parsed = parseApiTimestamp(primary);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function compareRidePriority(left: RiderHomeRide, right: RiderHomeRide): number {
  const leftActive = isActiveStatus(left.rideStatus);
  const rightActive = isActiveStatus(right.rideStatus);

  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }

  const leftTime = getRideTimestamp(left);
  const rightTime = getRideTimestamp(right);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return right.id - left.id;
}

export function normalizeRidePage(payload: SpringPage<RiderHomeRide> | null | undefined): RiderHomeRide[] {
  return Array.isArray(payload?.content) ? payload.content : [];
}

export function getRideStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "PENDING":
      return "Finding driver";
    case "CONFIRMED":
      return "Driver assigned";
    case "ONGOING":
      return "In progress";
    case "ENDED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status && status.trim() ? status : "Unknown";
  }
}

export function getRideTimeLabel(ride: RiderHomeRide): string {
  const created = ride.createdTime ? parseApiTimestamp(ride.createdTime) : null;
  const started = ride.startedAt ? parseApiTimestamp(ride.startedAt) : null;
  const ended = ride.endedAt ? parseApiTimestamp(ride.endedAt) : null;

  const time = started ?? created ?? ended;
  if (!time || Number.isNaN(time.getTime())) {
    return "--";
  }

  return time.toLocaleString();
}

function getPendingRequestTimeLabel(request: RiderHomePendingRequest): string {
  if (!request.createdTime) {
    return "--";
  }

  const parsed = parseApiTimestamp(request.createdTime);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleString();
}

function getPendingRequestDescription(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "A driver match is being finalized. We will keep this lane updated automatically.";
    case "SCHEDULED":
      return "Your scheduled request is queued. We will update this lane when dispatch begins.";
    default:
      return "We are finding a nearby driver. Keep this screen open for live trip updates.";
  }
}

export function isRideCancelableFromTripLane(status: string | null | undefined): boolean {
  return CANCELLABLE_STATUSES.has(normalizeStatus(status));
}

export function selectTripLaneRide(
  rides: RiderHomeRide[],
  pendingRequest: RiderHomePendingRequest | null = null,
): RiderHomeTripLane {
  const pendingStatus = normalizeStatus(pendingRequest?.rideRequestStatus);
  const sorted = [...rides].sort(compareRidePriority);
  const activeRide = sorted.find((ride) => isActiveStatus(ride.rideStatus)) ?? null;
  const latestRide = sorted[0] ?? null;

  if (activeRide) {
    return {
      ride: activeRide,
      mode: "active",
      title: activeRide.rideStatus === "ONGOING" ? "Trip in progress" : "Driver assigned",
      description:
        activeRide.rideStatus === "ONGOING"
          ? "Your current trip is underway. Keep this screen open for live continuity."
          : "Your ride is confirmed and waiting to start.",
      statusLabel: getRideStatusLabel(activeRide.rideStatus),
      timeLabel: getRideTimeLabel(activeRide),
      count: rides.length,
    };
  }

  if (pendingRequest && isPendingRequestStatus(pendingStatus)) {
    return {
      ride: null,
      mode: "pending",
      title: "Finding a driver",
      description: getPendingRequestDescription(pendingStatus),
      statusLabel: getRideStatusLabel(pendingStatus),
      timeLabel: getPendingRequestTimeLabel(pendingRequest),
      count: rides.length,
    };
  }

  if (!latestRide) {
    return {
      ride: null,
      mode: "empty",
      title: "No active trip right now",
      description: "Request a ride when you are ready. Your most recent trip will appear here once it starts.",
      statusLabel: null,
      timeLabel: null,
      count: 0,
    };
  }

  return {
    ride: latestRide,
    mode: "recent",
    title: "Latest trip",
    description: "No active trip is running now, so this lane shows your most recent ride.",
    statusLabel: getRideStatusLabel(latestRide.rideStatus),
    timeLabel: getRideTimeLabel(latestRide),
    count: rides.length,
  };
}

export function getRideFareValue(ride: RiderHomeRide | null | undefined): DecimalValue | null {
  if (!ride) {
    return null;
  }

  return ride.fare ?? null;
}

export function resolvePendingRequestExpiryMs(
  request: RiderHomePendingRequest | null | undefined,
  fallbackOfferTtlMs: number,
): number | null {
  const expiresAt = request?.expiresAt;
  if (expiresAt) {
    const expiresMs = parseApiTimestamp(expiresAt).getTime();
    if (Number.isFinite(expiresMs)) {
      return expiresMs;
    }
  }

  const createdTime = request?.createdTime;
  if (!createdTime) {
    return null;
  }

  const createdMs = parseApiTimestamp(createdTime).getTime();
  if (!Number.isFinite(createdMs)) {
    return null;
  }

  return createdMs + fallbackOfferTtlMs;
}
