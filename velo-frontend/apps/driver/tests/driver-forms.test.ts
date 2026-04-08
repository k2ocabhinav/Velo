import { describe, expect, it } from "vitest";
import {
  canSubmitCancelRide,
  canSubmitEndRide,
  canSubmitStartRide,
  mapApiError,
  validateOtpInput,
  validatePayoutAmount,
} from "../app/_lib/driver-forms";

describe("driver form helpers", () => {
  it("validates OTP input for ride start actions", () => {
    expect(validateOtpInput("")).toEqual({
      ok: false,
      error: "OTP is required to start a ride.",
    });
    expect(validateOtpInput("12")).toEqual({
      ok: false,
      error: "OTP must be exactly 4 digits.",
    });
    expect(validateOtpInput("1234")).toEqual({
      ok: true,
      value: "1234",
    });
  });

  it("validates payout amount bounds against available balance", () => {
    expect(validatePayoutAmount("abc", 100)).toEqual({
      ok: false,
      error: "Payout amount must be a valid number.",
    });
    expect(validatePayoutAmount("-5", 100)).toEqual({
      ok: false,
      error: "Payout amount must be greater than 0.",
    });
    expect(validatePayoutAmount("120", 100)).toEqual({
      ok: false,
      error: "Payout amount cannot exceed available balance.",
    });
    expect(validatePayoutAmount("80", 100)).toEqual({
      ok: true,
      value: 80,
    });
  });

  it("evaluates ride action submit states deterministically", () => {
    expect(canSubmitStartRide("CONFIRMED", "1234", false)).toBe(true);
    expect(canSubmitStartRide("ONGOING", "1234", false)).toBe(false);
    expect(canSubmitStartRide("CONFIRMED", "1234", true)).toBe(false);
    expect(canSubmitStartRide("CONFIRMED", "12", false)).toBe(false);

    expect(canSubmitEndRide("ONGOING", false)).toBe(true);
    expect(canSubmitEndRide("CONFIRMED", false)).toBe(false);
    expect(canSubmitEndRide("ONGOING", true)).toBe(false);

    expect(canSubmitCancelRide("CONFIRMED", false)).toBe(true);
    expect(canSubmitCancelRide("ONGOING", false)).toBe(false);
    expect(canSubmitCancelRide("CONFIRMED", true)).toBe(false);
  });

  it("maps API error payloads to deterministic messages", () => {
    expect(mapApiError({ error: { message: "Conflict" } }, "fallback")).toBe("Conflict");
    expect(mapApiError({ message: "Invalid input" }, "fallback")).toBe("Invalid input");
    expect(mapApiError({}, "fallback")).toBe("fallback");
  });
});
