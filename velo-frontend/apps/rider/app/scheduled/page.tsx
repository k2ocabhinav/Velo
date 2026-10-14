"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  DateTime,
  EmptyState,
  ErrorState,
  Field,
  Money,
  PageHeader,
  Section,
  Select,
  Skeleton,
  StatusBadge,
  ConfirmDialog,
} from "@velo/ui";
import { validatePointInput, validateScheduleInput } from "../_lib/ride-forms";
import { requestRiderProxy, type SpringPage } from "../_lib/rider-client";
import { useActiveRideRedirect } from "../_lib/use-active-ride-redirect";

type ScheduledRide = {
  id: number;
  scheduledTime: string;
  status: string;
  paymentMethod: string;
  fare?: number | string;
};

function unwrapPage(payload: unknown): ScheduledRide[] {
  const root = payload as Record<string, unknown> | null;
  const raw = (root?.data as Record<string, unknown> | undefined) ?? root ?? {};
  return (raw.content as ScheduledRide[] | undefined) ?? [];
}

export default function RiderScheduledPage() {
  useActiveRideRedirect("/scheduled");

  const [rides, setRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rideActionError, setRideActionError] = useState<string | null>(null);
  const [retryRideAction, setRetryRideAction] = useState<{ type: "cancel" | "reschedule"; rideId: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropLat, setDropLat] = useState("");
  const [dropLng, setDropLng] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("WALLET");
  const [scheduledTime, setScheduledTime] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [cancelRideId, setCancelRideId] = useState<number | null>(null);

  const loadRides = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await requestRiderProxy<SpringPage<ScheduledRide>>("riders/scheduled-rides?page=0&size=20");
      setRides(unwrapPage(payload));
    } catch (loadError) {
      setLoadError(loadError instanceof Error ? loadError.message : "Couldn't load scheduled trips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  async function scheduleRide() {
    setError(null);
    setMessage(null);
    setPending(true);

    const pickup = validatePointInput({ lat: pickupLat, lng: pickupLng }, "Pickup");
    const drop = validatePointInput({ lat: dropLat, lng: dropLng }, "Destination");
    const when = validateScheduleInput(scheduledTime);
    if (!pickup.ok) { setError(pickup.error); setPending(false); return; }
    if (!drop.ok) { setError(drop.error); setPending(false); return; }
    if (!when.ok) { setError(when.error); setPending(false); return; }

    try {
      await requestRiderProxy("/riders/schedule-ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupLocation: pickup.point, dropOffLocation: drop.point, paymentMethod, scheduledTime }),
      });
      setMessage("Trip scheduled.");
      setScheduledTime("");
      await loadRides();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Couldn't schedule this trip.");
    } finally {
      setPending(false);
    }
  }

  async function rescheduleRide(rideId: number) {
    setRideActionError(null);
    setRetryRideAction(null);
    setMessage(null);
    setPending(true);
    const validation = validateScheduleInput(rescheduleTime);
    if (!validation.ok) {
      setRideActionError(validation.error);
      setRetryRideAction({ type: "reschedule", rideId });
      setPending(false);
      return;
    }

    try {
      const encodedTime = encodeURIComponent(rescheduleTime);
      await requestRiderProxy(`/riders/scheduled-rides/${rideId}/reschedule?newTime=${encodedTime}`, { method: "PUT" });
      setMessage("Trip rescheduled.");
      await loadRides();
    } catch (rescheduleError) {
      setRideActionError(rescheduleError instanceof Error ? rescheduleError.message : "Couldn't reschedule this trip.");
      setRetryRideAction({ type: "reschedule", rideId });
    } finally {
      setPending(false);
    }
  }

  async function cancelRide(rideId: number) {
    setRideActionError(null);
    setRetryRideAction(null);
    setMessage(null);
    setPending(true);
    try {
      await requestRiderProxy(`/riders/scheduled-rides/${rideId}`, { method: "DELETE" });
      setMessage("Scheduled trip cancelled.");
      await loadRides();
    } catch (cancelError) {
      setRideActionError(cancelError instanceof Error ? cancelError.message : "Couldn't cancel this scheduled trip.");
      setRetryRideAction({ type: "cancel", rideId });
    } finally {
      setPending(false);
      setCancelRideId(null);
    }
  }

  return (
    <main className="app-shell rider-page stack">
      <PageHeader title="Scheduled trips" description="Plan ahead and keep your upcoming rides in one place." />

      <div id="schedule-form">
        <Section title="Schedule a trip">
          <div className="schedule-form">
            <Field label="Scheduled time">
              <input type="datetime-local" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} />
            </Field>
            <Field label="Payment">
              <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="WALLET">Wallet</option>
                <option value="CASH">Cash</option>
              </Select>
            </Field>
            <details className="advanced-fields schedule-coordinates">
              <summary>Enter coordinates</summary>
              <div className="grid grid-2">
                <Field label="Pickup latitude"><input value={pickupLat} onChange={(event) => setPickupLat(event.target.value)} /></Field>
                <Field label="Pickup longitude"><input value={pickupLng} onChange={(event) => setPickupLng(event.target.value)} /></Field>
                <Field label="Destination latitude"><input value={dropLat} onChange={(event) => setDropLat(event.target.value)} /></Field>
                <Field label="Destination longitude"><input value={dropLng} onChange={(event) => setDropLng(event.target.value)} /></Field>
              </div>
            </details>
            {error ? <p className="error-text" role="alert">{error}</p> : null}
            <Button loading={pending} onClick={() => void scheduleRide()}>Schedule trip</Button>
          </div>
        </Section>
      </div>

      <Section title="Upcoming trips" actions={<Button variant="secondary" loading={loading} onClick={() => void loadRides()}>Refresh</Button>}>
        {message ? <p className="booking-feedback" role="status">{message}</p> : null}
        {loadError ? <ErrorState title={loadError} onRetry={() => void loadRides()} /> : null}
        {!loadError && rideActionError ? (
          <ErrorState
            title={rideActionError}
            retryLabel="Retry"
            onRetry={() => {
              if (retryRideAction?.type === "cancel") setCancelRideId(retryRideAction.rideId);
              if (retryRideAction?.type === "reschedule") void rescheduleRide(retryRideAction.rideId);
            }}
          />
        ) : null}
        {loading ? <div className="stack" aria-label="Loading scheduled trips">{[0, 1].map((row) => <Skeleton className="schedule-skeleton-row" key={row} />)}</div> : null}
        {!loading && !loadError && rides.length === 0 ? (
          <EmptyState
            title="No scheduled trips yet"
            description="Choose a time and locations to plan a future ride."
            action={<a className="ui-button" data-variant="primary" href="#schedule-form">Schedule a trip</a>}
          />
        ) : null}
        {!loading && !loadError && rides.length > 0 ? (
          <>
            <Field label="New scheduled time" hint="Used when you choose Reschedule on a trip.">
              <input type="datetime-local" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} />
            </Field>
            <div className="scheduled-trip-list">
              {rides.map((ride) => (
                <article className="scheduled-trip-row" key={ride.id}>
                  <div className="scheduled-trip-summary">
                    <DateTime value={ride.scheduledTime} />
                    <StatusBadge domain="request" status={ride.status} />
                    <span className="helper">{ride.paymentMethod === "WALLET" ? "Wallet" : ride.paymentMethod === "CASH" ? "Cash" : "Other payment method"}</span>
                  </div>
                  <Money amount={ride.fare} />
                  <div className="scheduled-trip-actions">
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => void rescheduleRide(ride.id)}>Reschedule</Button>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => setCancelRideId(ride.id)}>Cancel trip</Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </Section>

      <div className="page-related-links">
        <Link className="text-link" href="/rides">View past trips</Link>
        <Link className="text-link" href="/">Book now</Link>
      </div>

      <ConfirmDialog
        open={cancelRideId !== null}
        onOpenChange={(open) => { if (!open) setCancelRideId(null); }}
        title="Cancel this scheduled trip?"
        description="This scheduled trip will be cancelled."
        confirmLabel="Cancel trip"
        onConfirm={async () => { if (cancelRideId !== null) await cancelRide(cancelRideId); }}
      />
    </main>
  );
}
