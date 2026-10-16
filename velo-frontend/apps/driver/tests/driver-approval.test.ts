import { describe, expect, it } from "vitest";
import { isDriverApproved, type DriverProfile } from "../app/_lib/driver-client";

function profile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return { id: 1, available: false, ...overrides };
}

describe("isDriverApproved", () => {
  it("treats an omitted status as approved for backward compatibility", () => {
    expect(isDriverApproved(profile())).toBe(true);
    expect(isDriverApproved(null)).toBe(true);
    expect(isDriverApproved(undefined)).toBe(true);
  });

  it("treats an explicit APPROVED status as approved regardless of casing", () => {
    expect(isDriverApproved(profile({ onboardingStatus: "APPROVED" }))).toBe(true);
    expect(isDriverApproved(profile({ onboardingStatus: "approved" }))).toBe(true);
  });

  it("rejects pending, rejected and suspended drivers", () => {
    expect(isDriverApproved(profile({ onboardingStatus: "PENDING" }))).toBe(false);
    expect(isDriverApproved(profile({ onboardingStatus: "REJECTED" }))).toBe(false);
    expect(isDriverApproved(profile({ onboardingStatus: "SUSPENDED" }))).toBe(false);
  });
});
