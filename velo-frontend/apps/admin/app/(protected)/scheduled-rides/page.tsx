"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, DateTime, EmptyState, ErrorState, Money, PageHeader, Pagination, RouteStrip, Section, SegmentedControl, Skeleton, StatusBadge, type DataTableColumn } from "@velo/ui";
import { adminClient, type ScheduledRide } from "../_lib/admin-client";
import { normalizePageNumber, normalizeTotalPages, pageFallbackAfterMutation, toActionErrorMessage } from "../_lib/ui-state";

const FILTERS = ["ALL", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

export default function ScheduledRidesPage() {
  const [rows, setRows] = useState<ScheduledRide[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getScheduledRides(targetPage, 10);
      const content = payload.content ?? [];
      const nextPage = normalizePageNumber(payload.number, targetPage);
      const nextTotalPages = normalizeTotalPages(payload.totalPages);
      const fallback = allowFallback ? pageFallbackAfterMutation({ requestedPage: targetPage, returnedPage: nextPage, totalPages: nextTotalPages, itemCount: content.length }) : null;
      if (fallback !== null && fallback !== targetPage) return await load(fallback, false);
      setRows(content);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Couldn't load scheduled rides."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(0); }, []);

  const visibleRows = useMemo(() => filter === "ALL" ? rows : rows.filter((ride) => String(ride.status).toUpperCase() === filter), [rows, filter]);
  const columns: DataTableColumn<ScheduledRide>[] = [
    { header: "Route", cell: (ride) => <RouteStrip stage={ride.status} variant="static" pickupLabel="Pickup" dropoffLabel="Drop-off" /> },
    { header: "Scheduled", cell: (ride) => <DateTime value={ride.scheduledTime} /> },
    { header: "Fare", cell: (ride) => <Money amount={ride.fare} /> },
    { header: "Payment", cell: (ride) => ride.paymentMethod === "WALLET" ? "Wallet" : ride.paymentMethod === "CASH" ? "Cash" : "Other" },
    { header: "Status", cell: (ride) => <StatusBadge domain="request" status={ride.status} /> },
  ];

  return (
    <div className="stack">
      <PageHeader title="Scheduled rides" description="Review upcoming bookings and their current status." />
      {error ? <ErrorState title="Couldn't load scheduled rides" description={error} onRetry={() => void load(page)} /> : null}
      <Section title="Upcoming bookings" actions={<SegmentedControl ariaLabel="Scheduled ride status" value={filter} onValueChange={(value) => setFilter(value as (typeof FILTERS)[number])} options={FILTERS.map((value) => ({ value, label: value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase() }))} />}>
        {loading ? <div aria-label="Loading scheduled rides" aria-busy="true" className="stack">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div> : (
          <DataTable
            data={visibleRows}
            columns={columns}
            getRowKey={(ride) => ride.id}
            ariaLabel="Scheduled rides"
            emptyState={<EmptyState title={rows.length ? "No bookings in this status" : "No upcoming bookings"} description={rows.length ? "Choose another status to see more rides." : "Scheduled bookings will appear here when riders reserve ahead."} action={rows.length ? <button className="secondary-button" type="button" onClick={() => setFilter("ALL")}>Show all bookings</button> : <a className="secondary-button" href="/dispatch">Open dispatch</a>} />}
          />
        )}
        {!loading ? <Pagination page={page + 1} totalPages={totalPages} onPageChange={(next) => void load(next - 1)} /> : null}
      </Section>
    </div>
  );
}
