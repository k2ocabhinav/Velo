"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, DataTable, DateTime, EmptyState, ErrorState, Field, Menu, PageHeader, Section, SegmentedControl, Skeleton, StatusBadge, type DataTableColumn } from "@velo/ui";
import { adminClient, type TripSheetRow } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";
import { getTenantLabelForCount, getTenantPluralTripLabel } from "@velo/app-core/tenant";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { TenantStatus } from "../_components/tenant-status";

type AssignmentFilter = "ALL" | "UNASSIGNED" | "ASSIGNED";
type ReasonAction = { kind: "cancel" | "no-show"; row: TripSheetRow };

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readableReason(value?: string | null): string {
  if (!value) return "—";
  return value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export default function TripSheetPage() {
  const { riderLabel, driverLabel, tripLabel } = useTenantBrandingOrDefault();
  const driverWord = getTenantLabelForCount(1, driverLabel, { midSentence: true, fallback: "Driver" });
  const tripWord = getTenantLabelForCount(1, tripLabel, { midSentence: true, fallback: "Trip" });
  const tripsLabel = getTenantPluralTripLabel(tripLabel);
  const usesDefaultTripLabel = tripLabel.trim().toLowerCase() === "trip";
  const [date, setDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return localDateString(tomorrow);
  });
  const [assignment, setAssignment] = useState<AssignmentFilter>("ALL");
  const [rows, setRows] = useState<TripSheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reasonNote, setReasonNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setRows(await adminClient.getTripSheet(date, assignment));
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, `Couldn't load the ${tripWord} sheet.`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [date, assignment]);

  async function exportCsv(): Promise<void> {
    setExporting(true);
    setError(null);
    try {
      const csv = await adminClient.exportTripSheet(date);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${tripWord}-sheet-${date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(toActionErrorMessage(exportError, `Couldn't export the ${tripWord} sheet.`));
    } finally {
      setExporting(false);
    }
  }

  async function confirmReasonAction(): Promise<void> {
    if (!reasonAction) return;
    setError(null);
    setMessage(null);
    try {
      if (reasonAction.kind === "cancel") {
        await adminClient.cancelTripSheetRide(reasonAction.row.rideRequestId, "OPERATOR_CANCELLED", reasonNote);
        setMessage(`Scheduled ${tripWord} cancelled.`);
      } else {
        await adminClient.markTripSheetNoShow(reasonAction.row.rideRequestId, "CUSTOMER_NO_SHOW", reasonNote);
        setMessage(`${tripLabel} marked as a no-show.`);
      }
      setReasonAction(null);
      setReasonNote("");
      await load();
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, `Couldn't update this scheduled ${tripWord}.`));
    }
  }

  const groups = useMemo(() => {
    const byHour = new Map<string, TripSheetRow[]>();
    for (const row of rows) {
      const hour = row.scheduledTime.slice(11, 13) || "—";
      const key = hour === "—" ? hour : `${hour}:00`;
      byHour.set(key, [...(byHour.get(key) ?? []), row]);
    }
    return [...byHour.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [rows]);

  const columns: DataTableColumn<TripSheetRow>[] = [
    { header: "Time", cell: (row) => <DateTime value={row.scheduledTime} /> },
    { header: "Booking reference", cell: (row) => row.bookingReference || "—" },
    { header: riderLabel, cell: (row) => row.riderName || "—" },
    { header: "Pickup", cell: (row) => row.pickupAddress || "Address unavailable" },
    { header: "Drop-off", cell: (row) => row.dropOffAddress || "Address unavailable" },
    { header: driverLabel, cell: (row) => row.assigned ? row.driverName || "Assigned" : <span className={row.needsAttention ? "trip-sheet-attention" : undefined}>{row.needsAttention ? `Needs a ${driverWord}` : "Unassigned"}</span> },
    { header: "Status", cell: (row) => <div className="stack trip-sheet-status">{row.status === "PENDING" ? <TenantStatus domain="request" status={row.status} label={`Finding a ${driverWord}`} /> : <StatusBadge domain="request" status={row.status} />}{row.reasonCode ? <span>{readableReason(row.reasonCode)}{row.reasonNote ? ` · ${row.reasonNote}` : ""}</span> : null}</div> },
  ];

  function actionsForRow(row: TripSheetRow) {
    const actions: { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean }[] = [];
    if (row.status === "SCHEDULED" || row.status === "PENDING") {
      actions.push({ label: "Cancel scheduled trip", onSelect: () => openReasonAction({ kind: "cancel", row }), destructive: true });
    }
    if (row.status === "CONFIRMED") {
      actions.push({ label: "Mark no-show", onSelect: () => openReasonAction({ kind: "no-show", row }), destructive: true, disabled: new Date(row.scheduledTime).getTime() > Date.now() });
    }
    return actions;
  }

  function openReasonAction(action: ReasonAction): void {
    setReasonNote("");
    setReasonAction(action);
  }

  return (
    <div className="stack">
      <PageHeader title={`${tripLabel} sheet`} description={usesDefaultTripLabel ? "Review scheduled trips by hour and see which rides still need a driver." : `Review scheduled ${tripsLabel.toLowerCase()} by hour and see which still need a ${driverWord}.`} />
      {error ? <ErrorState title={`Couldn't load the ${tripWord} sheet`} description={error} onRetry={() => void load()} /> : null}
      {message ? <p className="booking-feedback" role="status">{message}</p> : null}
      <Section title={`Scheduled ${tripsLabel.toLowerCase()}`} actions={
        <div className="trip-sheet-controls">
          <label className="trip-sheet-date">Date<input aria-label="Trip sheet date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <SegmentedControl ariaLabel={`${driverLabel} assignment filter`} value={assignment} onValueChange={(value) => setAssignment(value as AssignmentFilter)} options={[
            { value: "ALL", label: "All" },
            { value: "UNASSIGNED", label: "Unassigned" },
            { value: "ASSIGNED", label: "Assigned" },
          ]} />
          <button className="secondary-button" type="button" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? "Preparing CSV…" : "Export CSV"}</button>
        </div>
      }>
        {loading ? <div className="stack" role="status" aria-label={`Loading ${tripWord} sheet`} aria-busy="true">{[0, 1, 2].map((index) => <Skeleton className="h-12" key={index} />)}</div> : rows.length === 0 ? (
          <EmptyState title={`No scheduled ${tripsLabel.toLowerCase()} for this date`} description="Choose another date or clear the assignment filter." action={assignment !== "ALL" ? <button className="secondary-button" type="button" onClick={() => setAssignment("ALL")}>Show all {tripsLabel.toLowerCase()}</button> : undefined} />
        ) : (
          <div className="trip-sheet-groups">
            {groups.map(([hour, hourRows]) => <section className="trip-sheet-hour" key={hour} aria-label={`${tripsLabel} at ${hour}`}>
              <h3>{hour} <span>{hourRows.length} {getTenantLabelForCount(hourRows.length, tripLabel, { midSentence: true })}</span></h3>
              <DataTable
                className="trip-sheet-desktop-table"
                data={hourRows}
                columns={columns}
                getRowKey={(row) => row.rideRequestId}
                ariaLabel={`Scheduled ${tripsLabel.toLowerCase()} at ${hour}`}
                rowActions={actionsForRow}
                rowActionsLabel={(row) => `Actions for ${row.riderName || `scheduled ${tripWord}`}`}
              />
              <div className="trip-sheet-mobile-list" role="group" aria-label={`Scheduled ${tripsLabel.toLowerCase()} at ${hour}`}>
                {hourRows.map((row) => <article className="trip-sheet-mobile-card" key={row.rideRequestId}>
                  <header>
                    <div className="stack compact">
                      <span className="trip-sheet-mobile-label">Time</span>
                      <strong><DateTime value={row.scheduledTime} /></strong>
                    </div>
                    {actionsForRow(row).length > 0 ? <Menu
                      items={actionsForRow(row)}
                      triggerLabel={`Actions for ${row.riderName || `scheduled ${tripWord}`}`}
                      ariaLabel="Trip actions"
                    /> : null}
                  </header>
                  <dl>
                    <div><dt>Booking reference</dt><dd>{row.bookingReference || "—"}</dd></div>
                    <div><dt>{riderLabel}</dt><dd>{row.riderName || "—"}</dd></div>
                    <div><dt>Pickup</dt><dd>{row.pickupAddress || "Address unavailable"}</dd></div>
                    <div><dt>Drop-off</dt><dd>{row.dropOffAddress || "Address unavailable"}</dd></div>
                    <div><dt>{driverLabel}</dt><dd>{row.assigned ? row.driverName || "Assigned" : <span className={row.needsAttention ? "trip-sheet-attention" : undefined}>{row.needsAttention ? `Needs a ${driverWord}` : "Unassigned"}</span>}</dd></div>
                    <div><dt>Status</dt><dd>{row.status === "PENDING" ? <TenantStatus domain="request" status={row.status} label={`Finding a ${driverWord}`} /> : <StatusBadge domain="request" status={row.status} />}</dd></div>
                    {row.reasonCode ? <div className="trip-sheet-mobile-full"><dt>Reason</dt><dd>{readableReason(row.reasonCode)}{row.reasonNote ? ` · ${row.reasonNote}` : ""}</dd></div> : null}
                  </dl>
                </article>)}
              </div>
            </section>)}
          </div>
        )}
      </Section>
      <ConfirmDialog
        open={reasonAction !== null}
        onOpenChange={(open) => { if (!open) setReasonAction(null); }}
        title={reasonAction?.kind === "cancel" ? `Cancel this scheduled ${tripWord}?` : `Mark this ${tripWord} as a no-show?`}
        description={reasonAction?.kind === "cancel"
          ? `The ${tripWord} will be cancelled with the reason Operator cancelled.`
          : `The ${tripWord} will be marked as a ${riderLabel.toLowerCase()} no-show.`}
        confirmLabel={reasonAction?.kind === "cancel" ? `Cancel scheduled ${tripWord}` : "Mark no-show"}
        onConfirm={confirmReasonAction}
      >
        <Field label="Reason note (optional)">
          <textarea className="ui-control" maxLength={1024} value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
