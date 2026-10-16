"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import {
  AddressSearch, Button, ConfirmDialog, DataTable, DateTime, DefinitionList, EmptyState, ErrorState, Field, Menu, PageHeader, RouteStrip, Section, Select, Sheet, Skeleton, StatusBadge, Textarea,
  type AddressSuggestion,
  type DataTableColumn,
} from "@velo/ui";
import type { LocationPoint, LocationTarget } from "@velo/ui/leaflet-map";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { getTenantLabelForCount, getTenantPluralLabel } from "@velo/app-core/tenant";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { adminClient, type AdminActiveRide, type AdminDispatchAudit, type AdminPendingRideRequest, type AdminRideOffer, type BrandingSettings, type CreateDispatchRequestInput } from "../_lib/admin-client";
import { requestAdminProxy } from "../_lib/http";
import { toActionErrorMessage } from "../_lib/ui-state";
import { executeDispatchOperation } from "../../_lib/dispatch-action";
import { LiveFleetPanel } from "./_components/live-fleet-panel";
import { TenantStatus } from "../_components/tenant-status";

const PAGE_SIZE = 10;
const LeafletLocationPicker = dynamic(
  () => import("@velo/ui/leaflet-map").then((module) => module.LeafletLocationPicker),
  { ssr: false, loading: () => <div className="geo-map-picker geo-map-loading" role="status" aria-busy="true">Loading map picker…</div> },
);
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
function parseCoordinate(value: string): number | null { if (!value.trim()) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function parsePoint(latitude: string, longitude: string): LocationPoint | null {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  return lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180 ? null : { lat, lng };
}

function searchDispatchAddresses(query: string, near?: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  if (near) params.set("near", near);
  return requestAdminProxy<AddressSuggestion[]>(`geo/search?${params.toString()}`);
}

function reverseDispatchAddress(point: LocationPoint): Promise<AddressSuggestion> {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng) });
  return requestAdminProxy<AddressSuggestion>(`geo/reverse?${params.toString()}`);
}

function readableAuditAction(action: string | null | undefined, driverLabel: string, tripLabel: string): string {
  const driver = getTenantLabelForCount(1, driverLabel, { midSentence: true, fallback: "Driver" });
  const trip = getTenantLabelForCount(1, tripLabel, { midSentence: true, fallback: "Trip" });
  const labels: Record<string, string> = {
    ASSIGN_REQUEST: `Assigned a ${driver}`,
    REASSIGN_RIDE: `Changed the assigned ${driver}`,
    CANCEL_REQUEST: "Cancelled a request",
    CANCEL_RIDE: `Cancelled a ${trip}`,
    CREATE_REQUEST: "Created a request",
  };
  if (!action) return "Dispatch action";
  return labels[action.toUpperCase()] ?? action.toLowerCase().replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminDispatchPage() {
  const tenantBranding = useTenantBrandingOrDefault();
  const [pendingRequests, setPendingRequests] = useState<AdminPendingRideRequest[]>([]);
  const [activeRides, setActiveRides] = useState<AdminActiveRide[]>([]);
  const [auditRows, setAuditRows] = useState<AdminDispatchAudit[]>([]);
  const [offersByRequest, setOffersByRequest] = useState<Record<number, AdminRideOffer[]>>({});
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<AddressSuggestion[]>([]);
  const [loadingRecentAddresses, setLoadingRecentAddresses] = useState(false);
  const [recentAddressError, setRecentAddressError] = useState(false);
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
  const [activeLocationTarget, setActiveLocationTarget] = useState<LocationTarget>("pickup");
  const [reverseLookupTarget, setReverseLookupTarget] = useState<LocationTarget | null>(null);
  const reverseRequestId = useRef(0);
  const pickupPoint = parsePoint(dispatchForm.pickupLat, dispatchForm.pickupLng);
  const dropoffPoint = parsePoint(dispatchForm.dropOffLat, dispatchForm.dropOffLng);

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

  const refreshOpenTripLists = useCallback(async () => {
    try {
      const [requests, rides] = await Promise.all([
        adminClient.getPendingRideRequests(0, PAGE_SIZE),
        adminClient.getActiveRides(0, PAGE_SIZE),
      ]);
      setPendingRequests(requests.content ?? []);
      setActiveRides(rides.content ?? []);
    } catch {
      // Live refreshes stay quiet so a transient list failure does not replace usable rows.
    }
  }, []);

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setLoadingRecentAddresses(true);
    setRecentAddressError(false);
    void adminClient.getRecentDispatchAddresses()
      .then((addresses) => { if (!cancelled) setRecentAddresses(addresses); })
      .catch(() => { if (!cancelled) { setRecentAddresses([]); setRecentAddressError(true); } })
      .finally(() => { if (!cancelled) setLoadingRecentAddresses(false); });
    return () => { cancelled = true; };
  }, [createOpen]);

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
    }, `Available ${getTenantPluralLabel(branding?.driverLabel ?? tenantBranding.driverLabel, "Driver").toLowerCase()} loaded.`);
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
      setError(`Enter a valid ${getTenantLabelForCount(1, branding?.driverLabel ?? tenantBranding.driverLabel, { midSentence: true, fallback: "Driver" })} ID and a reason.`);
      return;
    }
    const target = assignmentTarget;
    const succeeded = await runAction(
      `${target.kind === "request" ? "assign" : "reassign"}:${target.id}`,
      () => target.kind === "request"
        ? adminClient.assignPendingRideRequest(target.id, driverId, reason)
        : adminClient.reassignRide(target.id, driverId, reason),
      target.kind === "request" ? `${branding?.driverLabel ?? tenantBranding.driverLabel} assigned.` : `${branding?.driverLabel ?? tenantBranding.driverLabel} reassigned.`,
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
      target.kind === "request" ? "Request cancelled." : `${branding?.tripLabel ?? tenantBranding.tripLabel} cancelled.`,
    );
    setCancelConfirm(null);
  }

  function changeAddress(target: LocationTarget, value: string): void {
    reverseRequestId.current += 1;
    setReverseLookupTarget(null);
    setDispatchForm((form) => target === "pickup"
      ? { ...form, pickupAddress: value, pickupLat: "", pickupLng: "" }
      : { ...form, dropOffAddress: value, dropOffLat: "", dropOffLng: "" });
  }

  function changeManualCoordinate(target: LocationTarget, axis: "lat" | "lng", value: string): void {
    reverseRequestId.current += 1;
    setReverseLookupTarget(null);
    setDispatchForm((form) => target === "pickup"
      ? { ...form, pickupAddress: "", ...(axis === "lat" ? { pickupLat: value } : { pickupLng: value }) }
      : { ...form, dropOffAddress: "", ...(axis === "lat" ? { dropOffLat: value } : { dropOffLng: value }) });
  }

  function selectAddress(target: LocationTarget, suggestion: AddressSuggestion): void {
    const requestId = ++reverseRequestId.current;
    setReverseLookupTarget(null);
    setDispatchForm((form) => target === "pickup"
      ? { ...form, pickupAddress: suggestion.label, pickupLat: String(suggestion.lat), pickupLng: String(suggestion.lon) }
      : { ...form, dropOffAddress: suggestion.label, dropOffLat: String(suggestion.lat), dropOffLng: String(suggestion.lon) });
    if (!suggestion.type.toLowerCase().startsWith("recent ")) return;
    const point = { lat: suggestion.lat, lng: suggestion.lon };
    setReverseLookupTarget(target);
    void reverseDispatchAddress(point)
      .then((address) => {
        if (requestId !== reverseRequestId.current) return;
        setDispatchForm((form) => target === "pickup"
          ? { ...form, pickupAddress: address.label }
          : { ...form, dropOffAddress: address.label });
      })
      .catch(() => {
        if (requestId === reverseRequestId.current) setStatusMessage(`Recent ${getTenantLabelForCount(2, branding?.tripLabel ?? tenantBranding.tripLabel, { midSentence: true, fallback: "Trip" })} location selected; its address label is unavailable.`);
      })
      .finally(() => {
        if (requestId === reverseRequestId.current) setReverseLookupTarget(null);
      });
  }

  function setPointFromMap(target: LocationTarget, point: LocationPoint): void {
    const requestId = ++reverseRequestId.current;
    setActiveLocationTarget("dropoff");
    setReverseLookupTarget(target);
    setDispatchForm((form) => target === "pickup"
      ? { ...form, pickupAddress: "", pickupLat: String(point.lat), pickupLng: String(point.lng) }
      : { ...form, dropOffAddress: "", dropOffLat: String(point.lat), dropOffLng: String(point.lng) });
    setError(null);
    void reverseDispatchAddress(point)
      .then((result) => {
        if (requestId !== reverseRequestId.current) return;
        setDispatchForm((form) => target === "pickup"
          ? { ...form, pickupAddress: result.label }
          : { ...form, dropOffAddress: result.label });
      })
      .catch(() => {
        if (requestId === reverseRequestId.current) {
          setStatusMessage("Coordinates saved. An address label is unavailable for this map point.");
        }
      })
      .finally(() => {
        if (requestId === reverseRequestId.current) setReverseLookupTarget(null);
      });
  }

  function useCurrentLocation(): void {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser. Enter coordinates to continue.");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setDispatchForm((form) => ({ ...form, pickupAddress: "", pickupLat: String(point.lat), pickupLng: String(point.lng) }));
        setActiveLocationTarget("dropoff");
        setPointFromMap("pickup", point);
        setGettingLocation(false);
        setStatusMessage("Pickup set from your current location.");
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
    const pickup = parsePoint(dispatchForm.pickupLat, dispatchForm.pickupLng);
    const dropoff = parsePoint(dispatchForm.dropOffLat, dispatchForm.dropOffLng);
    if (!pickup || !dropoff) {
      setError("Choose pickup and drop-off addresses, or enter valid coordinates.");
      return;
    }
    const payload: CreateDispatchRequestInput = {
      pickupLat: pickup.lat, pickupLng: pickup.lng, dropOffLat: dropoff.lat, dropOffLng: dropoff.lng, paymentMethod: dispatchForm.paymentMethod,
      customerName: safeReason(dispatchForm.customerName) ?? undefined,
      customerPhone: safeReason(dispatchForm.customerPhone) ?? undefined,
      pickupAddress: safeReason(dispatchForm.pickupAddress) ?? undefined,
      dropOffAddress: safeReason(dispatchForm.dropOffAddress) ?? undefined,
      externalReference: safeReason(dispatchForm.externalReference) ?? undefined,
    };
    const tripLabel = branding?.tripLabel ?? tenantBranding.tripLabel;
    const driverLabel = branding?.driverLabel ?? tenantBranding.driverLabel;
    const created = await runAction("create-dispatch-request", () => adminClient.createDispatchRequest(payload), `${tripLabel} request created and offered to nearby ${getTenantPluralLabel(driverLabel, "Driver").toLowerCase()}.`);
    if (created) {
      reverseRequestId.current += 1;
      setReverseLookupTarget(null);
      setDispatchForm(INITIAL_FORM);
      setCreateOpen(false);
    }
  }

  const auditColumns: DataTableColumn<AdminDispatchAudit>[] = [
    { header: "Time", cell: (row) => <DateTime value={row.createdAt} /> },
    { header: "By", cell: () => "Operations" },
    { header: "Action", cell: (row) => readableAuditAction(row.actionType, branding?.driverLabel ?? tenantBranding.driverLabel, branding?.tripLabel ?? tenantBranding.tripLabel) },
    { header: branding?.tripLabel ?? tenantBranding.tripLabel, cell: (row) => <span className="admin-code">{row.rideId || row.rideRequestId ? `${branding?.tripLabel ?? tenantBranding.tripLabel} ${row.rideId ?? row.rideRequestId}` : "—"}</span> },
    { header: "Reason", cell: (row) => row.reason || "—" },
  ];

  const riderLabel = branding?.riderLabel ?? tenantBranding.riderLabel;
  const driverLabel = branding?.driverLabel ?? tenantBranding.driverLabel;
  const tripLabel = branding?.tripLabel ?? tenantBranding.tripLabel;
  const driverWord = getTenantLabelForCount(1, driverLabel, { midSentence: true, fallback: "Driver" });
  const tripWord = getTenantLabelForCount(1, tripLabel, { midSentence: true, fallback: "Trip" });
  const tripPlural = getTenantPluralLabel(tripLabel, "Trip");
  const usesDefaultTripLabel = tripLabel.trim().toLowerCase() === "trip";
  const routeStageLabels = {
    requested: `${tripLabel} requested`,
    assigned: `${driverLabel} assigned`,
    arriving: `${driverLabel} arriving`,
    on_trip: `${tripLabel} in progress`,
    completed: `${tripLabel} completed`,
    cancelled: `${tripLabel} cancelled`,
  };
  const pendingHeading = usesDefaultTripLabel ? "Pending requests" : `Pending ${tripPlural.toLowerCase()}`;
  const noPendingTitle = usesDefaultTripLabel ? "No pending requests" : `No pending ${tripPlural.toLowerCase()}`;
  const noPendingDescription = usesDefaultTripLabel
    ? "New requests will appear here while a driver is being matched."
    : `New ${tripPlural.toLowerCase()} will appear here while a ${driverWord} is being matched.`;

  return (
    <div className="stack">
      <PageHeader title="Dispatch" description={`Resolve requests and manage ${tripPlural.toLowerCase()} in progress.`} actions={<Button onClick={() => setCreateOpen(true)}>New {tripWord}</Button>} />
      {error ? <ErrorState title="Couldn't update dispatch" description={error} onRetry={() => void loadAll()} /> : null}
      {statusMessage ? <p role="status" className="helper">{statusMessage}</p> : null}

      <LiveFleetPanel onOpenTripsChanged={refreshOpenTripLists} />

      <div className="dispatch-columns">
        <Section title={pendingHeading} actions={<span className="helper">{pendingRequests.length} shown</span>}>
          {loading ? <div role="status" aria-label="Loading pending requests" aria-busy="true" className="stack">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div> : pendingRequests.length === 0 ? (
            <EmptyState title={noPendingTitle} description={noPendingDescription} action={<Button variant="secondary" onClick={() => void loadAll()}>Refresh requests</Button>} />
          ) : pendingRequests.map((request) => (
            <article className="dispatch-request" key={request.rideRequestId}>
              <div className="dispatch-meta">
                <strong>{request.customerName ?? request.riderName ?? `${riderLabel} request`}</strong>
                {usesDefaultTripLabel ? <StatusBadge domain="request" status={request.status} /> : <TenantStatus domain="request" status={request.status} label={`Finding a ${driverWord}`} />}
              </div>
              <RouteStrip stage={request.status ?? "PENDING"} stageLabels={routeStageLabels} pickupLabel="Pickup" dropoffLabel="Drop-off" />
              <DefinitionList items={[
                { label: "Pickup", value: request.pickupAddress || "Address not set" },
                { label: "Drop-off", value: request.dropOffAddress || "Destination not provided" },
                { label: "Requested", value: <DateTime value={request.requestedTime} /> },
              ]} />
              {offersByRequest[request.rideRequestId] ? (
                <DataTable
                  data={offersByRequest[request.rideRequestId]}
                  ariaLabel="Driver offers"
                  columns={[
                    { header: driverLabel, cell: (offer: AdminRideOffer) => offer.driverName || `Nearby ${driverWord}` },
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
                    { label: `Assign ${driverWord}`, onSelect: () => openAssignment({ kind: "request", id: request.rideRequestId, label: `pending ${tripWord}` }) },
                    { label: "Cancel request", destructive: true, onSelect: () => openCancellation({ kind: "request", id: request.rideRequestId, label: `pending ${tripWord}` }) },
                  ]}
                />
              </div>
            </article>
          ))}
        </Section>

        <Section title={`Active ${tripPlural.toLowerCase()}`} actions={<span className="helper">{activeRides.length} shown</span>}>
          {loading ? <div role="status" aria-label="Loading active trips" aria-busy="true" className="stack">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div> : activeRides.length === 0 ? (
            <EmptyState title={`No active ${tripPlural.toLowerCase()}`} description={`${tripPlural} with a ${driverWord} assigned will appear here.`} action={<Button variant="secondary" onClick={() => void loadAll()}>Refresh ${tripPlural.toLowerCase()}</Button>} />
          ) : activeRides.map((ride) => (
            <article className="dispatch-ride" key={ride.rideId}>
              <div className="dispatch-meta">
                <strong>{ride.riderName ?? riderLabel}</strong>
                <TenantStatus domain="ride" status={ride.status} label={ride.status === "ONGOING" ? `${tripLabel} in progress` : `${driverLabel} assigned`} />
              </div>
              <RouteStrip stage={ride.status ?? "CONFIRMED"} stageLabels={routeStageLabels} />
              <DefinitionList items={[
                { label: driverLabel, value: ride.driverName || `Awaiting ${driverWord}` },
                { label: ride.status === "ONGOING" ? "Started" : "Assigned", value: <DateTime value={ride.status === "ONGOING" ? ride.startedAt ?? ride.createdTime : ride.createdTime} /> },
              ]} />
              <div className="dispatch-actions">
                <Menu
                  triggerLabel={`Actions for ${ride.riderName ?? riderLabel}`}
                  items={[
                    { label: `Reassign ${driverWord}`, onSelect: () => openAssignment({ kind: "ride", id: ride.rideId, label: `active ${tripWord}` }) },
                    { label: `Cancel ${tripWord}`, destructive: true, onSelect: () => openCancellation({ kind: "ride", id: ride.rideId, label: `active ${tripWord}` }) },
                  ]}
                />
              </div>
            </article>
          ))}
        </Section>
      </div>

      <Section title="Dispatch audit" actions={<Button size="sm" variant="secondary" onClick={() => void loadAll()}>Refresh</Button>}>
        {loading ? <div role="status" aria-label="Loading dispatch audit" aria-busy="true" className="stack">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10" />)}</div> : (
          <DataTable className="dispatch-audit-table" data={auditRows} columns={auditColumns} getRowKey={(row) => row.id} ariaLabel="Dispatch audit" emptyState={<EmptyState title="No dispatch actions yet" description="Assignments and cancellations will appear here." action={<Button variant="secondary" onClick={() => setCreateOpen(true)}>Create a trip request</Button>} />} />
        )}
      </Section>

      <Sheet open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { reverseRequestId.current += 1; setReverseLookupTarget(null); } }} title={`New ${tripWord}`} description={`Create a request and offer it to nearby ${getTenantPluralLabel(driverLabel, "Driver").toLowerCase()}.`}>
        <form className="stack" onSubmit={(event) => void createDispatchRequest(event)}>
          <AddressSearch
            label="Pickup address"
            value={dispatchForm.pickupAddress}
            selected={pickupPoint !== null}
            near={dropoffPoint ? `${dropoffPoint.lat},${dropoffPoint.lng}` : undefined}
            search={searchDispatchAddresses}
            preSearchLabel={`Recent addresses from the last 20 ${tripPlural.toLowerCase()}`}
            preSearchPlaces={recentAddresses}
            onValueChange={(value) => changeAddress("pickup", value)}
            onSelect={(suggestion) => selectAddress("pickup", suggestion)}
            placeholder="Search a pickup address"
          />
          <AddressSearch
            label="Drop-off address"
            value={dispatchForm.dropOffAddress}
            selected={dropoffPoint !== null}
            near={pickupPoint ? `${pickupPoint.lat},${pickupPoint.lng}` : undefined}
            search={searchDispatchAddresses}
            preSearchLabel={`Recent addresses from the last 20 ${tripPlural.toLowerCase()}`}
            preSearchPlaces={recentAddresses}
            onValueChange={(value) => changeAddress("dropoff", value)}
            onSelect={(suggestion) => selectAddress("dropoff", suggestion)}
            placeholder="Search a drop-off address"
          />
          {loadingRecentAddresses ? <p className="address-search-status" role="status">Loading recent trip locations…</p> : null}
          {recentAddressError ? <p className="address-search-error" role="status">Recent trip locations are unavailable.</p> : null}
          <LeafletLocationPicker
            pickup={pickupPoint}
            dropoff={dropoffPoint}
            activeTarget={activeLocationTarget}
            onActiveTargetChange={setActiveLocationTarget}
            onPointSelected={setPointFromMap}
          />
          {reverseLookupTarget ? <p className="helper" role="status">Finding the {reverseLookupTarget === "pickup" ? "pickup" : "drop-off"} address…</p> : null}
          <Button type="button" variant="secondary" loading={gettingLocation} onClick={useCurrentLocation}>Use current location for pickup</Button>
          <p className="helper">Search an address, use your current location, or tap the map. You can enter coordinates manually if needed.</p>
          <details>
            <summary>Enter coordinates</summary>
            <div className="admin-form-grid" style={{ marginTop: "var(--space-3)" }}>
              <Field label="Pickup latitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.pickupLat} onChange={(event) => changeManualCoordinate("pickup", "lat", event.target.value)} /></Field>
              <Field label="Pickup longitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.pickupLng} onChange={(event) => changeManualCoordinate("pickup", "lng", event.target.value)} /></Field>
              <Field label="Drop-off latitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.dropOffLat} onChange={(event) => changeManualCoordinate("dropoff", "lat", event.target.value)} /></Field>
              <Field label="Drop-off longitude"><input className="ui-control" inputMode="decimal" value={dispatchForm.dropOffLng} onChange={(event) => changeManualCoordinate("dropoff", "lng", event.target.value)} /></Field>
            </div>
          </details>
          <div className="admin-form-grid">
            <Field label={`${riderLabel} name`}><input className="ui-control" value={dispatchForm.customerName} onChange={(event) => setDispatchForm((form) => ({ ...form, customerName: event.target.value }))} /></Field>
            <Field label={`${riderLabel} phone`}><input className="ui-control" type="tel" value={dispatchForm.customerPhone} onChange={(event) => setDispatchForm((form) => ({ ...form, customerPhone: event.target.value }))} /></Field>
            <Field label="Payment method"><Select value={dispatchForm.paymentMethod} onChange={(event) => setDispatchForm((form) => ({ ...form, paymentMethod: event.target.value as DispatchForm["paymentMethod"] }))}><option value="CASH">Cash</option><option value="WALLET">Wallet</option></Select></Field>
            <Field label="External reference"><input className="ui-control" value={dispatchForm.externalReference} onChange={(event) => setDispatchForm((form) => ({ ...form, externalReference: event.target.value }))} /></Field>
          </div>
          <Button type="submit">Create {tripWord} request</Button>
        </form>
      </Sheet>

      <Sheet open={Boolean(assignmentTarget)} onOpenChange={(open) => { if (!open) setAssignmentTarget(null); }} title={assignmentTarget?.kind === "ride" ? `Reassign ${driverWord}` : `Assign ${driverWord}`} description={`Choose a ${driverWord} for this ${assignmentTarget?.label ?? tripWord}.`}>
        <form className="stack" onSubmit={(event) => void submitAssignment(event)}>
          <Field label={`${driverLabel} ID`} hint={`Use the ${driverWord} account ID from the ${driverWord} record.`}><input className="ui-control" type="number" min="1" step="1" value={assignment.driverId} onChange={(event) => setAssignment((current) => ({ ...current, driverId: event.target.value }))} required /></Field>
          <Field label="Reason"><Textarea value={assignment.reason} onChange={(event) => setAssignment((current) => ({ ...current, reason: event.target.value }))} required rows={3} /></Field>
          <Button type="submit" loading={Boolean(assignmentTarget && isActionPending(pendingActions, `${assignmentTarget.kind === "request" ? "assign" : "reassign"}:${assignmentTarget.id}`))}>{assignmentTarget?.kind === "ride" ? `Reassign ${driverWord}` : `Assign ${driverWord}`}</Button>
        </form>
      </Sheet>

      <Sheet open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open) setCancelTarget(null); }} title={`Cancel ${tripWord}`} description="Add a reason before confirming this cancellation.">
        <form className="stack" onSubmit={(event) => stageCancellation(event)}>
          <Field label="Cancellation reason"><Textarea value={cancelTarget?.reason ?? ""} onChange={(event) => setCancelTarget((current) => current ? { ...current, reason: event.target.value } : current)} required rows={3} /></Field>
          <Button type="submit" variant="danger">Continue to confirmation</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={Boolean(cancelConfirm)} onOpenChange={(open) => { if (!open) setCancelConfirm(null); }} title={`Cancel this ${tripWord}?`} description={cancelConfirm ? `The ${cancelConfirm.label} will be cancelled. Reason: ${cancelConfirm.reason}` : "This cancellation cannot be undone."} confirmLabel={`Cancel ${tripWord}`} onConfirm={confirmCancellation} />
    </div>
  );
}
