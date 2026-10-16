export interface LoginRateLimit {
  readonly windowMs: number;
  readonly ipLimit: number;
}

// Matches app.auth.rate-limit.ip-limit/window in the local backend profile.
export const LOCAL_LOGIN_RATE_LIMIT: LoginRateLimit = Object.freeze({
  windowMs: 60_000,
  ipLimit: 120,
});

const MINIMUM_LOGIN_INTERVAL_MS = 600;

export function loginStaggerIntervalMs(
  rateLimit: LoginRateLimit = LOCAL_LOGIN_RATE_LIMIT,
): number {
  if (!Number.isSafeInteger(rateLimit.windowMs) || rateLimit.windowMs < 1
    || !Number.isSafeInteger(rateLimit.ipLimit) || rateLimit.ipLimit < 1) {
    throw new RangeError("Login rate limit must use positive integer window and request limits");
  }
  return Math.max(MINIMUM_LOGIN_INTERVAL_MS, Math.ceil(rateLimit.windowMs / rateLimit.ipLimit));
}

export function loginStaggerDelayMs(
  elapsedSinceLastLoginMs: number | null,
  rateLimit: LoginRateLimit = LOCAL_LOGIN_RATE_LIMIT,
): number {
  if (elapsedSinceLastLoginMs === null) return 0;
  if (!Number.isFinite(elapsedSinceLastLoginMs) || elapsedSinceLastLoginMs < 0) {
    throw new RangeError("Elapsed login time must be a non-negative number");
  }
  return Math.max(0, loginStaggerIntervalMs(rateLimit) - elapsedSinceLastLoginMs);
}
