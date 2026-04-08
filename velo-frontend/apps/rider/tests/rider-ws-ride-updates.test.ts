import { describe, expect, it } from "vitest";
import { createRideUpdateEventDedupeKey, normalizeRideUpdateEvent } from "../app/_lib/rider-ws";

describe("rider ride update ws helpers", () => {
  it("normalizes typed ride updates from websocket payloads", () => {
    const event = normalizeRideUpdateEvent({
      eventType: "DRIVER_LOCATION_UPDATED",
      rideId: 55,
      status: "ONGOING",
      updatedAt: "2026-04-09T10:00:00Z",
      driverLocation: {
        lat: 12.97,
        lng: 77.59,
        speedKph: 30,
      },
    });

    expect(event).toEqual({
      eventType: "DRIVER_LOCATION_UPDATED",
      rideId: 55,
      rideRequestId: undefined,
      status: "ONGOING",
      riderId: undefined,
      driverId: undefined,
      etaMinutes: null,
      routePolyline: null,
      updatedAt: "2026-04-09T10:00:00Z",
      driverLocation: {
        lat: 12.97,
        lng: 77.59,
        heading: null,
        speedKph: 30,
        accuracyM: null,
        capturedAt: null,
      },
    });
  });

  it("rejects unsupported payloads and produces stable dedupe keys", () => {
    expect(normalizeRideUpdateEvent({ eventType: "UNKNOWN" })).toBeNull();
    expect(normalizeRideUpdateEvent(null)).toBeNull();

    const first = normalizeRideUpdateEvent({
      eventType: "RIDE_STATUS_CHANGED",
      rideId: 55,
      status: "CONFIRMED",
      updatedAt: "2026-04-09T10:05:00Z",
    });
    const second = normalizeRideUpdateEvent({
      eventType: "RIDE_STATUS_CHANGED",
      rideId: 55,
      status: "CONFIRMED",
      updatedAt: "2026-04-09T10:05:00Z",
    });
    const third = normalizeRideUpdateEvent({
      eventType: "RIDE_STATUS_CHANGED",
      rideId: 55,
      status: "ONGOING",
      updatedAt: "2026-04-09T10:06:00Z",
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(createRideUpdateEventDedupeKey(first!)).toBe(createRideUpdateEventDedupeKey(second!));
    expect(createRideUpdateEventDedupeKey(first!)).not.toBe(createRideUpdateEventDedupeKey(third!));
  });
});
