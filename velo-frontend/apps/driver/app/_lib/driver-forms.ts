export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function toNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function mapApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message;
      }
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }

  return fallback;
}

export function validateOtpInput(value: string): ValidationResult<string> {
  const otp = value.trim();
  if (!otp) {
    return { ok: false, error: "OTP is required to start a ride." };
  }

  if (!/^\d{4}$/.test(otp)) {
    return { ok: false, error: "OTP must be exactly 4 digits." };
  }

  return { ok: true, value: otp };
}

export function validateRatingInput(value: string): ValidationResult<number> {
  const candidate = value.trim();
  if (!candidate) {
    return { ok: false, error: "Rating is required." };
  }

  const rating = Number(candidate);
  if (!Number.isInteger(rating)) {
    return { ok: false, error: "Rating must be a whole number." };
  }

  if (rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be between 1 and 5." };
  }

  return { ok: true, value: rating };
}

export function validatePayoutAmount(
  value: string,
  availableBalance: number | null | undefined,
): ValidationResult<number> {
  const amount = toNumber(value.trim());
  if (amount === null) {
    return { ok: false, error: "Payout amount must be a valid number." };
  }

  if (amount <= 0) {
    return { ok: false, error: "Payout amount must be greater than 0." };
  }

  if (availableBalance !== null && availableBalance !== undefined && amount > availableBalance) {
    return { ok: false, error: "Payout amount cannot exceed available balance." };
  }

  return { ok: true, value: amount };
}

export function canSubmitStartRide(rideStatus: string | null | undefined, otp: string, pending: boolean): boolean {
  if (pending) {
    return false;
  }
  if (rideStatus !== "CONFIRMED") {
    return false;
  }

  return validateOtpInput(otp).ok;
}

export function canSubmitEndRide(rideStatus: string | null | undefined, pending: boolean): boolean {
  return !pending && rideStatus === "ONGOING";
}

export function canSubmitCancelRide(rideStatus: string | null | undefined, pending: boolean): boolean {
  return !pending && rideStatus === "CONFIRMED";
}

export function canSubmitRateRider(
  rideStatus: string | null | undefined,
  rating: string,
  pending: boolean,
  alreadyRated = false,
): boolean {
  if (pending || alreadyRated || rideStatus !== "ENDED") {
    return false;
  }

  return validateRatingInput(rating).ok;
}
