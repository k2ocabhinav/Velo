"use client";

import { useEffect, useState } from "react";
import {
  Button, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, PageHeader, Pagination, Section, SegmentedControl, Sheet, Skeleton, StatusBadge, Textarea,
  type DataTableColumn,
} from "@velo/ui";
import { DateTime } from "@velo/ui";
import { adminClient, type DriverStatus, type PendingDriver } from "../_lib/admin-client";
import { normalizePageNumber, normalizeTotalPages, pageFallbackAfterMutation, toActionErrorMessage } from "../_lib/ui-state";

const PAGE_SIZE = 10;
const STATUSES: Array<{ label: string; value: DriverStatus }> = [
  { label: "Pending", value: "PENDING" },
  { label: "Active", value: "APPROVED" },
  { label: "Suspended", value: "SUSPENDED" },
];

type ConfirmAction = { title: string; description: string; label: string; run: () => Promise<void> };

export default function DriversPage() {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<DriverStatus>("PENDING");
  const [counts, setCounts] = useState<Record<DriverStatus, number>>({ PENDING: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0 });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingDriver | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  async function load(targetStatus = selectedStatus, targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [response, pending, active, suspended] = await Promise.all([
        adminClient.getDriversByStatus(targetStatus, targetPage, PAGE_SIZE),
        adminClient.getDriversByStatus("PENDING", 0, 1),
        adminClient.getDriversByStatus("APPROVED", 0, 1),
        adminClient.getDriversByStatus("SUSPENDED", 0, 1),
      ]);
      const content = response.content ?? [];
      const nextPage = normalizePageNumber(response.number, targetPage);
      const nextTotalPages = normalizeTotalPages(response.totalPages);
      const fallbackPage = allowFallback ? pageFallbackAfterMutation({ requestedPage: targetPage, returnedPage: nextPage, totalPages: nextTotalPages, itemCount: content.length }) : null;
      if (fallbackPage !== null && fallbackPage !== targetPage) return await load(targetStatus, fallbackPage, false);
      setDrivers(content);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
      setCounts({ PENDING: pending.totalElements, APPROVED: active.totalElements, SUSPENDED: suspended.totalElements, REJECTED: 0 });
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Couldn't load the driver list."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load("PENDING", 0); }, []);

  async function runAction(driver: PendingDriver, operation: () => Promise<void>, success: string): Promise<void> {
    setProcessingId(driver.driverId);
    setError(null);
    setStatusMessage(null);
    try {
      await operation();
      await load(selectedStatus, page);
      setStatusMessage(success);
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Couldn't update this driver."));
    } finally {
      setProcessingId(null);
    }
  }

  async function approve(driver: PendingDriver): Promise<void> {
    await runAction(driver, () => adminClient.approveDriver(driver.driverId), "Driver approved.");
  }

  async function submitReject(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!rejectTarget || !rejectReason.trim()) return;
    const driver = rejectTarget;
    const reason = rejectReason.trim();
    setRejectTarget(null);
    setRejectReason("");
    setConfirmAction({
      title: "Reject driver application?",
      description: `The application for ${driver.name} will be rejected. Reason: ${reason}`,
      label: "Reject application",
      run: () => runAction(driver, () => adminClient.rejectDriver(driver.driverId, reason), "Driver application rejected."),
    });
  }

  const columns: DataTableColumn<PendingDriver>[] = [
    { header: "Name", cell: (driver) => <><strong>{driver.name}</strong><br /><span className="helper">{driver.email}</span></> },
    { header: "Vehicle", accessorKey: "vehicleId" },
    { header: "Applied", cell: (driver) => <DateTime value={driver.appliedAt} /> },
    { header: "Rating", cell: (driver) => Number.isFinite(driver.rating) ? driver.rating.toFixed(1) : "—" },
    { header: "Status", cell: (driver) => <StatusBadge domain="driver" status={driver.onboardingStatus ?? selectedStatus} /> },
    { header: "", cell: (driver) => selectedStatus === "PENDING" ? <Button size="sm" loading={processingId === driver.driverId} onClick={() => void approve(driver)}>Approve driver</Button> : null },
  ];

  return (
    <div className="stack">
      <PageHeader title="Drivers" description="Review applications and manage driver access." />
      {error ? <ErrorState title="Couldn't update the driver list" description={error} onRetry={() => void load(selectedStatus, page)} /> : null}
      {statusMessage ? <p role="status" className="helper">{statusMessage}</p> : null}

      <Section title="Driver applications" actions={<SegmentedControl ariaLabel="Driver status" value={selectedStatus} onValueChange={(value) => { const status = value as DriverStatus; setSelectedStatus(status); setPage(0); setStatusMessage(null); void load(status, 0); }} options={STATUSES.map((tab) => ({ ...tab, count: counts[tab.value] }))} />}>
        {loading ? <div aria-label="Loading drivers" aria-busy="true" className="stack">{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-12" key={index} />)}</div> : (
          <DataTable
            data={drivers}
            columns={columns}
            getRowKey={(driver) => driver.driverId}
            ariaLabel="Drivers"
            emptyState={<EmptyState title={selectedStatus === "PENDING" ? "No applications to review" : `No ${selectedStatus === "APPROVED" ? "active" : "suspended"} drivers`} description={selectedStatus === "PENDING" ? "New driver applications will appear here." : "Choose another status to review more drivers."} action={<Button variant="secondary" onClick={() => { const next = selectedStatus === "PENDING" ? "APPROVED" : "PENDING"; setSelectedStatus(next); setPage(0); void load(next, 0); }}>View {selectedStatus === "PENDING" ? "active drivers" : "pending applications"}</Button>} />}
            rowActions={(driver) => selectedStatus === "PENDING"
              ? [{ label: "Reject", destructive: true, onSelect: () => { setRejectTarget(driver); setRejectReason(""); } }]
              : selectedStatus === "APPROVED"
                ? [{ label: "Suspend", destructive: true, onSelect: () => setConfirmAction({ title: "Suspend driver?", description: `${driver.name} will no longer receive new trips.`, label: "Suspend driver", run: () => runAction(driver, () => adminClient.suspendDriver(driver.driverId), "Driver suspended.") }) }]
                : [{ label: "Reinstate", onSelect: () => void runAction(driver, () => adminClient.approveDriver(driver.driverId), "Driver reinstated.") }]}
            rowActionsLabel={(driver) => `Actions for ${driver.name}`}
          />
        )}
        {!loading ? <Pagination page={page + 1} totalPages={totalPages} onPageChange={(next) => void load(selectedStatus, next - 1)} /> : null}
      </Section>

      <Sheet open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) setRejectTarget(null); }} title="Reject application" description={rejectTarget ? `Add a reason for rejecting ${rejectTarget.name}.` : undefined}>
        <form className="stack" onSubmit={(event) => void submitReject(event)}>
          <Field label="Reason"><Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} required rows={4} /></Field>
          <Button type="submit" variant="danger">Continue to confirmation</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open) setConfirmAction(null); }} title={confirmAction?.title ?? "Confirm driver change"} description={confirmAction?.description ?? "This changes driver access."} confirmLabel={confirmAction?.label ?? "Confirm"} onConfirm={async () => { await confirmAction?.run(); setConfirmAction(null); }} />
    </div>
  );
}
