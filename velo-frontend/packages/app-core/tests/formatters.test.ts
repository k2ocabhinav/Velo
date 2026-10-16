import { describe, expect, it } from "vitest";
import { formatDateTime, formatDistance, formatMoney, getCurrencyLocale } from "../src/formatters";

describe("formatMoney", () => {
  it("formats the default currency and supports a tenant currency and locale", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney("12.5", "EUR", "de-DE")).toBe("12,50 €");
    expect(formatMoney(1234.5, "INR")).toBe("₹1,234.50");
  });

  it("returns a placeholder for missing or invalid amounts", () => {
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney("not an amount")).toBe("—");
  });
});

describe("formatDistance", () => {
  it("formats kilometres to one decimal using the given locale", () => {
    expect(formatDistance(34.6398)).toBe("34.6 km");
    expect(formatDistance(0)).toBe("0.0 km");
    expect(formatDistance(1234.56, "en-IN")).toBe("1,234.6 km");
    expect(formatDistance(1234.56, "de-DE")).toBe("1.234,6 km");
  });

  it("returns a placeholder for missing or invalid distances", () => {
    expect(formatDistance(undefined)).toBe("—");
    expect(formatDistance(null)).toBe("—");
    expect(formatDistance("not a distance")).toBe("—");
  });

  it("maps currencies to their formatting locale", () => {
    expect(getCurrencyLocale("INR")).toBe("en-IN");
    expect(getCurrencyLocale("USD")).toBe("en-US");
    expect(getCurrencyLocale()).toBe("en-US");
  });
});

describe("formatDateTime", () => {
  const now = new Date("2026-04-05T09:00:00+05:30");

  it("formats relative dates inside 24 hours", () => {
    expect(formatDateTime("2026-04-05T09:05:00+05:30", now)).toBe("in 5 min");
    expect(formatDateTime("2026-04-05T08:48:00+05:30", now)).toBe("12 min ago");
    expect(formatDateTime("2026-04-05T11:00:00+05:30", now)).toBe("in 2 hr");
    expect(formatDateTime("2026-04-05T07:00:00+05:30", now)).toBe("2 hr ago");
  });

  it("formats absolute dates and omits the current year", () => {
    expect(formatDateTime("2026-04-04T09:00:00+05:30", now, "en-GB", "Asia/Kolkata")).toBe("4 Apr, 09:00");
    expect(formatDateTime("2025-04-05T09:00:00+05:30", now, "en-GB", "Asia/Kolkata")).toBe("5 Apr 2025, 09:00");
  });

  it("renders the same instant in the requested time zone", () => {
    expect(formatDateTime("2026-04-04T09:00:00+05:30", now, "en-GB", "UTC")).toBe("4 Apr, 03:30");
    expect(formatDateTime("2026-04-04T09:00:00+05:30", now, "en-GB", "America/New_York")).toBe("3 Apr, 23:30");
  });

  it("handles unavailable or invalid values", () => {
    expect(formatDateTime(null, now)).toBe("—");
    expect(formatDateTime("invalid", now)).toBe("—");
  });
});
