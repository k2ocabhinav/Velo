import type { TripSheetRow } from "./admin-client";

function dateParts(date: Date, timeZone: string): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = dateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export function groupTripSheetRowsByHour(rows: TripSheetRow[], timeZone: string): Array<[string, TripSheetRow[]]> {
  const grouped = new Map<string, TripSheetRow[]>();
  const hourFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone });

  for (const row of rows) {
    const scheduledAt = new Date(row.scheduledTime);
    const hour = Number.isFinite(scheduledAt.getTime())
      ? hourFormatter.formatToParts(scheduledAt).find((part) => part.type === "hour")?.value ?? "—"
      : "—";
    const key = hour === "—" ? hour : `${hour}:00`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}
