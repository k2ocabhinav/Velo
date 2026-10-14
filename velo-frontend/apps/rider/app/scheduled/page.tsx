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

type RecurringTemplate = {
  id: number;
  daysOfWeek: string[];
  localTime: string;
  startDate: string;
  endDate: string;
  pickupAddress?: string | null;
  dropOffAddress?: string | null;
  paymentMethod: string;
  pickupLocation: { coordinates: [number, number]; type: "Point" };
  dropOffLocation: { coordinates: [number, number]; type: "Point" };
  bookingReference?: string | null;
  notes?: string | null;
  active: boolean;
};

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

function dateAfter(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function unwrapPage(payload: unknown): ScheduledRide[] {
  const root = payload as Record<string, unknown> | null;
  const raw = (root?.data as Record<string, unknown> | undefined) ?? root ?? {};
  return (raw.content as ScheduledRide[] | undefined) ?? [];
}

function unwrapTemplates(payload: unknown): RecurringTemplate[] {
  const root = payload as Record<string, unknown> | null;
  const raw = (root?.data as Record<string, unknown> | undefined) ?? root ?? {};
  return (raw.content as RecurringTemplate[] | undefined) ?? [];
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
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [templatePending, setTemplatePending] = useState(false);
  const [repeatDays, setRepeatDays] = useState<string[]>(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
  const [repeatTime, setRepeatTime] = useState("09:00");
  const [repeatStartDate, setRepeatStartDate] = useState(() => dateAfter(1));
  const [repeatEndDate, setRepeatEndDate] = useState(() => dateAfter(30));
  const [repeatPickupLat, setRepeatPickupLat] = useState("");
  const [repeatPickupLng, setRepeatPickupLng] = useState("");
  const [repeatDropLat, setRepeatDropLat] = useState("");
  const [repeatDropLng, setRepeatDropLng] = useState("");
  const [repeatPickupAddress, setRepeatPickupAddress] = useState("");
  const [repeatDropAddress, setRepeatDropAddress] = useState("");
  const [repeatReference, setRepeatReference] = useState("");
  const [repeatNotes, setRepeatNotes] = useState("");
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);

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

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplateError(null);
    try {
      const payload = await requestRiderProxy<SpringPage<RecurringTemplate>>("riders/recurring-trip-templates?page=0&size=50");
      setTemplates(unwrapTemplates(payload));
    } catch (loadError) {
      setTemplateError(loadError instanceof Error ? loadError.message : "Couldn't load weekly trips.");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

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

  function toggleRepeatDay(day: string): void {
    setRepeatDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  }

  function editRecurringTrip(template: RecurringTemplate): void {
    setEditingTemplateId(template.id);
    setRepeatDays(template.daysOfWeek);
    setRepeatTime(template.localTime.slice(0, 5));
    setRepeatStartDate(template.startDate);
    setRepeatEndDate(template.endDate);
    setRepeatPickupLat(String(template.pickupLocation.coordinates[1]));
    setRepeatPickupLng(String(template.pickupLocation.coordinates[0]));
    setRepeatDropLat(String(template.dropOffLocation.coordinates[1]));
    setRepeatDropLng(String(template.dropOffLocation.coordinates[0]));
    setRepeatPickupAddress(template.pickupAddress ?? "");
    setRepeatDropAddress(template.dropOffAddress ?? "");
    setPaymentMethod(template.paymentMethod);
    setRepeatReference(template.bookingReference ?? "");
    setRepeatNotes(template.notes ?? "");
    document.getElementById("weekly-trip-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelRecurringEdit(): void {
    setEditingTemplateId(null);
    setRepeatDays(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
    setRepeatTime("09:00");
    setRepeatStartDate(dateAfter(1));
    setRepeatEndDate(dateAfter(30));
    setRepeatPickupLat("");
    setRepeatPickupLng("");
    setRepeatDropLat("");
    setRepeatDropLng("");
    setRepeatPickupAddress("");
    setRepeatDropAddress("");
    setRepeatReference("");
    setRepeatNotes("");
  }

  async function createRecurringTrip(): Promise<void> {
    setTemplateError(null);
    setTemplateMessage(null);
    const pickup = validatePointInput({ lat: repeatPickupLat, lng: repeatPickupLng }, "Pickup");
    const drop = validatePointInput({ lat: repeatDropLat, lng: repeatDropLng }, "Destination");
    if (repeatDays.length === 0) { setTemplateError("Choose at least one day of the week."); return; }
    if (!pickup.ok) { setTemplateError(pickup.error); return; }
    if (!drop.ok) { setTemplateError(drop.error); return; }
    if (repeatEndDate < repeatStartDate) { setTemplateError("End date must be on or after start date."); return; }

    setTemplatePending(true);
    try {
      await requestRiderProxy(editingTemplateId === null ? "riders/recurring-trip-templates" : `riders/recurring-trip-templates/${editingTemplateId}`, {
        method: editingTemplateId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daysOfWeek: repeatDays,
          localTime: repeatTime,
          startDate: repeatStartDate,
          endDate: repeatEndDate,
          pickupLocation: pickup.point,
          dropOffLocation: drop.point,
          pickupAddress: repeatPickupAddress,
          dropOffAddress: repeatDropAddress,
          paymentMethod,
          bookingReference: repeatReference,
          notes: repeatNotes,
        }),
      });
      setTemplateMessage(editingTemplateId === null ? "Weekly trip created." : "Weekly trip updated.");
      setEditingTemplateId(null);
      await loadTemplates();
    } catch (createError) {
      setTemplateError(createError instanceof Error ? createError.message : "Couldn't create this weekly trip.");
    } finally {
      setTemplatePending(false);
    }
  }

  async function toggleRecurringTrip(template: RecurringTemplate): Promise<void> {
    setTemplateError(null);
    try {
      await requestRiderProxy(`riders/recurring-trip-templates/${template.id}/${template.active ? "pause" : "resume"}`, { method: "POST" });
      await loadTemplates();
    } catch (actionError) {
      setTemplateError(actionError instanceof Error ? actionError.message : "Couldn't update this weekly trip.");
    }
  }

  async function deleteRecurringTrip(id: number): Promise<void> {
    setTemplateError(null);
    try {
      await requestRiderProxy(`riders/recurring-trip-templates/${id}`, { method: "DELETE" });
      setTemplateMessage("Weekly trip deleted.");
      await loadTemplates();
    } catch (actionError) {
      setTemplateError(actionError instanceof Error ? actionError.message : "Couldn't delete this weekly trip.");
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

      <Section title="Repeat every week">
        <div className="stack">
          <p className="helper">Create recurring trips for your own account. Changes apply to future trips that have not entered dispatch.</p>
          {templateError ? <ErrorState title="Couldn't update weekly trips" description={templateError} onRetry={() => void loadTemplates()} /> : null}
          {templateMessage ? <p className="booking-feedback" role="status">{templateMessage}</p> : null}
          <div id="weekly-trip-form" className="recurring-trip-form">
            <fieldset className="recurring-days">
              <legend>Days of week</legend>
              <div className="recurring-day-list">{WEEKDAYS.map((day) => <label key={day}>
                <input type="checkbox" checked={repeatDays.includes(day)} onChange={() => toggleRepeatDay(day)} />
                <span>{day.slice(0, 3)}</span>
              </label>)}</div>
            </fieldset>
            <div className="grid grid-2">
              <Field label="Pickup time"><input type="time" value={repeatTime} onChange={(event) => setRepeatTime(event.target.value)} /></Field>
              <Field label="Start date"><input type="date" value={repeatStartDate} onChange={(event) => setRepeatStartDate(event.target.value)} /></Field>
              <Field label="End date"><input type="date" value={repeatEndDate} onChange={(event) => setRepeatEndDate(event.target.value)} /></Field>
              <Field label="Booking reference"><input value={repeatReference} onChange={(event) => setRepeatReference(event.target.value)} /></Field>
              <Field label="Pickup address"><input value={repeatPickupAddress} onChange={(event) => setRepeatPickupAddress(event.target.value)} /></Field>
              <Field label="Drop-off address"><input value={repeatDropAddress} onChange={(event) => setRepeatDropAddress(event.target.value)} /></Field>
              <Field label="Notes"><input value={repeatNotes} onChange={(event) => setRepeatNotes(event.target.value)} /></Field>
            </div>
            <details className="advanced-fields">
              <summary>Enter pickup and drop-off coordinates</summary>
              <div className="grid grid-2">
                <Field label="Latitude for weekly pickup"><input inputMode="decimal" value={repeatPickupLat} onChange={(event) => setRepeatPickupLat(event.target.value)} /></Field>
                <Field label="Longitude for weekly pickup"><input inputMode="decimal" value={repeatPickupLng} onChange={(event) => setRepeatPickupLng(event.target.value)} /></Field>
                <Field label="Latitude for weekly destination"><input inputMode="decimal" value={repeatDropLat} onChange={(event) => setRepeatDropLat(event.target.value)} /></Field>
                <Field label="Longitude for weekly destination"><input inputMode="decimal" value={repeatDropLng} onChange={(event) => setRepeatDropLng(event.target.value)} /></Field>
              </div>
            </details>
            <div className="cluster">
              <Button loading={templatePending} onClick={() => void createRecurringTrip()}>{editingTemplateId === null ? "Create weekly trip" : "Save weekly trip changes"}</Button>
              {editingTemplateId !== null ? <Button variant="secondary" onClick={cancelRecurringEdit}>Cancel edit</Button> : null}
            </div>
          </div>
          <div className="stack">
            <h3 className="section-subheading">Your weekly trips</h3>
            {templatesLoading ? <div className="stack" role="status" aria-label="Loading weekly trips" aria-busy="true">{[0, 1].map((row) => <Skeleton className="schedule-skeleton-row" key={row} />)}</div> : null}
            {!templatesLoading && !templateError && templates.length === 0 ? <EmptyState title="No weekly trips yet" description="Your recurring trips will appear here once you create one." /> : null}
            {!templatesLoading && templates.length > 0 ? <div className="recurring-template-list">{templates.map((template) => <article className="recurring-template-row" key={template.id}>
              <div className="stack compact">
                <strong>{template.daysOfWeek.map((day) => day.slice(0, 3)).join(", ")} · {template.localTime.slice(0, 5)}</strong>
                <span>{template.pickupAddress || "Pickup"} → {template.dropOffAddress || "Drop-off"}</span>
                <span className="helper">{template.startDate} to {template.endDate}{template.bookingReference ? ` · ${template.bookingReference}` : ""}</span>
              </div>
              <div className="scheduled-trip-actions">
                <StatusBadge domain="request" status={template.active ? "ACTIVE" : "PAUSED"} />
                <Button variant="secondary" size="sm" disabled={templatePending} onClick={() => editRecurringTrip(template)}>Edit</Button>
                <Button variant="secondary" size="sm" disabled={templatePending} onClick={() => void toggleRecurringTrip(template)}>{template.active ? "Pause" : "Resume"}</Button>
                <Button variant="ghost" size="sm" disabled={templatePending} onClick={() => setDeleteTemplateId(template.id)}>Delete</Button>
              </div>
            </article>)}</div> : null}
          </div>
        </div>
      </Section>

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
      <ConfirmDialog
        open={deleteTemplateId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTemplateId(null); }}
        title="Delete this weekly trip?"
        description="Trips already scheduled will stay booked. No new trips will be created from this template."
        confirmLabel="Delete weekly trip"
        onConfirm={async () => { if (deleteTemplateId !== null) await deleteRecurringTrip(deleteTemplateId); }}
      />
    </main>
  );
}
