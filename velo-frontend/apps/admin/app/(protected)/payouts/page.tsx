"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type PayoutItem } from "../_lib/admin-client";
import { toCurrency } from "../_lib/http";

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
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function load(targetPage = page): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getPendingPayouts(targetPage, 10);
      setRows(payload.content ?? []);
      setPage(payload.number ?? targetPage);
      setTotalPages(Math.max(payload.totalPages ?? 1, 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  async function approvePayout(id: number): Promise<void> {
    setSubmittingId(id);
    setError(null);
    try {
      await adminClient.approvePayout(id, "Approved via admin payouts queue.");
      await load(page);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to approve payout.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Payouts" description="Review queued payouts before they are processed." />

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="helper">Loading payouts...</p> : null}

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
                    <button
                      className="primary-button"
                      type="button"
                      disabled={submittingId === payout.id}
                      onClick={() => void approvePayout(payout.id)}
                    >
                      {submittingId === payout.id ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
            <button type="button" disabled={page <= 0 || loading} onClick={() => void load(page - 1)}>
              Previous
            </button>
            <p className="helper">Page {page + 1} of {totalPages}</p>
            <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => void load(page + 1)}>
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
