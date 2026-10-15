import { describe, expect, it } from "vitest";
import {
  formatMapPoint,
  getDriverRideFareValue,
  getDriverRideStatusLabel,
  getDriverRideTimeLabel,
  isDriverRideActive,
  normalizeDriverRidePage,
  selectCurrentDriverRide,
  toDriverRideTimeline,
  toMapPoint,
} from "../app/_lib/driver-ride-state";

describe("driver ride state helpers", () => {
  it("normalizes page content and selects the latest active ride", () => {
    const rides = normalizeDriverRidePage({
      content: [
        { id: 2, rideStatus: "ENDED", paymentMethod: "WALLET", fare: 140, createdTime: "2026-04-07T10:00:00Z" },
        { id: 9, rideStatus: "CONFIRMED", paymentMethod: "CASH", fare: 200, createdTime: "2026-04-08T08:00:00Z" },
        { id: 5, rideStatus: "ONGOING", paymentMethod: "WALLET", fare: 180, createdTime: "2026-04-08T07:00:00Z" },
      ],
    });

    expect(rides).toHaveLength(3);
    const activeRide = selectCurrentDriverRide(rides);
    expect(activeRide?.id).toBe(9);
    expect(isDriverRideActive(activeRide?.rideStatus)).toBe(true);
  });

  it("parses map points and formats fallback values", () => {
    const point = toMapPoint({
      coordinates: [77.5946, 12.9716],
      type: "Point",
    });
    expect(point).toEqual({ lat: 12.9716, lng: 77.5946 });
    expect(formatMapPoint(point)).toBe("12.97160, 77.59460");
    expect(toMapPoint({ coordinates: [NaN, 12] })).toBeNull();
    expect(formatMapPoint(null)).toBe("--");
  });

  it("produces deterministic labels, fare values, and timeline steps", () => {
    expect(getDriverRideStatusLabel("CONFIRMED")).toBe("Assigned");
    expect(getDriverRideStatusLabel("ONGOING")).toBe("In progress");
    expect(getDriverRideStatusLabel("ENDED")).toBe("Completed");
    expect(getDriverRideStatusLabel("")).toBe("Unknown");

    expect(getDriverRideFareValue({ id: 1, rideStatus: "ENDED", paymentMethod: "WALLET", fare: 220 })).toBe(220);
    expect(getDriverRideFareValue({ id: 1, rideStatus: "ENDED", paymentMethod: "WALLET", fare: 180 })).toBe(180);

    const timeline = toDriverRideTimeline("ENDED");
    expect(timeline.every((step) => step.done)).toBe(true);
    expect(getDriverRideTimeLabel({ id: 1, rideStatus: "ENDED", paymentMethod: "WALLET" })).toBe("--");
  });
});
