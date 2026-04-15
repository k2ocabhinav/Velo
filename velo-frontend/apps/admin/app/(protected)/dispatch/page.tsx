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
  type BrandingSettings,
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

type DispatchFormState = {
  pickupLat: string;
  pickupLng: string;
  dropOffLat: string;
  dropOffLng: string;
  paymentMethod: "CASH" | "WALLET";
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropOffAddress: string;
  externalReference: string;
};

const INITIAL_DISPATCH_FORM: DispatchFormState = {
  pickupLat: "",
  pickupLng: "",
  dropOffLat: "",
  dropOffLng: "",
  paymentMethod: "CASH",
  customerName: "",
  customerPhone: "",
  pickupAddress: "",
  dropOffAddress: "",
  externalReference: "",
};

function toFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminDispatchPage() {
  const [pendingRequests, setPendingRequests] = useState<AdminPendingRideRequest[]>([]);
  const [activeRides, setActiveRides] = useState<AdminActiveRide[]>([]);
  const [auditRows, setAuditRows] = useState<AdminDispatchAudit[]>([]);
  const [offersByRequest, setOffersByRequest] = useState<Record<number, AdminRideOffer[]>>({});
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [dispatchForm, setDispatchForm] = useState<DispatchFormState>(INITIAL_DISPATCH_FORM);
  const [opsHealth, setOpsHealth] = useState<AdminOpsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});

  const redisTone: "success" | "warning" = opsHealth?.redisAvailable ? "success" : "warning";
  const riderLabel = branding?.riderLabel ?? "Requester";
  const driverLabel = branding?.driverLabel ?? "Driver";
  const tripLabel = branding?.tripLabel ?? "Trip";
  const dispatchMode = branding?.dispatchMode ?? "RIDE_HAILING";
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
      const [pendingPage, activePage, auditPage, health, brandingSettings] = await Promise.all([
        adminClient.getPendingRideRequests(0, PAGE_SIZE),
        adminClient.getActiveRides(0, PAGE_SIZE),
        adminClient.getDispatchAudit(0, PAGE_SIZE),
        adminClient.getOpsHealth(),
        adminClient.getBranding(),
      ]);
      setPendingRequests(pendingPage.content ?? []);
      setActiveRides(activePage.content ?? []);
      setAuditRows(auditPage.content ?? []);
      setOpsHealth(health);
      setBranding(brandingSettings);
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
    const driverId = askDriverId(`Assign ${tripLabel.toLowerCase()} request to ${driverLabel.toLowerCase()} ID:`);
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
      `${tripLabel} request #${rideRequestId} assigned to ${driverLabel.toLowerCase()} #${driverId}.`,
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
      `${tripLabel} request #${rideRequestId} cancelled.`,
    );
  }

  async function reassignRide(rideId: number): Promise<void> {
    const driverId = askDriverId(`Reassign ${tripLabel.toLowerCase()} to ${driverLabel.toLowerCase()} ID:`);
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
      `${tripLabel} #${rideId} reassigned to ${driverLabel.toLowerCase()} #${driverId}.`,
    );
  }

  async function cancelRide(rideId: number): Promise<void> {
    const reason = askReason(`Reason for force-cancelling this ${tripLabel.toLowerCase()}:`);
    if (!reason) {
      setError("Reason is required for ride cancellation.");
      return;
    }

    await runAction(
      `cancel-ride:${rideId}`,
      async () => adminClient.cancelRide(rideId, reason),
      `${tripLabel} #${rideId} cancelled by operations.`,
    );
  }

  async function createDispatchRequest(): Promise<void> {
    const pickupLat = toFiniteNumber(dispatchForm.pickupLat);
    const pickupLng = toFiniteNumber(dispatchForm.pickupLng);
    const dropOffLat = toFiniteNumber(dispatchForm.dropOffLat);
    const dropOffLng = toFiniteNumber(dispatchForm.dropOffLng);
    if (pickupLat === null || pickupLng === null || dropOffLat === null || dropOffLng === null) {
      setError("Pickup and drop-off coordinates are required.");
      return;
    }

    await runAction(
      "create-dispatch-request",
      async () =>
        adminClient.createDispatchRequest({
          pickupLat,
          pickupLng,
          dropOffLat,
          dropOffLng,
          paymentMethod: dispatchForm.paymentMethod,
          customerName: normalizeReason(dispatchForm.customerName) ?? undefined,
          customerPhone: normalizeReason(dispatchForm.customerPhone) ?? undefined,
          pickupAddress: normalizeReason(dispatchForm.pickupAddress) ?? undefined,
          dropOffAddress: normalizeReason(dispatchForm.dropOffAddress) ?? undefined,
          externalReference: normalizeReason(dispatchForm.externalReference) ?? undefined,
        }),
      "Dispatch request created and offered to nearby drivers.",
    );
    setDispatchForm(INITIAL_DISPATCH_FORM);
  }

  return (
    <div className="stack">
      <PageFrame
        title={`${tripLabel} Dispatch Console`}
        description={`Override ${tripLabel.toLowerCase()} assignments, resolve stuck requests, and review operational audit trails.`}
      />

      <section className="panel metric-card stack">
        <div className="split-row">
          <strong>Create Dispatch Request</strong>
          <span className="badge">{dispatchMode === "DELIVERY_MERCHANT" ? "Delivery Merchant Mode" : "Ride Hailing Mode"}</span>
        </div>
        <p className="helper">
          Use this form to create a manual dispatch request with address and customer details for operations.
        </p>
        <div className="cards-grid">
          <label className="field">
            <span>Pickup latitude</span>
            <input
              value={dispatchForm.pickupLat}
              onChange={(event) => setDispatchForm((current) => ({ ...current, pickupLat: event.target.value }))}
              placeholder="12.9716"
              inputMode="decimal"
            />
          </label>
          <label className="field">
            <span>Pickup longitude</span>
            <input
              value={dispatchForm.pickupLng}
              onChange={(event) => setDispatchForm((current) => ({ ...current, pickupLng: event.target.value }))}
              placeholder="77.5946"
              inputMode="decimal"
            />
          </label>
          <label className="field">
            <span>Drop-off latitude</span>
            <input
              value={dispatchForm.dropOffLat}
              onChange={(event) => setDispatchForm((current) => ({ ...current, dropOffLat: event.target.value }))}
              placeholder="12.9352"
              inputMode="decimal"
            />
          </label>
          <label className="field">
            <span>Drop-off longitude</span>
            <input
              value={dispatchForm.dropOffLng}
              onChange={(event) => setDispatchForm((current) => ({ ...current, dropOffLng: event.target.value }))}
              placeholder="77.6245"
              inputMode="decimal"
            />
          </label>
        </div>
        <div className="cards-grid">
          <label className="field">
            <span>{riderLabel} name</span>
            <input
              value={dispatchForm.customerName}
              onChange={(event) => setDispatchForm((current) => ({ ...current, customerName: event.target.value }))}
              placeholder="Customer / consignee"
            />
          </label>
          <label className="field">
            <span>{riderLabel} phone</span>
            <input
              value={dispatchForm.customerPhone}
              onChange={(event) => setDispatchForm((current) => ({ ...current, customerPhone: event.target.value }))}
              placeholder="+91..."
            />
          </label>
          <label className="field">
            <span>Pickup address</span>
            <input
              value={dispatchForm.pickupAddress}
              onChange={(event) => setDispatchForm((current) => ({ ...current, pickupAddress: event.target.value }))}
              placeholder="Street, area"
            />
          </label>
          <label className="field">
            <span>Drop-off address</span>
            <input
              value={dispatchForm.dropOffAddress}
              onChange={(event) => setDispatchForm((current) => ({ ...current, dropOffAddress: event.target.value }))}
              placeholder="Street, area"
            />
          </label>
        </div>
        <div className="row-actions">
          <label className="field">
            <span>Payment method</span>
            <select
              value={dispatchForm.paymentMethod}
              onChange={(event) =>
                setDispatchForm((current) => ({
                  ...current,
                  paymentMethod: event.target.value === "WALLET" ? "WALLET" : "CASH",
                }))
              }
            >
              <option value="CASH">Cash</option>
              <option value="WALLET">Wallet</option>
            </select>
          </label>
          <label className="field">
            <span>External reference</span>
            <input
              value={dispatchForm.externalReference}
              onChange={(event) => setDispatchForm((current) => ({ ...current, externalReference: event.target.value }))}
              placeholder="Order/booking id"
            />
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={isActionPending(pendingActions, "create-dispatch-request")}
            onClick={() => void createDispatchRequest()}
          >
            {isActionPending(pendingActions, "create-dispatch-request") ? "Creating..." : "Create dispatch request"}
          </button>
        </div>
      </section>

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
      {loading ? (
        <div className="admin-loading" aria-live="polite" aria-label="Loading dispatch console">
          <div className="admin-skeleton" data-size="lg" />
          <div className="admin-skeleton" data-size="md" />
          <div className="admin-skeleton" data-size="sm" />
        </div>
      ) : null}

      <section className="cards-grid">
        <article className="panel metric-card">
          <small>Pending {tripLabel.toLowerCase()} requests</small>
          <div className="list">
            {pendingRequests.length === 0 ? <p className="helper">No pending requests in the queue.</p> : null}
            {pendingRequests.map((request) => {
              const offerRows = offersByRequest[request.rideRequestId] ?? null;
              return (
                <article key={request.rideRequestId} className="list-item list-item-stack">
                  <div>
                    <strong>Request #{request.rideRequestId}</strong>
                    <p>
                      {riderLabel}: {request.riderName ?? request.customerName ?? "Unknown"} · Fare: {request.fare ?? "N/A"} · Offers:{" "}
                      {request.offeredDriverCount ?? 0}
                    </p>
                    {request.customerPhone ? <p>Contact: {request.customerPhone}</p> : null}
                    {request.pickupAddress || request.dropOffAddress ? (
                      <p>
                        Pickup: {request.pickupAddress ?? "—"} · Drop-off: {request.dropOffAddress ?? "—"}
                      </p>
                    ) : null}
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
                            #{offer.offerId} · {driverLabel} #{offer.driverId ?? "?"} ({offer.driverName ?? "Unknown"})
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
          <small>Active {tripLabel.toLowerCase()}s</small>
          <div className="list">
            {activeRides.length === 0 ? <p className="helper">No active rides currently.</p> : null}
            {activeRides.map((ride) => (
              <article key={ride.rideId} className="list-item">
                <div>
                  <strong>{tripLabel} #{ride.rideId}</strong>
                  <p>
                    {riderLabel}: {ride.riderName ?? "Unknown"} · {driverLabel}: {ride.driverName ?? "Unassigned"} · Status:{" "}
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
