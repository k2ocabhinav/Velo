"use client";

import { useEffect, useMemo, useState } from "react";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { PageFrame } from "../_components/page-frame";
import {
  adminClient,
  type AdminActiveRide,
  type AdminDispatchAudit,
  type AdminOpsHealth,
  type AdminPendingRideRequest,
  type AdminRideOffer,
} from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";

const PAGE_SIZE = 10;

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Unavailable";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "Unavailable";
  }
  return parsed.toLocaleString();
}

function normalizeReason(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function askDriverId(label: string): number | null {
  const input = window.prompt(label);
  if (!input) {
    return null;
  }
  const parsed = Number(input.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function askReason(label: string): string | null {
  return normalizeReason(window.prompt(label));
}

export default function AdminDispatchPage() {
  const [pendingRequests, setPendingRequests] = useState<AdminPendingRideRequest[]>([]);
  const [activeRides, setActiveRides] = useState<AdminActiveRide[]>([]);
  const [auditRows, setAuditRows] = useState<AdminDispatchAudit[]>([]);
  const [offersByRequest, setOffersByRequest] = useState<Record<number, AdminRideOffer[]>>({});
  const [opsHealth, setOpsHealth] = useState<AdminOpsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});

  const redisTone: "success" | "warning" = opsHealth?.redisAvailable ? "success" : "warning";
  const dispatchSnapshot = useMemo(() => {
    if (!opsHealth) {
      return "Loading operations health...";
    }
    return `${opsHealth.pendingRideRequests} pending requests · ${opsHealth.dispatchQueueDepth} open offers · ${opsHealth.expiredOfferCount} expired offers`;
  }, [opsHealth]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [pendingPage, activePage, auditPage, health] = await Promise.all([
        adminClient.getPendingRideRequests(0, PAGE_SIZE),
        adminClient.getActiveRides(0, PAGE_SIZE),
        adminClient.getDispatchAudit(0, PAGE_SIZE),
        adminClient.getOpsHealth(),
      ]);
      setPendingRequests(pendingPage.content ?? []);
      setActiveRides(activePage.content ?? []);
      setAuditRows(auditPage.content ?? []);
      setOpsHealth(health);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Unable to load dispatch console data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function runAction(actionKey: string, operation: () => Promise<void>, successMessage: string): Promise<void> {
    if (isActionPending(pendingActions, actionKey)) {
      return;
    }

    setPendingActions((current) => setActionPending(current, actionKey, true));
    setError(null);
    setStatusMessage(null);
    try {
      await operation();
      await loadAll();
      setStatusMessage(successMessage);
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Unable to complete dispatch action."));
    } finally {
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  async function toggleOffers(rideRequestId: number): Promise<void> {
    if (offersByRequest[rideRequestId]) {
      setOffersByRequest((current) => {
        const next = { ...current };
        delete next[rideRequestId];
        return next;
      });
      return;
    }

    const actionKey = `offers:${rideRequestId}`;
    await runAction(
      actionKey,
      async () => {
        const offers = await adminClient.getRideRequestOffers(rideRequestId);
        setOffersByRequest((current) => ({ ...current, [rideRequestId]: offers }));
      },
      "Offer lifecycle loaded.",
    );
  }

  async function assignRequest(rideRequestId: number): Promise<void> {
    const driverId = askDriverId("Assign ride request to driver ID:");
    if (!driverId) {
      setError("Please enter a valid driver ID.");
      return;
    }
    const reason = askReason("Reason for assignment:");
    if (!reason) {
      setError("Reason is required for assignment.");
      return;
    }

    await runAction(
      `assign:${rideRequestId}`,
      async () => adminClient.assignPendingRideRequest(rideRequestId, driverId, reason),
      `Ride request #${rideRequestId} assigned to driver #${driverId}.`,
    );
  }

  async function cancelPendingRequest(rideRequestId: number): Promise<void> {
    const reason = askReason("Reason for forced cancellation:");
    if (!reason) {
      setError("Reason is required for force cancellation.");
      return;
    }

    await runAction(
      `cancel-request:${rideRequestId}`,
      async () => adminClient.cancelPendingRideRequest(rideRequestId, reason),
      `Ride request #${rideRequestId} cancelled.`,
    );
  }

  async function reassignRide(rideId: number): Promise<void> {
    const driverId = askDriverId("Reassign ride to driver ID:");
    if (!driverId) {
      setError("Please enter a valid driver ID.");
      return;
    }
    const reason = askReason("Reason for reassignment:");
    if (!reason) {
      setError("Reason is required for reassignment.");
      return;
    }

    await runAction(
      `reassign:${rideId}`,
      async () => adminClient.reassignRide(rideId, driverId, reason),
      `Ride #${rideId} reassigned to driver #${driverId}.`,
    );
  }

  async function cancelRide(rideId: number): Promise<void> {
    const reason = askReason("Reason for force-cancelling this ride:");
    if (!reason) {
      setError("Reason is required for ride cancellation.");
      return;
    }

    await runAction(
      `cancel-ride:${rideId}`,
      async () => adminClient.cancelRide(rideId, reason),
      `Ride #${rideId} cancelled by operations.`,
    );
  }

  return (
    <div className="stack">
      <PageFrame
        title="Dispatch Console"
        description="Override assignments, resolve stuck requests, and review operational audit trails."
      />

      <section className="metric-grid">
        <article className="panel metric-card">
          <small>Redis connectivity</small>
          <strong>{opsHealth?.redisAvailable ? "Connected" : "Degraded"}</strong>
          <span>{dispatchSnapshot}</span>
          <span className="badge" data-tone={redisTone}>
            {opsHealth?.redisAvailable ? "Healthy" : "Fallback to DB"}
          </span>
        </article>
        <article className="panel metric-card">
          <small>Cache counters</small>
          <strong>{Math.trunc(opsHealth?.cacheHits ?? 0)}</strong>
          <span>Hits · {Math.trunc(opsHealth?.cacheMisses ?? 0)} misses · {Math.trunc(opsHealth?.cacheErrors ?? 0)} errors</span>
        </article>
        <article className="panel metric-card">
          <small>Platform entities</small>
          <strong>{opsHealth?.totalRides ?? 0}</strong>
          <span>{opsHealth?.totalDrivers ?? 0} drivers · {opsHealth?.totalRiders ?? 0} riders</span>
        </article>
        <article className="panel metric-card">
          <small>Updated</small>
          <strong>{loading ? "..." : formatDateTime(opsHealth?.updatedAt)}</strong>
          <span>Operations health refresh timestamp</span>
        </article>
      </section>

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void loadAll()}>
            Retry
          </button>
        </div>
      ) : null}
      {statusMessage ? <p className="helper">{statusMessage}</p> : null}
      {loading ? <p className="helper">Loading dispatch console...</p> : null}

      <section className="cards-grid">
        <article className="panel metric-card">
          <small>Pending requests</small>
          <div className="list">
            {pendingRequests.length === 0 ? <p className="helper">No pending requests in the queue.</p> : null}
            {pendingRequests.map((request) => {
              const offerRows = offersByRequest[request.rideRequestId] ?? null;
              return (
                <article key={request.rideRequestId} className="list-item list-item-stack">
                  <div>
                    <strong>Request #{request.rideRequestId}</strong>
                    <p>
                      Rider: {request.riderName ?? "Unknown"} · Fare: {request.fare ?? "N/A"} · Offers:{" "}
                      {request.offeredDriverCount ?? 0}
                    </p>
                    <p>Status: {request.status ?? "PENDING"} · Requested at {formatDateTime(request.requestedTime)}</p>
                  </div>
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isActionPending(pendingActions, `offers:${request.rideRequestId}`)}
                      onClick={() => void toggleOffers(request.rideRequestId)}
                    >
                      {offerRows ? "Hide offers" : "Show offers"}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={isActionPending(pendingActions, `assign:${request.rideRequestId}`)}
                      onClick={() => void assignRequest(request.rideRequestId)}
                    >
                      {isActionPending(pendingActions, `assign:${request.rideRequestId}`) ? "Assigning..." : "Assign"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={isActionPending(pendingActions, `cancel-request:${request.rideRequestId}`)}
                      onClick={() => void cancelPendingRequest(request.rideRequestId)}
                    >
                      {isActionPending(pendingActions, `cancel-request:${request.rideRequestId}`) ? "Cancelling..." : "Force cancel"}
                    </button>
                  </div>
                  {offerRows ? (
                    <div className="stack">
                      {offerRows.length === 0 ? <p className="helper">No offers found.</p> : null}
                      {offerRows.map((offer) => (
                        <div key={offer.offerId} className="dispatch-offer-row">
                          <span>
                            #{offer.offerId} · Driver #{offer.driverId ?? "?"} ({offer.driverName ?? "Unknown"})
                          </span>
                          <span>{offer.status ?? "UNKNOWN"}</span>
                          <span>Expires: {formatDateTime(offer.expiresAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </article>

        <article className="panel metric-card">
          <small>Active rides</small>
          <div className="list">
            {activeRides.length === 0 ? <p className="helper">No active rides currently.</p> : null}
            {activeRides.map((ride) => (
              <article key={ride.rideId} className="list-item">
                <div>
                  <strong>Ride #{ride.rideId}</strong>
                  <p>
                    Rider: {ride.riderName ?? "Unknown"} · Driver: {ride.driverName ?? "Unassigned"} · Status:{" "}
                    {ride.status ?? "UNKNOWN"}
                  </p>
                  <p>Started at {formatDateTime(ride.startedAt)} · Created {formatDateTime(ride.createdTime)}</p>
                </div>
                <div className="row-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isActionPending(pendingActions, `reassign:${ride.rideId}`)}
                    onClick={() => void reassignRide(ride.rideId)}
                  >
                    {isActionPending(pendingActions, `reassign:${ride.rideId}`) ? "Reassigning..." : "Reassign"}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={isActionPending(pendingActions, `cancel-ride:${ride.rideId}`)}
                    onClick={() => void cancelRide(ride.rideId)}
                  >
                    {isActionPending(pendingActions, `cancel-ride:${ride.rideId}`) ? "Cancelling..." : "Force cancel"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="panel metric-card">
        <small>Dispatch audit trail</small>
        <div className="list">
          {auditRows.length === 0 ? <p className="helper">No admin overrides recorded yet.</p> : null}
          {auditRows.map((audit) => (
            <div key={audit.id} className="list-item">
              <div>
                <strong>{audit.actionType ?? "ACTION"}</strong>
                <p>
                  Actor #{audit.actorUserId ?? "?"} · Request #{audit.rideRequestId ?? "—"} · Ride #{audit.rideId ?? "—"}
                </p>
                <p>{audit.reason ?? "No reason provided."}</p>
              </div>
              <span className="helper">{formatDateTime(audit.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
