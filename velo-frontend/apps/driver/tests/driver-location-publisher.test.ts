import { describe, expect, it } from "vitest";
import { resolveLocationPublishIntervalMs } from "../app/_lib/driver-location-publisher";

describe("driver location publisher cadence", () => {
  it("uses fast cadence for active moving rides", () => {
    expect(
      resolveLocationPublishIntervalMs({
        rideStatus: "CONFIRMED",
        speedKph: 24,
      }),
    ).toBe(3_000);
    expect(
      resolveLocationPublishIntervalMs({
        rideStatus: "ONGOING",
        speedKph: 30,
      }),
    ).toBe(3_000);
  });

  it("uses slower cadence for idle/reconnecting and disables when ride is inactive", () => {
    expect(
      resolveLocationPublishIntervalMs({
        rideStatus: "ONGOING",
        speedKph: 0,
      }),
    ).toBe(10_000);
    expect(
      resolveLocationPublishIntervalMs({
        rideStatus: "CONFIRMED",
        speedKph: 15,
        reconnecting: true,
      }),
    ).toBe(10_000);
    expect(
      resolveLocationPublishIntervalMs({
        rideStatus: "ENDED",
        speedKph: 10,
      }),
    ).toBe(0);
  });
});
