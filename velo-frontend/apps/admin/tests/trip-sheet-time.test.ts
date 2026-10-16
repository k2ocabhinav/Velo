import { describe, expect, it } from "vitest";
import { addCalendarDays, dateKeyInTimeZone, groupTripSheetRowsByHour } from "../app/(protected)/_lib/trip-sheet-time";
import type { TripSheetRow } from "../app/(protected)/_lib/admin-client";

function row(rideRequestId: number, scheduledTime: string): TripSheetRow {
  return {
    rideRequestId,
    scheduledTime,
    assigned: false,
    needsAttention: false,
    status: "SCHEDULED",
  };
}

describe("tenant-zone trip-sheet time helpers", () => {
  it("groups UTC instants by tenant wall-clock hour", () => {
    const rows = [row(1, "2026-10-20T03:30:00Z"), row(2, "2026-10-20T04:00:00Z")];

    const tenantGroups = groupTripSheetRowsByHour(rows, "Asia/Kolkata");
    expect(tenantGroups.map(([hour]) => hour)).toEqual(["09:00"]);
    expect(tenantGroups[0][1]).toHaveLength(2);
    expect(groupTripSheetRowsByHour(rows, "UTC").map(([hour]) => hour)).toEqual(["03:00", "04:00"]);
  });

  it("uses the tenant calendar date when choosing tomorrow across UTC midnight", () => {
    const now = new Date("2026-10-20T20:00:00Z");

    expect(dateKeyInTimeZone(now, "Asia/Kolkata")).toBe("2026-10-21");
    expect(addCalendarDays(dateKeyInTimeZone(now, "Asia/Kolkata"), 1)).toBe("2026-10-22");
    expect(dateKeyInTimeZone(now, "UTC")).toBe("2026-10-20");
  });
});
