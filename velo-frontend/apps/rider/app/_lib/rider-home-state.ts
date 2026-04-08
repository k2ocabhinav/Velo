import type { DecimalValue, SpringPage } from "./rider-client";

export type RiderHomeRide = {
  id: number;
  rideStatus: string;
  paymentMethod: string;
  createdTime?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  fare?: DecimalValue | null;
  fair?: DecimalValue | null;
};

export type RiderHomeTripLane = Readonly<{
  ride: RiderHomeRide | null;
  mode: "empty" | "recent" | "active";
  title: string;
  description: string;
  statusLabel: string | null;
  timeLabel: string | null;
  count: number;
}>;

const ACTIVE_STATUSES = new Set(["CONFIRMED", "ONGOING"]);

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").toUpperCase();
}

function isActiveStatus(status: string | null | undefined): boolean {
  return ACTIVE_STATUSES.has(normalizeStatus(status));
}

function getRideTimestamp(ride: RiderHomeRide): number {
  const primary = ride.startedAt ?? ride.createdTime ?? ride.endedAt ?? null;
  if (!primary) {
    return 0;
  }

  const parsed = new Date(primary);
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
  const created = ride.createdTime ? new Date(ride.createdTime) : null;
  const started = ride.startedAt ? new Date(ride.startedAt) : null;
  const ended = ride.endedAt ? new Date(ride.endedAt) : null;

  const time = started ?? created ?? ended;
  if (!time || Number.isNaN(time.getTime())) {
    return "--";
  }

  return time.toLocaleString();
}

export function selectTripLaneRide(rides: RiderHomeRide[]): RiderHomeTripLane {
  if (rides.length === 0) {
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

  const sorted = [...rides].sort(compareRidePriority);
  const activeRide = sorted.find((ride) => isActiveStatus(ride.rideStatus)) ?? null;
  const latestRide = sorted[0] ?? null;
  if (!activeRide && !latestRide) {
    return {
      ride: null,
      mode: "empty",
      title: "No active trip right now",
      description: "Request a ride when you are ready. Your most recent trip will appear here once it starts.",
      statusLabel: null,
      timeLabel: null,
      count: rides.length,
    };
  }

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

  return {
    ride: latestRide,
    mode: "recent",
    title: "Latest trip",
    description: "No active trip is running now, so this lane shows your most recent ride.",
    statusLabel: latestRide ? getRideStatusLabel(latestRide.rideStatus) : null,
    timeLabel: latestRide ? getRideTimeLabel(latestRide) : null,
    count: rides.length,
  };
}

export function getRideFareValue(ride: RiderHomeRide | null | undefined): DecimalValue | null {
  if (!ride) {
    return null;
  }

  return ride.fare ?? ride.fair ?? null;
}
