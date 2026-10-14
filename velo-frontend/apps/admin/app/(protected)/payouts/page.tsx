"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, DataTable, EmptyState, ErrorState, PageHeader, Pagination, Section, SegmentedControl, Skeleton, StatusBadge, Money, DateTime, type DataTableColumn } from "@velo/ui";
import { adminClient, type PayoutItem } from "../_lib/admin-client";
import { normalizePageNumber, normalizeTotalPages, pageFallbackAfterMutation, toActionErrorMessage } from "../_lib/ui-state";

const ACTION_NOTES = { approve: "Approved via admin payouts queue.", reject: "Rejected during admin payout review." } as const;
type PayoutAction = "approve" | "reject" | "process";
type ConfirmAction = { payout: PayoutItem; action: PayoutAction };
const FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED", "PROCESSED"] as const;

export default function PayoutsPage() {
  const [rows, setRows] = useState<PayoutItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  async function load(targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getPendingPayouts(targetPage, 10);
      const content = payload.content ?? [];
      const nextPage = normalizePageNumber(payload.number, targetPage);
      const nextTotalPages = normalizeTotalPages(payload.totalPages);
      const fallback = allowFallback ? pageFallbackAfterMutation({ requestedPage: targetPage, returnedPage: nextPage, totalPages: nextTotalPages, itemCount: content.length }) : null;
      if (fallback !== null && fallback !== targetPage) return await load(fallback, false);
      setRows(content);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Couldn't load payouts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(0); }, []);

  const visibleRows = useMemo(() => filter === "ALL" ? rows : rows.filter((payout) => String(payout.status).toUpperCase() === filter), [rows, filter]);

  async function runAction(payout: PayoutItem, action: PayoutAction): Promise<void> {
    setSubmittingId(payout.id);
    setError(null);
    setStatusMessage(null);
    try {
      if (action === "approve") await adminClient.approvePayout(payout.id, ACTION_NOTES.approve);
      else if (action === "reject") await adminClient.rejectPayout(payout.id, ACTION_NOTES.reject);
      else await adminClient.processPayout(payout.id);
      await load(page);
      setStatusMessage(`Payout ${action === "process" ? "processed" : `${action}d`}.`);
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, `Couldn't ${action} payout.`));
    } finally {
      setSubmittingId(null);
    }
  }

  const columns: DataTableColumn<PayoutItem>[] = [
    { header: "Amount", cell: (payout) => <Money amount={payout.amount} emphasis /> },
    { header: "Requested", cell: (payout) => <DateTime value={payout.requestedAt} /> },
    { header: "Status", cell: (payout) => <StatusBadge domain="payout" status={payout.status} /> },
  ];

  const confirmLabels: Record<PayoutAction, string> = { approve: "Approve payout", reject: "Reject payout", process: "Process payout" };
  const descriptions: Record<PayoutAction, string> = { approve: "Approve this request so it can move to processing.", reject: "Reject this payout request. The driver will not receive this payment.", process: "Send this approved payout for processing." };

  return (
    <div className="stack">
      <PageHeader title="Payouts" description="Review driver payout requests and track processing." />
      {error ? <ErrorState title="Couldn't update payouts" description={error} onRetry={() => void load(page)} /> : null}
      {statusMessage ? <p role="status" className="helper">{statusMessage}</p> : null}
      <Section title="Payout requests" actions={<SegmentedControl ariaLabel="Payout status filter" value={filter} onValueChange={(value) => setFilter(value as (typeof FILTERS)[number])} options={FILTERS.map((value) => ({ value, label: value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase() }))} />}>
        {loading ? <div aria-label="Loading payouts" aria-busy="true" className="stack">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div> : (
          <DataTable
            data={visibleRows}
            columns={columns}
            getRowKey={(payout) => payout.id}
            ariaLabel="Payout requests"
            emptyState={<EmptyState title={rows.length ? "No payouts in this status" : "No pending payouts"} description={rows.length ? "Choose another filter to see more requests." : "New driver payout requests will appear here for review."} action={rows.length ? <button className="secondary-button" type="button" onClick={() => setFilter("ALL")}>Show all payouts</button> : <a className="secondary-button" href="/drivers">Review drivers</a>} />}
            rowActions={(payout) => {
              const status = String(payout.status).toUpperCase();
              if (status === "PENDING") return [
                { label: "Approve payout", disabled: submittingId === payout.id, onSelect: () => setConfirmAction({ payout, action: "approve" }) },
                { label: "Reject payout", destructive: true, disabled: submittingId === payout.id, onSelect: () => setConfirmAction({ payout, action: "reject" }) },
              ];
              if (status === "APPROVED") return [{ label: "Process payout", destructive: true, disabled: submittingId === payout.id, onSelect: () => setConfirmAction({ payout, action: "process" }) }];
              return [];
            }}
            rowActionsLabel={() => "Payout actions"}
          />
        )}
        {!loading ? <Pagination page={page + 1} totalPages={totalPages} onPageChange={(next) => void load(next - 1)} /> : null}
      </Section>
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={confirmAction ? `${confirmAction.action === "process" ? "Process" : confirmAction.action === "approve" ? "Approve" : "Reject"} payout?` : "Confirm payout action"}
        description={confirmAction ? descriptions[confirmAction.action] : "This changes the payout request."}
        confirmLabel={confirmAction ? confirmLabels[confirmAction.action] : "Confirm"}
        destructive={confirmAction?.action !== "approve"}
        onConfirm={async () => { if (confirmAction) await runAction(confirmAction.payout, confirmAction.action); setConfirmAction(null); }}
      />
    </div>
  );
}
