/** Locale used to format a currency's numbers (INR uses en-IN, otherwise en-US). */
export function getCurrencyLocale(currency = "USD"): string {
  return currency === "INR" ? "en-IN" : "en-US";
}

/** Format a decimal amount using the requested currency and locale. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = "USD",
  locale = getCurrencyLocale(currency)
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numericAmount)) return "—";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

/** Format a distance in kilometres to one decimal for the given locale. */
export function formatDistance(
  kilometres: number | string | null | undefined,
  locale = "en-US"
): string {
  if (kilometres === null || kilometres === undefined || kilometres === "") return "—";
  const numeric = typeof kilometres === "number" ? kilometres : Number(kilometres);
  if (!Number.isFinite(numeric)) return "—";

  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(numeric)} km`;
}

/**
 * The calendar year a timestamp falls in for a given IANA time zone. Resolving
 * the year through the same formatter (rather than `Date#getFullYear`) keeps the
 * year-omission logic aligned with the time zone the absolute date is rendered in.
 */
function yearInTimeZone(date: Date, locale: string, timeZone?: string): number {
  const year = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone })
    .formatToParts(date)
    .find((part) => part.type === "year")?.value;
  return Number(year);
}

/** API timestamps without an offset are UTC wall times by the backend contract. */
export function parseApiTimestamp(value: Date | string | number): Date {
  if (value instanceof Date || typeof value === "number") return new Date(value);

  const timestamp = value.includes("T") && !/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(value)
    ? `${value}Z`
    : value;
  return new Date(timestamp);
}

/**
 * Use a short relative minute label for values within 24 hours. Absolute dates
 * render in `timeZone` when provided (otherwise the runtime's local zone), so
 * callers that need a stable wall clock can pass the tenant's or user's zone.
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  now: Date = new Date(),
  locale = "en-GB",
  timeZone?: string
): string {
  if (value === null || value === undefined || value === "") return "—";

  const date = parseApiTimestamp(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) return "—";

  const deltaMs = date.getTime() - now.getTime();
  if (Math.abs(deltaMs) < 24 * 60 * 60 * 1000) {
    if (deltaMs >= -60_000 && deltaMs <= 0) return "just now";
    const absoluteDelta = Math.abs(deltaMs);
    if (absoluteDelta < 60 * 60 * 1000) {
      const minutes = deltaMs > 0
        ? Math.max(1, Math.ceil(deltaMs / 60_000))
        : Math.max(1, Math.floor(absoluteDelta / 60_000));
      return deltaMs > 0 ? `in ${minutes} min` : `${minutes} min ago`;
    }
    const hours = deltaMs > 0
      ? Math.ceil(absoluteDelta / (60 * 60 * 1000))
      : Math.floor(absoluteDelta / (60 * 60 * 1000));
    return deltaMs > 0 ? `in ${hours} hr` : `${hours} hr ago`;
  }

  const includeYear = yearInTimeZone(date, locale, timeZone) !== yearInTimeZone(now, locale, timeZone);
  const dateText = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone,
  }).format(date);
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);

  return `${dateText}, ${timeText}`;
}
