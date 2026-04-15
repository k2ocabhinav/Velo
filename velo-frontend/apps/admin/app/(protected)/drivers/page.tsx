"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type DriverStatus, type PendingDriver } from "../_lib/admin-client";
import {
  normalizePageNumber,
  normalizeTotalPages,
  pageFallbackAfterMutation,
  toActionErrorMessage,
} from "../_lib/ui-state";

const PAGE_SIZE = 10;
const REJECT_REASON = "Rejected via admin review queue.";

const STATUS_TABS: Array<{ label: string; value: DriverStatus }> = [
  { label: "Pending review", value: "PENDING" },
  { label: "Active / Approved", value: "APPROVED" },
  { label: "Suspended", value: "SUSPENDED" },
];

function formatAppliedAt(value: string): string {
  const time = new Date(value);
  if (Number.isNaN(time.valueOf())) {
    return "Applied date unavailable";
  }
  return `Applied ${time.toLocaleString()}`;
}

function statusTone(status: string | null | undefined): "warning" | "success" | "muted" {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "APPROVED") {
    return "success";
  }
  if (normalized === "PENDING") {
    return "warning";
  }
  return "muted";
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<DriverStatus>("PENDING");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  async function load(targetStatus = selectedStatus, targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await adminClient.getDriversByStatus(targetStatus, targetPage, PAGE_SIZE);
      const content = response.content ?? [];
      const nextPage = normalizePageNumber(response.number, targetPage);
      const nextTotalPages = normalizeTotalPages(response.totalPages);
      const fallbackPage = allowFallback
        ? pageFallbackAfterMutation({
            requestedPage: targetPage,
            returnedPage: nextPage,
            totalPages: nextTotalPages,
            itemCount: content.length,
          })
        : null;

      if (fallbackPage !== null && fallbackPage !== targetPage) {
        await load(targetStatus, fallbackPage, false);
        return;
      }

      setDrivers(content);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Unable to load driver queue."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("PENDING", 0);
  }, []);

  async function changeTab(nextStatus: DriverStatus): Promise<void> {
    setSelectedStatus(nextStatus);
    setPage(0);
    setStatusMessage(null);
    await load(nextStatus, 0);
  }

  async function approve(driverId: number): Promise<void> {
    if (!window.confirm("Approve this driver application?")) {
      return;
    }

    setProcessingId(driverId);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.approveDriver(driverId);
      await load(selectedStatus, page);
      setStatusMessage("Driver approved.");
    } catch (approveError) {
      setError(toActionErrorMessage(approveError, "Unable to approve driver."));
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(driverId: number): Promise<void> {
    if (!window.confirm("Reject this driver application?")) {
      return;
    }

    setProcessingId(driverId);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.rejectDriver(driverId, REJECT_REASON);
      await load(selectedStatus, page);
      setStatusMessage("Driver rejected.");
    } catch (rejectError) {
      setError(toActionErrorMessage(rejectError, "Unable to reject driver."));
    } finally {
      setProcessingId(null);
    }
  }

  async function suspend(driverId: number): Promise<void> {
    if (!window.confirm("Suspend this approved driver?")) {
      return;
    }
    setProcessingId(driverId);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.suspendDriver(driverId);
      await load(selectedStatus, page);
      setStatusMessage("Driver suspended.");
    } catch (suspendError) {
      setError(toActionErrorMessage(suspendError, "Unable to suspend driver."));
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame
        title="Drivers"
        description="Review onboarding, move approved drivers into active service, and suspend when needed."
      />

      <div className="actions">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={selectedStatus === tab.value ? "primary-button" : "secondary-button"}
            type="button"
            disabled={loading}
            onClick={() => void changeTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void load(selectedStatus, page)}>
            Retry
          </button>
        </div>
      ) : null}
      {statusMessage ? <p className="helper">{statusMessage}</p> : null}
      {loading ? (
        <div className="admin-loading" aria-live="polite" aria-label="Loading drivers">
          <div className="admin-skeleton" data-size="lg" />
          <div className="admin-skeleton" data-size="md" />
          <div className="admin-skeleton" data-size="sm" />
        </div>
      ) : null}

      <section className="panel metric-card">
        {!loading && drivers.length === 0 ? (
          <p className="helper">No drivers found for this status.</p>
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
                  <span className="badge" data-tone={statusTone(driver.onboardingStatus)}>
                    {(driver.onboardingStatus ?? selectedStatus).toUpperCase()}
                  </span>
                  {selectedStatus === "PENDING" ? (
                    <>
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
                    </>
                  ) : null}
                  {selectedStatus === "APPROVED" ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={processingId === driver.driverId}
                      onClick={() => void suspend(driver.driverId)}
                    >
                      {processingId === driver.driverId ? "Working..." : "Suspend"}
                    </button>
                  ) : null}
                  {selectedStatus === "SUSPENDED" ? (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={processingId === driver.driverId}
                      onClick={() => void approve(driver.driverId)}
                    >
                      {processingId === driver.driverId ? "Working..." : "Reinstate"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pager">
          <button
            className="secondary-button"
            type="button"
            disabled={loading || page <= 0}
            onClick={() => void load(selectedStatus, page - 1)}
          >
            Previous
          </button>
          <p className="helper">Page {page + 1} of {totalPages}</p>
          <button
            className="secondary-button"
            type="button"
            disabled={loading || page + 1 >= totalPages}
            onClick={() => void load(selectedStatus, page + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
