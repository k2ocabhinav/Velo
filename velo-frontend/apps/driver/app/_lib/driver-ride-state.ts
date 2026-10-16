import type { DecimalValue, DriverRide, PointDto, SpringPage } from "./driver-client";
import type { MapPoint } from "./map/routing";

const ACTIVE_DRIVER_RIDE_STATUSES = new Set(["CONFIRMED", "ONGOING"]);

function normalizeRideStatus(status: string | null | undefined): string {
  return (status ?? "").toUpperCase();
}

function getRideTimestamp(ride: DriverRide): number {
  const timeCandidate = ride.startedAt ?? ride.createdTime ?? ride.endedAt ?? null;
  if (!timeCandidate) {
    return 0;
  }

  const parsed = new Date(timeCandidate);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function compareRidePriority(left: DriverRide, right: DriverRide): number {
  const leftActive = isDriverRideActive(left.rideStatus);
  const rightActive = isDriverRideActive(right.rideStatus);
  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }

  const timeDelta = getRideTimestamp(right) - getRideTimestamp(left);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return right.id - left.id;
}

export function isDriverRideActive(status: string | null | undefined): boolean {
  return ACTIVE_DRIVER_RIDE_STATUSES.has(normalizeRideStatus(status));
}

export function normalizeDriverRidePage(payload: SpringPage<DriverRide> | null | undefined): DriverRide[] {
  return Array.isArray(payload?.content) ? payload.content : [];
}

export function selectCurrentDriverRide(rides: DriverRide[]): DriverRide | null {
  if (rides.length === 0) {
    return null;
  }

  const sorted = [...rides].sort(compareRidePriority);
  return sorted.find((ride) => isDriverRideActive(ride.rideStatus)) ?? null;
}

export function getDriverRideStatusLabel(status: string | null | undefined): string {
  switch (normalizeRideStatus(status)) {
    case "PENDING":
      return "Incoming";
    case "CONFIRMED":
      return "Assigned";
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

export function getDriverRideTimeLabel(ride: DriverRide): string {
  const timestamp = ride.startedAt ?? ride.createdTime ?? ride.endedAt;
  if (!timestamp) {
    return "--";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleString();
}

export function getDriverRideFareValue(ride: DriverRide | null | undefined): DecimalValue | null {
  if (!ride) {
    return null;
  }

  return ride.fare ?? null;
}

export function toMapPoint(point: PointDto | null | undefined): MapPoint | null {
  if (!point || !Array.isArray(point.coordinates) || point.coordinates.length < 2) {
    return null;
  }

  const lng = Number(point.coordinates[0]);
  const lat = Number(point.coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export function toDriverRideTimeline(status: string | null | undefined): Array<{ label: string; done: boolean }> {
  const normalized = normalizeRideStatus(status);
  const order = ["CONFIRMED", "ONGOING", "ENDED"] as const;
  const statusIndex = order.indexOf(normalized as (typeof order)[number]);

  return [
    { label: "Assigned", done: statusIndex >= 0 || normalized === "CANCELLED" },
    { label: "At pickup", done: statusIndex >= 1 },
    { label: "Trip in progress", done: statusIndex >= 1 },
    { label: "Trip completed", done: statusIndex >= 2 },
  ];
}
