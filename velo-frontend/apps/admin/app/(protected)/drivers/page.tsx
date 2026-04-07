"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type PendingDriver } from "../_lib/admin-client";

const PAGE_SIZE = 10;
const REJECT_REASON = "Rejected via admin review queue.";

function formatAppliedAt(value: string): string {
  const time = new Date(value);
  if (Number.isNaN(time.valueOf())) {
    return "Applied date unavailable";
  }
  return `Applied ${time.toLocaleString()}`;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  async function load(targetPage = page): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await adminClient.getPendingDrivers(targetPage, PAGE_SIZE);
      setDrivers(response.content);
      setPage(response.number);
      setTotalPages(Math.max(response.totalPages, 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load pending drivers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  async function approve(driverId: number): Promise<void> {
    setProcessingId(driverId);
    setError(null);
    try {
      await adminClient.approveDriver(driverId);
      await load(page);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Unable to approve driver.");
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(driverId: number): Promise<void> {
    setProcessingId(driverId);
    setError(null);
    try {
      await adminClient.rejectDriver(driverId, REJECT_REASON);
      await load(page);
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Unable to reject driver.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame
        title="Drivers"
        description="Review onboarding, documents, and approval status for new drivers."
      />

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="helper">Loading driver applications...</p> : null}

      <section className="panel metric-card">
        {!loading && drivers.length === 0 ? (
          <p className="helper">No pending drivers found.</p>
        ) : null}

        {!loading && drivers.length > 0 ? (
          <div className="list">
            {drivers.map((driver) => (
              <div key={driver.driverId} className="list-item">
                <div>
                  <strong>{driver.name}</strong>
                  <p>{driver.email} · {driver.vehicleId}</p>
                  <p>{formatAppliedAt(driver.appliedAt)}</p>
                </div>
                <div className="row-actions">
                  <span className="badge" data-tone="warning">
                    Pending review
                  </span>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={processingId === driver.driverId}
                    onClick={() => void approve(driver.driverId)}
                  >
                    {processingId === driver.driverId ? "Working..." : "Approve"}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={processingId === driver.driverId}
                    onClick={() => void reject(driver.driverId)}
                  >
                    {processingId === driver.driverId ? "Working..." : "Reject"}
                  </button>
                </div>
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
