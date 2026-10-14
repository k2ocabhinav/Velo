/** Format a decimal amount using the requested currency and locale. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = "USD",
  locale = "en-US"
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

/** Use a short relative minute label for values within 24 hours. */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  now: Date = new Date(),
  locale = "en-GB"
): string {
  if (value === null || value === undefined || value === "") return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) return "—";

  const deltaMs = date.getTime() - now.getTime();
  if (Math.abs(deltaMs) < 24 * 60 * 60 * 1000) {
    if (deltaMs === 0) return "now";
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

  const currentYear = now.getFullYear();
  const includeYear = date.getFullYear() !== currentYear;
  const dateText = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
  const timeText = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return `${dateText}, ${timeText}`;
}
