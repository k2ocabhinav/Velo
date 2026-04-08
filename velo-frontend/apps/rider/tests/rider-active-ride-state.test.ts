import { describe, expect, it } from "vitest";
import {
  applyRideUpdateStatus,
  isInFlightStatus,
  normalizeRideLifecycleStatus,
  resolveActiveRidePollingIntervalMs,
  shouldRedirectToActiveRide,
  type RideLifecycleStatus,
} from "../app/_lib/rider-active-ride-state";

describe("rider active ride state machine", () => {
  it("normalizes lifecycle statuses and in-flight detection", () => {
    expect(normalizeRideLifecycleStatus("pending")).toBe("PENDING");
    expect(normalizeRideLifecycleStatus("CONFIRMED")).toBe("CONFIRMED");
    expect(normalizeRideLifecycleStatus("ongoing")).toBe("ONGOING");
    expect(normalizeRideLifecycleStatus("ended")).toBe("ENDED");
    expect(normalizeRideLifecycleStatus("cancelled")).toBe("CANCELLED");
    expect(normalizeRideLifecycleStatus("unknown")).toBe("IDLE");

    expect(isInFlightStatus("PENDING")).toBe(true);
    expect(isInFlightStatus("CONFIRMED")).toBe(true);
    expect(isInFlightStatus("ONGOING")).toBe(true);
    expect(isInFlightStatus("ENDED")).toBe(false);
  });

  it("handles pending -> confirmed -> ongoing -> ended transitions", () => {
    let status: RideLifecycleStatus = "PENDING";
    status = applyRideUpdateStatus(status, {
      eventType: "RIDE_STATUS_CHANGED",
      status: "CONFIRMED",
    });
    expect(status).toBe("CONFIRMED");

    status = applyRideUpdateStatus(status, {
      eventType: "RIDE_STATUS_CHANGED",
      status: "ONGOING",
    });
    expect(status).toBe("ONGOING");

    status = applyRideUpdateStatus(status, {
      eventType: "RIDE_COMPLETED",
      status: "ENDED",
    });
    expect(status).toBe("ENDED");
  });

  it("handles cancellation and polling/redirect helpers", () => {
    const cancelled = applyRideUpdateStatus("CONFIRMED", {
      eventType: "RIDE_CANCELLED",
      status: "CANCELLED",
    });
    expect(cancelled).toBe("CANCELLED");

    expect(resolveActiveRidePollingIntervalMs("ONGOING")).toBe(5_000);
    expect(resolveActiveRidePollingIntervalMs("ENDED")).toBe(25_000);
    expect(shouldRedirectToActiveRide("PENDING")).toBe(true);
    expect(shouldRedirectToActiveRide("IDLE")).toBe(false);
  });
});
