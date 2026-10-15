import { describe, expect, it } from "vitest";
import { formatOfferLocation, getIncomingOfferContent, getNextTripActionLabel, getRiderFirstName, resolveOfferExpiresAtMs } from "../app/_lib/driver-offer";

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
    expect(getIncomingOfferContent("RIDE_REQUESTED", "trip")).toEqual({
      title: "New trip offer",
      message: "A trip request is waiting for your response.",
    });
    expect(getIncomingOfferContent("RIDE_DISPATCHED", "trip")).toEqual({
      title: "Scheduled trip offer",
      message: "A scheduled trip is ready for your response.",
    });
    expect(getIncomingOfferContent("RIDE_REQUESTED", "transfer")).toEqual({
      title: "New transfer offer",
      message: "A transfer request is waiting for your response.",
    });
    expect(getIncomingOfferContent("RIDE_DISPATCHED", "transfer")).toEqual({
      title: "Scheduled transfer offer",
      message: "A scheduled transfer is ready for your response.",
    });

    expect(getNextTripActionLabel("CONFIRMED", "trip")).toBe("Start trip");
    expect(getNextTripActionLabel("ONGOING", "transfer")).toBe("Complete transfer");
    expect(getNextTripActionLabel("PENDING", "transfer")).toBe("Continue transfer");
  });
});
