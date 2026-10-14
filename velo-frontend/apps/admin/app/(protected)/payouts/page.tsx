"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@velo/ui/feedback";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type PayoutItem } from "../_lib/admin-client";
import { toCurrency } from "../_lib/http";
import {
  normalizePageNumber,
  normalizeTotalPages,
  pageFallbackAfterMutation,
  toActionErrorMessage,
} from "../_lib/ui-state";

const APPROVE_NOTE = "Approved via admin payouts queue.";
const REJECT_NOTE = "Rejected during admin payout review.";

function payoutTone(status: string): "warning" | "success" | "danger" {
  const normalized = status.toLowerCase();
  if (normalized.includes("approved") || normalized.includes("processed")) {
    return "success";
  }
  if (normalized.includes("reject")) {
    return "danger";
  }
  return "warning";
}

export default function PayoutsPage() {
  const [rows, setRows] = useState<PayoutItem[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function load(targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getPendingPayouts(targetPage, 10);
      const content = payload.content ?? [];
      const nextPage = normalizePageNumber(payload.number, targetPage);
      const nextTotalPages = normalizeTotalPages(payload.totalPages);
      const fallbackPage = allowFallback
        ? pageFallbackAfterMutation({
            requestedPage: targetPage,
            returnedPage: nextPage,
            totalPages: nextTotalPages,
            itemCount: content.length,
          })
        : null;

      if (fallbackPage !== null && fallbackPage !== targetPage) {
        await load(fallbackPage, false);
        return;
      }

      setRows(content);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Unable to load payouts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  async function approvePayout(id: number): Promise<void> {
    if (!window.confirm("Approve this payout request?")) {
      return;
    }

    setSubmittingId(id);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.approvePayout(id, APPROVE_NOTE);
      await load(page);
      setStatusMessage("Payout approved.");
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Unable to approve payout."));
    } finally {
      setSubmittingId(null);
    }
  }

  async function rejectPayout(id: number): Promise<void> {
    if (!window.confirm("Reject this payout request?")) {
      return;
    }

    setSubmittingId(id);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.rejectPayout(id, REJECT_NOTE);
      await load(page);
      setStatusMessage("Payout rejected.");
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Unable to reject payout."));
    } finally {
      setSubmittingId(null);
    }
  }

  async function processPayout(id: number): Promise<void> {
    if (!window.confirm("Process this approved payout now?")) {
      return;
    }

    setSubmittingId(id);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.processPayout(id);
      await load(page);
      setStatusMessage("Payout processed.");
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Unable to process payout."));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Payouts" description="Review queued payouts before they are processed." />

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void load(page)}>
            Retry
          </button>
        </div>
      ) : null}
      {statusMessage ? <p className="helper">{statusMessage}</p> : null}
      {loading ? (
        <section className="panel metric-card" aria-label="Loading payouts" aria-busy="true">
          <div className="list">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="list-item">
                <div className="stack compact">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <div className="stack compact" style={{ justifyItems: "end" }}>
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="panel metric-card">
          {rows.length === 0 ? (
            <p className="helper">No pending payouts found.</p>
          ) : (
            <div className="list">
              {rows.map((payout) => (
                <div key={payout.id} className="list-item">
                  <div>
                    <strong>Payout #{payout.id}</strong>
                    <p>{toCurrency(payout.amount)} · {new Date(payout.requestedAt).toLocaleString()}</p>
                  </div>
                  <div className="stack" style={{ justifyItems: "end", gap: 8 }}>
                    <span className="badge" data-tone={payoutTone(String(payout.status))}>
                      {String(payout.status)}
                    </span>
                    <div className="row-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={submittingId === payout.id}
                        onClick={() => void approvePayout(payout.id)}
                      >
                        {submittingId === payout.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        disabled={submittingId === payout.id}
                        onClick={() => void rejectPayout(payout.id)}
                      >
                        {submittingId === payout.id ? "Working..." : "Reject"}
                      </button>
                      {String(payout.status).toLowerCase().includes("approved") ? (
                        <button
                          className="primary-button"
                          type="button"
                          disabled={submittingId === payout.id}
                          onClick={() => void processPayout(payout.id)}
                        >
                          {submittingId === payout.id ? "Working..." : "Process"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pager">
            <button className="secondary-button" type="button" disabled={page <= 0 || loading} onClick={() => void load(page - 1)}>
              Previous
            </button>
            <p className="helper">Page {page + 1} of {totalPages}</p>
            <button className="secondary-button" type="button" disabled={page + 1 >= totalPages || loading} onClick={() => void load(page + 1)}>
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
