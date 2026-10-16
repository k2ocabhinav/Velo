import { describe, expect, it } from "vitest";
import { formatOfferLocation, getIncomingOfferTitle, getNextTripActionLabel, getRiderFirstName, resolveOfferExpiresAtMs } from "../app/_lib/driver-offer";

describe("driver offer helpers", () => {
  it("resolves the rider first name when the payload carries one", () => {
    expect(getRiderFirstName({ user: { name: "Henry Ford" } })).toBe("Henry");
    expect(getRiderFirstName({ user: { name: "  Alice  " } })).toBe("Alice");
    expect(getRiderFirstName({ user: { name: "   " } })).toBeNull();
    expect(getRiderFirstName(null)).toBeNull();
  });

  it("prefers the server expiresAt and falls back to the created-time window", () => {
    const serverExpiry = "2026-04-08T10:05:45.000Z";
    expect(resolveOfferExpiresAtMs(serverExpiry, "2026-04-08T10:00:00.000Z")).toBe(
      new Date(serverExpiry).getTime(),
    );
    expect(resolveOfferExpiresAtMs(null, "2026-04-08T10:00:00.000Z")).toBe(
      new Date("2026-04-08T10:00:00.000Z").getTime() + 45_000,
    );
    expect(resolveOfferExpiresAtMs(undefined, null)).toBeNull();
    expect(resolveOfferExpiresAtMs("not-a-date", "also-not-a-date")).toBeNull();
  });

  it("shows the provided address and falls back to the point coordinates", () => {
    expect(
      formatOfferLocation("Kempegowda Airport", { coordinates: [77.59, 12.97], type: "Point" }),
    ).toBe("Kempegowda Airport");
    expect(
      formatOfferLocation(null, { coordinates: [77.5946, 12.9716], type: "Point" }),
    ).toBe("12.97160, 77.59460");
    expect(formatOfferLocation("   ", null)).toBeNull();
  });

  it("words offer cards and next actions with the tenant trip noun", () => {
    expect(getIncomingOfferTitle("RIDE_REQUESTED", "trip")).toBe("New trip offer");
    expect(getIncomingOfferTitle("RIDE_DISPATCHED", "trip")).toBe("Scheduled trip offer");
    expect(getIncomingOfferTitle("RIDE_REQUESTED", "transfer")).toBe("New transfer offer");
    expect(getIncomingOfferTitle("RIDE_DISPATCHED", "transfer")).toBe("Scheduled transfer offer");

    expect(getNextTripActionLabel("CONFIRMED", "trip")).toBe("Start trip");
    expect(getNextTripActionLabel("ONGOING", "transfer")).toBe("Complete transfer");
    expect(getNextTripActionLabel("PENDING", "transfer")).toBe("Continue transfer");
  });
});
