"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, DateTime, EmptyState, ErrorState, Money, PageHeader, Pagination, RouteStrip, Section, SegmentedControl, Skeleton, StatusBadge, type DataTableColumn } from "@velo/ui";
import { adminClient, type ScheduledRide } from "../_lib/admin-client";
import { normalizePageNumber, normalizeTotalPages, pageFallbackAfterMutation, toActionErrorMessage } from "../_lib/ui-state";
import { getTenantPluralLabel, getTenantLabelForCount, getTenantPluralTripLabel } from "@velo/app-core/tenant";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";

const FILTERS = ["ALL", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

export default function ScheduledRidesPage() {
  const { riderLabel, driverLabel, tripLabel } = useTenantBrandingOrDefault();
  const tripsLabel = getTenantPluralTripLabel(tripLabel);
  const tripWord = getTenantLabelForCount(1, tripLabel, { midSentence: true, fallback: "Trip" });
  const ridersLabel = getTenantPluralLabel(riderLabel, "Rider").toLowerCase();
  const usesDefaultTripLabel = tripLabel.trim().toLowerCase() === "trip";
  const routeStageLabels = {
    requested: `${tripLabel} requested`,
    assigned: `${driverLabel} assigned`,
    arriving: `${driverLabel} arriving`,
    on_trip: `${tripLabel} in progress`,
    completed: `${tripLabel} completed`,
    cancelled: `${tripLabel} cancelled`,
  };
  const pageTitle = usesDefaultTripLabel ? "Scheduled rides" : `Scheduled ${tripsLabel.toLowerCase()}`;
  const sectionTitle = usesDefaultTripLabel ? "Upcoming bookings" : `Upcoming ${tripsLabel.toLowerCase()}`;
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
      setError(toActionErrorMessage(loadError, `Couldn't load ${pageTitle.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(0); }, []);

  const visibleRows = useMemo(() => filter === "ALL" ? rows : rows.filter((ride) => String(ride.status).toUpperCase() === filter), [rows, filter]);
  const columns: DataTableColumn<ScheduledRide>[] = [
    { header: "Route", cell: (ride) => <RouteStrip stage={ride.status} stageLabels={routeStageLabels} variant="static" pickupLabel="Pickup" dropoffLabel="Drop-off" /> },
    { header: "Scheduled", cell: (ride) => <DateTime value={ride.scheduledTime} /> },
    { header: "Fare", cell: (ride) => <Money amount={ride.fare} /> },
    { header: "Payment", cell: (ride) => ride.paymentMethod === "WALLET" ? "Wallet" : ride.paymentMethod === "CASH" ? "Cash" : "Other" },
    { header: "Status", cell: (ride) => <StatusBadge domain="request" status={ride.status} /> },
  ];

  return (
    <div className="stack">
      <PageHeader title={pageTitle} description={usesDefaultTripLabel ? "Review upcoming bookings and their current status." : `Review upcoming ${tripsLabel.toLowerCase()} and their current status.`} />
      {error ? <ErrorState title={`Couldn't load ${pageTitle.toLowerCase()}`} description={error} onRetry={() => void load(page)} /> : null}
      <Section title={sectionTitle} actions={<SegmentedControl ariaLabel={usesDefaultTripLabel ? "Scheduled ride status" : `Scheduled ${tripWord} status`} value={filter} onValueChange={(value) => setFilter(value as (typeof FILTERS)[number])} options={FILTERS.map((value) => ({ value, label: value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase() }))} />}>
        {loading ? <div role="status" aria-label={`Loading ${pageTitle.toLowerCase()}`} aria-busy="true" className="stack">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div> : (
          <DataTable
            data={visibleRows}
            columns={columns}
            getRowKey={(ride) => ride.id}
            ariaLabel={pageTitle}
            emptyState={<EmptyState title={rows.length ? (usesDefaultTripLabel ? "No bookings in this status" : `No ${tripsLabel.toLowerCase()} in this status`) : (usesDefaultTripLabel ? "No upcoming bookings" : `No upcoming ${tripsLabel.toLowerCase()}`)} description={rows.length ? `Choose another status to see more ${tripsLabel.toLowerCase()}.` : (usesDefaultTripLabel ? "Scheduled bookings will appear here when riders reserve ahead." : `Scheduled ${tripsLabel.toLowerCase()} will appear here when ${ridersLabel} reserve ahead.`)} action={rows.length ? <button className="secondary-button" type="button" onClick={() => setFilter("ALL")}>Show all {usesDefaultTripLabel ? "bookings" : tripsLabel.toLowerCase()}</button> : <a className="secondary-button" href="/dispatch">Open dispatch</a>} />}
          />
        )}
        {!loading ? <Pagination page={page + 1} totalPages={totalPages} onPageChange={(next) => void load(next - 1)} /> : null}
      </Section>
    </div>
  );
}
