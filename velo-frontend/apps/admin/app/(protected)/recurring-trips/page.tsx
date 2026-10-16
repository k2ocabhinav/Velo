"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, Menu, PageHeader, Section, Select, Skeleton, StatusBadge, type DataTableColumn } from "@velo/ui";
import { adminClient, type RecurringTripTemplate, type RecurringTripTemplateInput, type TripSheetRiderOption } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";
import { getTenantLabelForCount, getTenantPluralTripLabel } from "@velo/app-core/tenant";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

function nextDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function title(value: string): string {
  return value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(", ");
}

export default function RecurringTripsPage() {
  const { riderLabel, tripLabel } = useTenantBrandingOrDefault();
  const riderWord = getTenantLabelForCount(1, riderLabel, { midSentence: true, fallback: "Rider" });
  const tripWord = getTenantLabelForCount(1, tripLabel, { midSentence: true, fallback: "Trip" });
  const tripsLabel = getTenantPluralTripLabel(tripLabel);
  const usesDefaultTripLabel = tripLabel.trim().toLowerCase() === "trip";
  const [templates, setTemplates] = useState<RecurringTripTemplate[]>([]);
  const [riders, setRiders] = useState<TripSheetRiderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [riderId, setRiderId] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
  const [localTime, setLocalTime] = useState("09:00");
  const [startDate, setStartDate] = useState(() => nextDate(1));
  const [endDate, setEndDate] = useState(() => nextDate(30));
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropOffAddress, setDropOffAddress] = useState("");
  const [pickupLatitude, setPickupLatitude] = useState("");
  const [pickupLongitude, setPickupLongitude] = useState("");
  const [dropOffLatitude, setDropOffLatitude] = useState("");
  const [dropOffLongitude, setDropOffLongitude] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"WALLET" | "CASH">("WALLET");
  const [bookingReference, setBookingReference] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [page, riderOptions] = await Promise.all([adminClient.getRecurringTripTemplates(), adminClient.getTripSheetRiders()]);
      setTemplates(page.content);
      setRiders(riderOptions);
      if (!riderId && riderOptions.length) setRiderId(String(riderOptions[0].riderId));
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, `Couldn't load recurring ${tripsLabel.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function toggleDay(day: string): void {
    setDaysOfWeek((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  }

  function editTemplate(template: RecurringTripTemplate): void {
    setEditingId(template.id);
    setRiderId(String(template.riderId));
    setDaysOfWeek(template.daysOfWeek);
    setLocalTime(template.localTime.slice(0, 5));
    setStartDate(template.startDate);
    setEndDate(template.endDate);
    setPickupAddress(template.pickupAddress ?? "");
    setDropOffAddress(template.dropOffAddress ?? "");
    setPickupLongitude(String(template.pickupLocation.coordinates[0]));
    setPickupLatitude(String(template.pickupLocation.coordinates[1]));
    setDropOffLongitude(String(template.dropOffLocation.coordinates[0]));
    setDropOffLatitude(String(template.dropOffLocation.coordinates[1]));
    setPaymentMethod(template.paymentMethod);
    setBookingReference(template.bookingReference ?? "");
    setNotes(template.notes ?? "");
    document.getElementById("recurring-trip-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit(): void {
    setEditingId(null);
    setDaysOfWeek(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
    setLocalTime("09:00");
    setStartDate(nextDate(1));
    setEndDate(nextDate(30));
    setPickupAddress("");
    setDropOffAddress("");
    setPickupLatitude("");
    setPickupLongitude("");
    setDropOffLatitude("");
    setDropOffLongitude("");
    setBookingReference("");
    setNotes("");
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const coordinates = [pickupLongitude, pickupLatitude, dropOffLongitude, dropOffLatitude].map(Number);
    if (!riderId || daysOfWeek.length === 0 || coordinates.some((value) => !Number.isFinite(value))) {
      setError(`Choose a ${riderWord}, at least one day, and valid pickup and drop-off coordinates.`);
      return;
    }
    if (Number(pickupLongitude) < -180 || Number(pickupLongitude) > 180 || Number(dropOffLongitude) < -180 || Number(dropOffLongitude) > 180 || Number(pickupLatitude) < -90 || Number(pickupLatitude) > 90 || Number(dropOffLatitude) < -90 || Number(dropOffLatitude) > 90) {
      setError("Use longitude from -180 to 180 and latitude from -90 to 90.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }

    const input: RecurringTripTemplateInput = {
      riderId: Number(riderId),
      daysOfWeek,
      localTime,
      startDate,
      endDate,
      pickupLocation: { type: "Point", coordinates: [Number(pickupLongitude), Number(pickupLatitude)] },
      dropOffLocation: { type: "Point", coordinates: [Number(dropOffLongitude), Number(dropOffLatitude)] },
      pickupAddress,
      dropOffAddress,
      paymentMethod,
      bookingReference,
      notes,
    };
    setSaving(true);
    try {
      if (editingId === null) await adminClient.createRecurringTripTemplate(input);
      else await adminClient.updateRecurringTripTemplate(editingId, input);
      setMessage(editingId === null ? `Weekly ${tripWord} template created.` : `Weekly ${tripWord} template updated.`);
      setEditingId(null);
      await load();
    } catch (createError) {
      setError(toActionErrorMessage(createError, `Couldn't create the weekly ${tripWord}.`));
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(template: RecurringTripTemplate): Promise<void> {
    setError(null);
    try {
      await adminClient.setRecurringTripTemplateActive(template.id, !template.active);
      await load();
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, `Couldn't update this weekly ${tripWord}.`));
    }
  }

  async function deleteTemplate(id: number): Promise<void> {
    setError(null);
    try {
      await adminClient.deleteRecurringTripTemplate(id);
      setMessage(`Weekly ${tripWord} template deleted.`);
      await load();
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, `Couldn't delete this weekly ${tripWord}.`));
    }
  }

  const columns: DataTableColumn<RecurringTripTemplate>[] = [
    { header: riderLabel, cell: (template) => template.riderName || riderLabel },
    { header: "Repeats", cell: (template) => `${title(template.daysOfWeek.join("_"))} at ${template.localTime.slice(0, 5)}` },
    { header: "Route", cell: (template) => `${template.pickupAddress || "Pickup"} → ${template.dropOffAddress || "Drop-off"}` },
    { header: "Booking reference", cell: (template) => template.bookingReference || "—" },
    { header: "Status", cell: (template) => <StatusBadge domain="request" status={template.active ? "ACTIVE" : "PAUSED"} /> },
  ];

  function actionsForTemplate(template: RecurringTripTemplate) {
    return [
      { label: "Edit template", onSelect: () => editTemplate(template) },
      { label: template.active ? "Pause template" : "Resume template", onSelect: () => void toggleTemplate(template) },
      { label: "Delete template", onSelect: () => setDeleteId(template.id), destructive: true },
    ];
  }

  return (
    <div className="stack">
      <PageHeader title={`Recurring ${tripsLabel.toLowerCase()}`} description={usesDefaultTripLabel ? "Set up weekly business and hotel transfers. Edits update future, not-yet-dispatched trips." : `Set up weekly business and hotel ${tripsLabel.toLowerCase()}. Edits update future, not-yet-dispatched ${tripsLabel.toLowerCase()}.`} />
      {error ? <ErrorState title="Couldn't complete that action" description={error} onRetry={() => void load()} /> : null}
      {message ? <p className="booking-feedback" role="status">{message}</p> : null}
      <Section title={`Create a weekly ${tripWord}`}>
        <form id="recurring-trip-form" className="recurring-trip-form" onSubmit={(event) => void createTemplate(event)}>
          <Field label={riderLabel}>
            <Select value={riderId} onChange={(event) => setRiderId(event.target.value)} disabled={loading || riders.length === 0} required>
              {riders.map((rider) => <option value={rider.riderId} key={rider.riderId}>{rider.name || rider.email} · {rider.email}</option>)}
            </Select>
          </Field>
          <fieldset className="recurring-days">
            <legend>Days of week</legend>
            <div className="recurring-day-list">{WEEKDAYS.map((day) => <label key={day}>
              <input type="checkbox" checked={daysOfWeek.includes(day)} onChange={() => toggleDay(day)} />
              <span>{day.slice(0, 3)}</span>
            </label>)}</div>
          </fieldset>
          <div className="grid grid-2">
            <Field label="Pickup time"><input type="time" value={localTime} onChange={(event) => setLocalTime(event.target.value)} required /></Field>
            <Field label="Payment">
              <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "WALLET" | "CASH")}>
                <option value="WALLET">Wallet</option><option value="CASH">Cash</option>
              </Select>
            </Field>
            <Field label="Start date"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></Field>
            <Field label="End date"><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></Field>
            <Field label="Pickup address"><input value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} /></Field>
            <Field label="Drop-off address"><input value={dropOffAddress} onChange={(event) => setDropOffAddress(event.target.value)} /></Field>
            <Field label="Booking reference"><input value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} /></Field>
            <Field label="Notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          </div>
          <details className="advanced-fields">
            <summary>Enter pickup and drop-off coordinates</summary>
            <div className="grid grid-2">
              <Field label="Pickup latitude"><input inputMode="decimal" value={pickupLatitude} onChange={(event) => setPickupLatitude(event.target.value)} required /></Field>
              <Field label="Pickup longitude"><input inputMode="decimal" value={pickupLongitude} onChange={(event) => setPickupLongitude(event.target.value)} required /></Field>
              <Field label="Drop-off latitude"><input inputMode="decimal" value={dropOffLatitude} onChange={(event) => setDropOffLatitude(event.target.value)} required /></Field>
              <Field label="Drop-off longitude"><input inputMode="decimal" value={dropOffLongitude} onChange={(event) => setDropOffLongitude(event.target.value)} required /></Field>
            </div>
          </details>
          <div className="cluster">
            <Button type="submit" loading={saving} disabled={loading || riders.length === 0}>{editingId === null ? `Create weekly ${tripWord}` : "Save template changes"}</Button>
            {editingId !== null ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel edit</Button> : null}
          </div>
        </form>
      </Section>
      <Section title={`Weekly ${tripWord} templates`}>
        {loading ? <div className="recurring-trip-desktop-table"><DataTable.Skeleton rows={3} columns={5} label={`Loading weekly ${tripWord} templates`} /></div> : <DataTable
          className="recurring-trip-desktop-table"
          data={templates}
          columns={columns}
          getRowKey={(template) => template.id}
          ariaLabel={`Weekly ${tripWord} templates`}
          rowActions={actionsForTemplate}
          rowActionsLabel={(template) => `Actions for ${template.riderName || `weekly ${tripWord}`}`}
          emptyState={<EmptyState title="No weekly templates yet" description={`Create a template to materialize scheduled ${tripsLabel.toLowerCase()} up to seven days ahead.`} />}
        />}
        <div className="recurring-trip-mobile-list" role="group" aria-label={`Weekly ${tripWord} templates`}>
          {loading ? <div className="recurring-trip-mobile-loading" role="status" aria-label={`Loading weekly ${tripWord} templates`} aria-busy="true"><Skeleton /><Skeleton /></div> : templates.length === 0
            ? <EmptyState title="No weekly templates yet" description={`Create a template to materialize scheduled ${tripsLabel.toLowerCase()} up to seven days ahead.`} />
            : templates.map((template) => <article className="recurring-trip-mobile-card" key={template.id}>
              <header>
                <div className="stack compact">
                  <strong>{template.riderName || riderLabel}</strong>
                  <span>{title(template.daysOfWeek.join("_"))} · {template.localTime.slice(0, 5)}</span>
                </div>
                <Menu
                  items={actionsForTemplate(template)}
                  triggerLabel={`Actions for ${template.riderName || `weekly ${tripWord}`}`}
                  ariaLabel={`Weekly ${tripWord} actions`}
                />
              </header>
              <dl>
                <div><dt>Route</dt><dd>{template.pickupAddress || "Pickup"} → {template.dropOffAddress || "Drop-off"}</dd></div>
                <div><dt>Booking reference</dt><dd>{template.bookingReference || "—"}</dd></div>
                <div><dt>Status</dt><dd><StatusBadge domain="request" status={template.active ? "ACTIVE" : "PAUSED"} /></dd></div>
              </dl>
            </article>)}
        </div>
      </Section>
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={`Delete this weekly ${tripWord} template?`}
        description={`Existing scheduled ${tripsLabel.toLowerCase()} stay on the ${tripWord} sheet. No new ${tripsLabel.toLowerCase()} will be created from this template.`}
        confirmLabel="Delete template"
        onConfirm={async () => { if (deleteId !== null) await deleteTemplate(deleteId); }}
      />
    </div>
  );
}
