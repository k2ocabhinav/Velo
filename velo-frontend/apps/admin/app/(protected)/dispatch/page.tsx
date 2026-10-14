"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Button, ConfirmDialog, DataTable, DateTime, DefinitionList, EmptyState, ErrorState, Field, Menu, PageHeader, RouteStrip, Section, Select, Sheet, Skeleton, StatusBadge, Textarea,
  type DataTableColumn,
} from "@velo/ui";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { adminClient, type AdminActiveRide, type AdminDispatchAudit, type AdminPendingRideRequest, type AdminRideOffer, type BrandingSettings, type CreateDispatchRequestInput } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";
import { executeDispatchOperation } from "../../_lib/dispatch-action";

const PAGE_SIZE = 10;
type DispatchForm = Pick<CreateDispatchRequestInput, "paymentMethod"> & {
  pickupLat: string; pickupLng: string; dropOffLat: string; dropOffLng: string;
  customerName: string; customerPhone: string; pickupAddress: string; dropOffAddress: string; externalReference: string;
};
type AssignmentTarget = { kind: "request" | "ride"; id: number; label: string };
type CancelTarget = { kind: "request" | "ride"; id: number; label: string; reason: string };

const INITIAL_FORM: DispatchForm = {
  pickupLat: "", pickupLng: "", dropOffLat: "", dropOffLng: "", paymentMethod: "CASH",
  customerName: "", customerPhone: "", pickupAddress: "", dropOffAddress: "", externalReference: "",
};

function safeReason(value: string): string | null { return value.trim() || null; }
function parseCoordinate(value: string): number | null { const number = Number(value); return Number.isFinite(number) ? number : null; }

function readableAuditAction(action: string | null | undefined): string {
  const labels: Record<string, string> = {
    ASSIGN_REQUEST: "Assigned a driver",
    REASSIGN_RIDE: "Changed the assigned driver",
    CANCEL_REQUEST: "Cancelled a request",
    CANCEL_RIDE: "Cancelled a trip",
    CREATE_REQUEST: "Created a request",
  };
  if (!action) return "Dispatch action";
  return labels[action.toUpperCase()] ?? action.toLowerCase().replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminDispatchPage() {
  const [pendingRequests, setPendingRequests] = useState<AdminPendingRideRequest[]>([]);
  const [activeRides, setActiveRides] = useState<AdminActiveRide[]>([]);
  const [auditRows, setAuditRows] = useState<AdminDispatchAudit[]>([]);
  const [offersByRequest, setOffersByRequest] = useState<Record<number, AdminRideOffer[]>>({});
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [dispatchForm, setDispatchForm] = useState<DispatchForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget | null>(null);
  const [assignment, setAssignment] = useState({ driverId: "", reason: "" });
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<CancelTarget | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [requests, rides, audit, brand] = await Promise.all([
        adminClient.getPendingRideRequests(0, PAGE_SIZE),
        adminClient.getActiveRides(0, PAGE_SIZE),
        adminClient.getDispatchAudit(0, PAGE_SIZE),
        adminClient.getBranding(),
      ]);
      setPendingRequests(requests.content ?? []);
      setActiveRides(rides.content ?? []);
      setAuditRows(audit.content ?? []);
      setBranding(brand);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Couldn't load dispatch."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  async function runAction(actionKey: string, operation: () => Promise<void>, success: string): Promise<boolean> {
    if (isActionPending(pendingActions, actionKey)) return false;
    setPendingActions((current) => setActionPending(current, actionKey, true));
    setError(null);
    setStatusMessage(null);
    try {
      const result = await executeDispatchOperation(operation);
      if (!result.ok) {
        setError(toActionErrorMessage(result.error, "Couldn't complete that dispatch action."));
        return false;
      }
      await loadAll();
      setStatusMessage(success);
      return true;
    } finally {
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  async function toggleOffers(request: AdminPendingRideRequest): Promise<void> {
    const requestId = request.rideRequestId;
    if (offersByRequest[requestId]) {
      setOffersByRequest((current) => { const next = { ...current }; delete next[requestId]; return next; });
      return;
    }
    await runAction(`offers:${requestId}`, async () => {
      const offers = await adminClient.getRideRequestOffers(requestId);
      setOffersByRequest((current) => ({ ...current, [requestId]: offers }));
    }, "Available driver offers loaded.");
  }

  function openAssignment(target: AssignmentTarget): void {
    setAssignmentTarget(target);
    setAssignment({ driverId: "", reason: "" });
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!assignmentTarget) return;
    const driverId = Number(assignment.driverId);
    const reason = assignment.reason.trim();
    if (!Number.isInteger(driverId) || driverId <= 0 || !reason) {
      setError("Enter a valid driver ID and a reason.");
      return;
    }
    const target = assignmentTarget;
    const succeeded = await runAction(
      `${target.kind === "request" ? "assign" : "reassign"}:${target.id}`,
      () => target.kind === "request"
        ? adminClient.assignPendingRideRequest(target.id, driverId, reason)
        : adminClient.reassignRide(target.id, driverId, reason),
      target.kind === "request" ? "Driver assigned." : "Driver reassigned.",
    );
    if (succeeded) setAssignmentTarget(null);
  }

  function openCancellation(target: Omit<CancelTarget, "reason">): void {
    setCancelTarget({ ...target, reason: "" });
  }

  function stageCancellation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!cancelTarget || !cancelTarget.reason.trim()) return;
    setCancelConfirm(cancelTarget);
    setCancelTarget(null);
  }

  async function confirmCancellation(): Promise<void> {
    if (!cancelConfirm) return;
    const target = cancelConfirm;
    await runAction(
      `${target.kind === "request" ? "cancel-request" : "cancel-ride"}:${target.id}`,
      () => target.kind === "request"
        ? adminClient.cancelPendingRideRequest(target.id, target.reason)
        : adminClient.cancelRide(target.id, target.reason),
      target.kind === "request" ? "Request cancelled." : "Trip cancelled.",
    );
    setCancelConfirm(null);
  }

  function useCurrentLocation(): void {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser. Enter coordinates to continue.");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDispatchForm((form) => ({ ...form, pickupLat: String(position.coords.latitude), pickupLng: String(position.coords.longitude) }));
        setGettingLocation(false);
        setStatusMessage("Pickup coordinates set from your current location.");
      },
      () => {
        setGettingLocation(false);
        setError("Couldn't get your location. Enter pickup coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function createDispatchRequest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const pickupLat = parseCoordinate(dispatchForm.pickupLat);
    const pickupLng = parseCoordinate(dispatchForm.pickupLng);
    const dropOffLat = parseCoordinate(dispatchForm.dropOffLat);
    const dropOffLng = parseCoordinate(dispatchForm.dropOffLng);
    if (pickupLat === null || pickupLng === null || dropOffLat === null || dropOffLng === null) {
      setError("Set pickup and drop-off coordinates to create a trip.");
      return;
    }
    const payload: CreateDispatchRequestInput = {
      pickupLat, pickupLng, dropOffLat, dropOffLng, paymentMethod: dispatchForm.paymentMethod,
      customerName: safeReason(dispatchForm.customerName) ?? undefined,
      customerPhone: safeReason(dispatchForm.customerPhone) ?? undefined,
      pickupAddress: safeReason(dispatchForm.pickupAddress) ?? undefined,
      dropOffAddress: safeReason(dispatchForm.dropOffAddress) ?? undefined,
      externalReference: safeReason(dispatchForm.externalReference) ?? undefined,
    };
    const created = await runAction("create-dispatch-request", () => adminClient.createDispatchRequest(payload), "Trip request created and offered to nearby drivers.");
    if (created) {
      setDispatchForm(INITIAL_FORM);
      setCreateOpen(false);
    }
  }

  const auditColumns: DataTableColumn<AdminDispatchAudit>[] = [
    { header: "Time", cell: (row) => <DateTime value={row.createdAt} /> },
    { header: "By", cell: () => "Operations" },
    { header: "Action", cell: (row) => readableAuditAction(row.actionType) },
    { header: "Trip", cell: (row) => <span className="admin-code">{row.rideId || row.rideRequestId ? `Trip ${row.rideId ?? row.rideRequestId}` : "—"}</span> },
    { header: "Reason", cell: (row) => row.reason || "—" },
  ];

  const riderLabel = branding?.riderLabel ?? "Rider";
  const driverLabel = branding?.driverLabel ?? "Driver";
  const tripLabel = branding?.tripLabel ?? "trip";

  return (
    <div className="stack">
      <PageHeader title="Dispatch" description="Resolve requests and manage trips in progress." actions={<Button onClick={() => setCreateOpen(true)}>New trip</Button>} />
      {error ? <ErrorState title="Couldn't update dispatch" description={error} onRetry={() => void loadAll()} /> : null}
      {statusMessage ? <p role="status" className="helper">{statusMessage}</p> : null}

      <div className="dispatch-columns">
        <Section title="Pending requests" actions={<span className="helper">{pendingRequests.length} shown</span>}>
          {loading ? <div aria-label="Loading pending requests" aria-busy="true" className="stack">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div> : pendingRequests.length === 0 ? (
            <EmptyState title="No pending requests" description="New requests will appear here while a driver is being matched." action={<Button variant="secondary" onClick={() => void loadAll()}>Refresh requests</Button>} />
          ) : pendingRequests.map((request) => (
            <article className="dispatch-request" key={request.rideRequestId}>
              <div className="dispatch-meta">
                <strong>{request.customerName ?? request.riderName ?? `${riderLabel} request`}</strong>
                <StatusBadge domain="request" status={request.status} />
              </div>
              <RouteStrip stage={request.status ?? "PENDING"} pickupLabel="Pickup" dropoffLabel="Drop-off" />
              <DefinitionList items={[
                { label: "Pickup", value: request.pickupAddress || "Location available when assigned" },
                { label: "Drop-off", value: request.dropOffAddress || "Destination not provided" },
                { label: "Requested", value: <DateTime value={request.requestedTime} /> },
              ]} />
              {offersByRequest[request.rideRequestId] ? (
                <DataTable
                  data={offersByRequest[request.rideRequestId]}
                  ariaLabel="Driver offers"
                  columns={[
                    { header: driverLabel, cell: (offer: AdminRideOffer) => offer.driverName || "Nearby driver" },
                    { header: "Status", cell: (offer: AdminRideOffer) => <StatusBadge domain="request" status={offer.status} /> },
                    { header: "Expires", cell: (offer: AdminRideOffer) => <DateTime value={offer.expiresAt} /> },
                  ]}
                  getRowKey={(offer: AdminRideOffer) => offer.offerId}
                  emptyState={<p className="helper">No driver offers for this request.</p>}
                />
              ) : null}
              <div className="dispatch-actions">
                <Menu
                  triggerLabel={`Actions for ${request.customerName ?? request.riderName ?? riderLabel}`}
                  items={[
                    { label: offersByRequest[request.rideRequestId] ? "Hide offers" : "Show offers", onSelect: () => void toggleOffers(request) },
                    { label: "Assign driver", onSelect: () => openAssignment({ kind: "request", id: request.rideRequestId, label: "pending request" }) },
                    { label: "Cancel request", destructive: true, onSelect: () => openCancellation({ kind: "request", id: request.rideRequestId, label: "pending request" }) },
                  ]}
                />
              </div>
            </article>
          ))}
        </Section>

        <Section title="Active trips" actions={<span className="helper">{activeRides.length} shown</span>}>
          {loading ? <div aria-label="Loading active trips" aria-busy="true" className="stack">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div> : activeRides.length === 0 ? (
            <EmptyState title="No active trips" description="Trips with a driver assigned will appear here." action={<Button variant="secondary" onClick={() => void loadAll()}>Refresh trips</Button>} />
          ) : activeRides.map((ride) => (
            <article className="dispatch-ride" key={ride.rideId}>
              <div className="dispatch-meta">
                <strong>{ride.riderName ?? riderLabel}</strong>
                <StatusBadge domain="ride" status={ride.status} />
              </div>
              <RouteStrip stage={ride.status ?? "CONFIRMED"} />
              <DefinitionList items={[
                { label: driverLabel, value: ride.driverName || "Awaiting driver" },
                { label: "Started", value: <DateTime value={ride.startedAt ?? ride.createdTime} /> },
              ]} />
              <div className="dispatch-actions">
                <Menu
                  triggerLabel={`Actions for ${ride.riderName ?? riderLabel}`}
                  items={[
                    { label: "Reassign driver", onSelect: () => openAssignment({ kind: "ride", id: ride.rideId, label: "active trip" }) },
                    { label: "Cancel trip", destructive: true, onSelect: () => openCancellation({ kind: "ride", id: ride.rideId, label: "active trip" }) },
                  ]}
                />
              </div>
            </article>
          ))}
        </Section>
      </div>

      <Section title="Dispatch audit" actions={<Button size="sm" variant="secondary" onClick={() => void loadAll()}>Refresh</Button>}>
        {loading ? <div aria-label="Loading dispatch audit" aria-busy="true" className="stack">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10" />)}</div> : (
          <DataTable className="dispatch-audit-table" data={auditRows} columns={auditColumns} getRowKey={(row) => row.id} ariaLabel="Dispatch audit" emptyState={<EmptyState title="No dispatch actions yet" description="Assignments and cancellations will appear here." action={<Button variant="secondary" onClick={() => setCreateOpen(true)}>Create a trip request</Button>} />} />
        )}
      </Section>

      <Sheet open={createOpen} onOpenChange={setCreateOpen} title="New trip" description="Create a request and offer it to nearby drivers.">
        <form className="stack" onSubmit={(event) => void createDispatchRequest(event)}>
          <Field label="Pickup address"><input className="ui-control" value={dispatchForm.pickupAddress} onChange={(event) => setDispatchForm((form) => ({ ...form, pickupAddress: event.target.value }))} placeholder="Street, city" /></Field>
          <Field label="Drop-off address"><input className="ui-control" value={dispatchForm.dropOffAddress} onChange={(event) => setDispatchForm((form) => ({ ...form, dropOffAddress: event.target.value }))} placeholder="Street, city" /></Field>
          <Button type="button" variant="secondary" loading={gettingLocation} onClick={useCurrentLocation}>Use current location for pickup</Button>
          <p className="helper">Location access sets pickup coordinates. Enter precise coordinates below when available.</p>
          <details>
            <summary>Enter coordinates</summary>
            <div className="admin-form-grid" style={{ marginTop: "var(--space-3)" }}>
              <Field label="Pickup latitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.pickupLat} onChange={(event) => setDispatchForm((form) => ({ ...form, pickupLat: event.target.value }))} required /></Field>
              <Field label="Pickup longitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.pickupLng} onChange={(event) => setDispatchForm((form) => ({ ...form, pickupLng: event.target.value }))} required /></Field>
              <Field label="Drop-off latitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.dropOffLat} onChange={(event) => setDispatchForm((form) => ({ ...form, dropOffLat: event.target.value }))} required /></Field>
              <Field label="Drop-off longitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.dropOffLng} onChange={(event) => setDispatchForm((form) => ({ ...form, dropOffLng: event.target.value }))} required /></Field>
            </div>
          </details>
          <div className="admin-form-grid">
            <Field label={`${riderLabel} name`}><input className="ui-control" value={dispatchForm.customerName} onChange={(event) => setDispatchForm((form) => ({ ...form, customerName: event.target.value }))} /></Field>
            <Field label={`${riderLabel} phone`}><input className="ui-control" type="tel" value={dispatchForm.customerPhone} onChange={(event) => setDispatchForm((form) => ({ ...form, customerPhone: event.target.value }))} /></Field>
            <Field label="Payment method"><Select value={dispatchForm.paymentMethod} onChange={(event) => setDispatchForm((form) => ({ ...form, paymentMethod: event.target.value as DispatchForm["paymentMethod"] }))}><option value="CASH">Cash</option><option value="WALLET">Wallet</option></Select></Field>
            <Field label="External reference"><input className="ui-control" value={dispatchForm.externalReference} onChange={(event) => setDispatchForm((form) => ({ ...form, externalReference: event.target.value }))} /></Field>
          </div>
          <Button type="submit">Create trip request</Button>
        </form>
      </Sheet>

      <Sheet open={Boolean(assignmentTarget)} onOpenChange={(open) => { if (!open) setAssignmentTarget(null); }} title={assignmentTarget?.kind === "ride" ? "Reassign driver" : "Assign driver"} description={`Choose a driver for this ${assignmentTarget?.label ?? tripLabel.toLowerCase()}.`}>
        <form className="stack" onSubmit={(event) => void submitAssignment(event)}>
          <Field label={`${driverLabel} ID`} hint="Use the driver account ID from the driver record."><input className="ui-control" type="number" min="1" step="1" value={assignment.driverId} onChange={(event) => setAssignment((current) => ({ ...current, driverId: event.target.value }))} required /></Field>
          <Field label="Reason"><Textarea value={assignment.reason} onChange={(event) => setAssignment((current) => ({ ...current, reason: event.target.value }))} required rows={3} /></Field>
          <Button type="submit" loading={Boolean(assignmentTarget && isActionPending(pendingActions, `${assignmentTarget.kind === "request" ? "assign" : "reassign"}:${assignmentTarget.id}`))}>{assignmentTarget?.kind === "ride" ? "Reassign driver" : "Assign driver"}</Button>
        </form>
      </Sheet>

      <Sheet open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open) setCancelTarget(null); }} title="Cancel trip" description="Add a reason before confirming this cancellation.">
        <form className="stack" onSubmit={(event) => stageCancellation(event)}>
          <Field label="Cancellation reason"><Textarea value={cancelTarget?.reason ?? ""} onChange={(event) => setCancelTarget((current) => current ? { ...current, reason: event.target.value } : current)} required rows={3} /></Field>
          <Button type="submit" variant="danger">Continue to confirmation</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={Boolean(cancelConfirm)} onOpenChange={(open) => { if (!open) setCancelConfirm(null); }} title="Cancel this trip?" description={cancelConfirm ? `The ${cancelConfirm.label} will be cancelled. Reason: ${cancelConfirm.reason}` : "This cancellation cannot be undone."} confirmLabel="Cancel trip" onConfirm={confirmCancellation} />
    </div>
  );
}
