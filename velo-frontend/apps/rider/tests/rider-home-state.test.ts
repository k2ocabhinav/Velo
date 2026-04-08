import { describe, expect, it } from "vitest";
import {
  getRideStatusLabel,
  isRideCancelableFromTripLane,
  selectTripLaneRide,
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
