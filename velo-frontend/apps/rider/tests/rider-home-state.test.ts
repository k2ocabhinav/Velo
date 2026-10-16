import { describe, expect, it } from "vitest";
import {
  getRideStatusLabel,
  hasInFlightRideRequest,
  isRideCancelableFromTripLane,
  normalizeCurrentRideRequest,
  resolvePendingRequestExpiryMs,
  selectTripLaneRide,
  shouldPromptRating,
  shouldShowTripBanner,
  type RiderHomeRide,
} from "../app/_lib/rider-home-state";

function createRide(overrides: Partial<RiderHomeRide>): RiderHomeRide {
  return {
    id: 1,
    rideStatus: "CONFIRMED",
    paymentMethod: "WALLET",
    createdTime: "2026-04-08T10:00:00.000Z",
    startedAt: null,
    endedAt: null,
    fare: 120,
    ...overrides,
  };
}

describe("rider home trip lane", () => {
  it("rehydrates a pending request from the current-request endpoint response", () => {
    const request = normalizeCurrentRideRequest({
      id: 77,
      rideRequestStatus: "PENDING",
      paymentMethod: "WALLET",
      requestedTime: "2026-04-08T10:05:00.000Z",
    });

    expect(request?.createdTime).toBe("2026-04-08T10:05:00.000Z");
    expect(selectTripLaneRide([], request).mode).toBe("pending");
    expect(hasInFlightRideRequest(request)).toBe(true);
  });

  it("does not block a new immediate request for a scheduled ride", () => {
    expect(hasInFlightRideRequest({ rideRequestStatus: "SCHEDULED" })).toBe(false);
  });

  it("keeps pending request continuity when no ride exists yet", () => {
    const lane = selectTripLaneRide([], {
      id: 77,
      rideRequestStatus: "PENDING",
      paymentMethod: "WALLET",
      createdTime: "2026-04-08T10:05:00.000Z",
    });

    expect(lane.mode).toBe("pending");
    expect(lane.title).toBe("Finding a driver");
    expect(lane.statusLabel).toBe("Finding driver");
  });

  it("prioritizes active ride continuity over pending request fallback", () => {
    const lane = selectTripLaneRide(
      [
        createRide({
          id: 101,
          rideStatus: "CONFIRMED",
          createdTime: "2026-04-08T10:05:00.000Z",
        }),
      ],
      {
        id: 77,
        rideRequestStatus: "PENDING",
      },
    );

    expect(lane.mode).toBe("active");
    expect(lane.ride?.id).toBe(101);
    expect(lane.statusLabel).toBe("Driver assigned");
  });

  it("shows the pending lane when the rider has prior history", () => {
    const lane = selectTripLaneRide(
      [
        createRide({
          id: 202,
          rideStatus: "ENDED",
          endedAt: "2026-04-08T08:00:00.000Z",
        }),
      ],
      {
        id: 77,
        rideRequestStatus: "PENDING",
      },
    );

    expect(lane.mode).toBe("pending");
    expect(lane.title).toBe("Finding a driver");
    expect(lane.statusLabel).toBe("Finding driver");
    expect(lane.count).toBe(1);
    expect(shouldShowTripBanner(lane)).toBe(true);
  });

  it("keeps the active trip ahead of recent history and a stale pending request", () => {
    const lane = selectTripLaneRide(
      [
        createRide({ id: 202, rideStatus: "ENDED", endedAt: "2026-04-08T08:00:00.000Z" }),
        createRide({ id: 303, rideStatus: "CONFIRMED", createdTime: "2026-04-08T10:05:00.000Z" }),
      ],
      {
        id: 77,
        rideRequestStatus: "PENDING",
      },
    );

    expect(lane.mode).toBe("active");
    expect(lane.ride?.id).toBe(303);
  });

  it("falls back to recent lane for completed trips", () => {
    const lane = selectTripLaneRide([
      createRide({
        id: 202,
        rideStatus: "ENDED",
        endedAt: "2026-04-08T08:00:00.000Z",
      }),
    ]);

    expect(lane.mode).toBe("recent");
    expect(lane.statusLabel).toBe("Completed");
    expect(shouldShowTripBanner(lane)).toBe(false);
  });

  it("shows the home banner only while a request or ride is in progress", () => {
    expect(shouldShowTripBanner(selectTripLaneRide([], { rideRequestStatus: "PENDING" }))).toBe(true);
    expect(shouldShowTripBanner(selectTripLaneRide([createRide({ rideStatus: "CONFIRMED" })]))).toBe(true);
    expect(shouldShowTripBanner(selectTripLaneRide([createRide({ rideStatus: "ONGOING" })]))).toBe(true);
  });

  it("prompts to rate a just-completed trip that has not been rated", () => {
    const lane = selectTripLaneRide([
      createRide({ id: 202, rideStatus: "ENDED", endedAt: "2026-04-08T08:00:00.000Z", driverRated: false }),
    ]);

    expect(lane.mode).toBe("recent");
    expect(shouldPromptRating(lane)).toBe(true);
  });

  it("does not prompt once the completed trip has been rated", () => {
    const lane = selectTripLaneRide([
      createRide({ id: 202, rideStatus: "ENDED", endedAt: "2026-04-08T08:00:00.000Z", driverRated: true }),
    ]);

    expect(shouldPromptRating(lane)).toBe(false);
  });

  it("does not prompt while a trip is active, cancelled, or absent", () => {
    expect(shouldPromptRating(selectTripLaneRide([createRide({ rideStatus: "ONGOING", driverRated: false })]))).toBe(false);
    expect(shouldPromptRating(selectTripLaneRide([createRide({ rideStatus: "CANCELLED", driverRated: false })]))).toBe(false);
    expect(shouldPromptRating(selectTripLaneRide([]))).toBe(false);
  });
});

describe("rider home status helpers", () => {
  it("maps user-facing status labels", () => {
    expect(getRideStatusLabel("PENDING")).toBe("Finding driver");
    expect(getRideStatusLabel("CONFIRMED")).toBe("Driver assigned");
    expect(getRideStatusLabel("ONGOING")).toBe("In progress");
    expect(getRideStatusLabel("ENDED")).toBe("Completed");
    expect(getRideStatusLabel("CANCELLED")).toBe("Cancelled");
  });

  it("allows cancel action only for cancellable trip lane statuses", () => {
    expect(isRideCancelableFromTripLane("CONFIRMED")).toBe(true);
    expect(isRideCancelableFromTripLane("ONGOING")).toBe(false);
    expect(isRideCancelableFromTripLane("ENDED")).toBe(false);
  });
});

describe("resolvePendingRequestExpiryMs", () => {
  it("prefers the deadline reported by the dispatcher", () => {
    const expiresAtMs = resolvePendingRequestExpiryMs(
      {
        rideRequestStatus: "PENDING",
        createdTime: "2026-04-08T10:00:00.000Z",
        expiresAt: "2026-04-08T10:01:30.000Z",
      },
      45_000,
    );

    expect(expiresAtMs).toBe(new Date("2026-04-08T10:01:30.000Z").getTime());
  });

  it("treats a zone-less server deadline as UTC", () => {
    expect(resolvePendingRequestExpiryMs({ expiresAt: "2026-04-08T10:01:30" }, 45_000)).toBe(
      new Date("2026-04-08T10:01:30Z").getTime(),
    );
  });

  it("falls back to the created time plus the offer TTL when the backend omits a deadline", () => {
    const expiresAtMs = resolvePendingRequestExpiryMs(
      {
        rideRequestStatus: "PENDING",
        createdTime: "2026-04-08T10:00:00.000Z",
      },
      45_000,
    );

    expect(expiresAtMs).toBe(new Date("2026-04-08T10:00:00.000Z").getTime() + 45_000);
  });

  it("returns null when there is no usable deadline or created time", () => {
    expect(resolvePendingRequestExpiryMs(null, 45_000)).toBeNull();
    expect(resolvePendingRequestExpiryMs({ rideRequestStatus: "PENDING" }, 45_000)).toBeNull();
    expect(
      resolvePendingRequestExpiryMs({ expiresAt: "not-a-date", createdTime: "also-bad" }, 45_000),
    ).toBeNull();
  });
});
