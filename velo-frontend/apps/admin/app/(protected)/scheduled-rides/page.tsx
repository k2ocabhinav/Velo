"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type ScheduledRide } from "../_lib/admin-client";
import { toCurrency } from "../_lib/http";
import {
  normalizePageNumber,
  normalizeTotalPages,
  pageFallbackAfterMutation,
  toActionErrorMessage,
} from "../_lib/ui-state";

const PAGE_SIZE = 10;

function badgeTone(status: string): "warning" | "success" | "danger" {
  const normalized = status.toLowerCase();
  if (normalized.includes("cancel")) {
    return "danger";
  }
  if (normalized.includes("complete") || normalized.includes("confirm") || normalized.includes("scheduled")) {
    return "success";
  }
  return "warning";
}

function formatScheduledTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Schedule time unavailable";
  }
  return date.toLocaleString();
}

export default function ScheduledRidesPage() {
  const [rows, setRows] = useState<ScheduledRide[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const payload = await adminClient.getScheduledRides(targetPage, PAGE_SIZE);
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
      setError(toActionErrorMessage(loadError, "Unable to load scheduled rides."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  return (
    <div className="stack">
      <PageFrame title="Scheduled rides" description="Review pre-booked trips and upcoming ride reservations." />

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void load(page)}>
            Retry
          </button>
        </div>
      ) : null}
      {loading ? <p className="helper">Loading scheduled rides...</p> : null}

      <section className="panel metric-card">
        {!loading && rows.length === 0 ? <p className="helper">No scheduled rides found.</p> : null}

        {!loading && rows.length > 0 ? (
          <div className="list">
            {rows.map((ride) => (
              <div key={ride.id} className="list-item">
                <div>
                  <strong>Ride #{ride.id}</strong>
                  <p>{formatScheduledTime(ride.scheduledTime)}</p>
                  <p>{ride.paymentMethod} · {toCurrency(ride.fare)}</p>
                </div>
                <span className="badge" data-tone={badgeTone(ride.status)}>
                  {ride.status}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pager">
          <button className="secondary-button" type="button" disabled={loading || page <= 0} onClick={() => void load(page - 1)}>
            Previous
          </button>
          <p className="helper">Page {page + 1} of {totalPages}</p>
          <button className="secondary-button" type="button" disabled={loading || page + 1 >= totalPages} onClick={() => void load(page + 1)}>
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
