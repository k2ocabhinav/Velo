"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, ConfirmDialog, DataTable, DateTime, EmptyState, ErrorState, Field, Money, PageHeader, Section, SegmentedControl, Select, Sheet, Skeleton, StatusBadge, type DataTableColumn } from "@velo/ui";
import { adminClient, type PromoCode, type PromoCodeMutation } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";
import { getTenantPluralTripLabel } from "@velo/app-core/tenant";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";

type PromoFormState = {
  code: string;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: string;
  maxUses: string;
  minRideFare: string;
  startDate: string;
  endDate: string;
  description: string;
  active: boolean;
};

const initialForm: PromoFormState = { code: "", discountType: "FLAT", discountValue: "", maxUses: "", minRideFare: "", startDate: "", endDate: "", description: "", active: true };

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function createPayload(form: PromoFormState): PromoCodeMutation | null {
  const code = form.code.trim().toUpperCase();
  const discountValue = optionalNumber(form.discountValue);
  if (!code || discountValue === undefined || discountValue <= 0 || (form.startDate && form.endDate && form.endDate < form.startDate)) return null;
  return { code, discountType: form.discountType, discountValue, maxUses: optionalNumber(form.maxUses), minRideFare: optionalNumber(form.minRideFare), startDate: form.startDate || undefined, endDate: form.endDate || undefined, description: form.description.trim() || undefined, active: form.active };
}

function updatePayload(form: PromoFormState): PromoCodeMutation | null {
  if (form.startDate && form.endDate && form.endDate < form.startDate) return null;
  return { maxUses: optionalNumber(form.maxUses), minRideFare: optionalNumber(form.minRideFare), startDate: form.startDate || undefined, endDate: form.endDate || undefined, description: form.description.trim() || undefined, active: form.active };
}

function formFromPromo(promo: PromoCode): PromoFormState {
  return {
    code: promo.code,
    discountType: promo.discountType === "PERCENTAGE" ? "PERCENTAGE" : "FLAT",
    discountValue: String(promo.discountValue ?? ""),
    maxUses: promo.maxUses == null ? "" : String(promo.maxUses),
    minRideFare: promo.minRideFare == null ? "" : String(promo.minRideFare),
    startDate: promo.startDate ?? "",
    endDate: promo.endDate ?? "",
    description: promo.description ?? "",
    active: Boolean(promo.active),
  };
}

export default function PromoCodesPage() {
  const { tripLabel } = useTenantBrandingOrDefault();
  const tripsLabel = getTenantPluralTripLabel(tripLabel).toLowerCase();
  const [rows, setRows] = useState<PromoCode[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<PromoFormState>(initialForm);
  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try { setRows(await adminClient.getPromoCodes()); }
    catch (loadError) { setError(toActionErrorMessage(loadError, "Couldn't load promo codes.")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const sortedRows = useMemo(() => [...rows]
    .filter((promo) => filter === "ALL" || (filter === "ACTIVE" ? promo.active : !promo.active))
    .sort((a, b) => a.code.localeCompare(b.code)), [rows, filter]);

  function openCreate(): void {
    setEditingPromo(null);
    setForm(initialForm);
    setSheetOpen(true);
  }

  function openEdit(promo: PromoCode): void {
    setEditingPromo(promo);
    setForm(formFromPromo(promo));
    setSheetOpen(true);
  }

  async function savePromo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const payload = editingPromo ? updatePayload(form) : createPayload(form);
    if (!payload) {
      setError(editingPromo ? "Enter a valid date range for this promo." : "Enter a code, positive discount, and valid date range.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setStatusMessage(null);
    try {
      if (editingPromo) await adminClient.updatePromoCode(editingPromo.id, payload);
      else await adminClient.createPromoCode(payload);
      setSheetOpen(false);
      setForm(initialForm);
      await load();
      setStatusMessage(editingPromo ? "Promo code updated." : "Promo code created.");
      setEditingPromo(null);
    } catch (saveError) {
      setError(toActionErrorMessage(saveError, `Couldn't ${editingPromo ? "update" : "create"} promo code.`));
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivatePromo(): Promise<void> {
    if (!deactivateTarget) return;
    setSubmitting(true);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.deactivatePromoCode(deactivateTarget.id);
      setDeactivateTarget(null);
      await load();
      setStatusMessage("Promo code deactivated.");
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Couldn't deactivate promo code."));
    } finally {
      setSubmitting(false);
    }
  }

  const columns: DataTableColumn<PromoCode>[] = [
    { header: "Code", cell: (promo) => <strong className="admin-code">{promo.code}</strong> },
    { header: "Discount", cell: (promo) => promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% off` : <><Money amount={promo.discountValue} /> off</> },
    { header: "Uses", cell: (promo) => `${promo.currentUses ?? 0}${promo.maxUses ? ` of ${promo.maxUses}` : ""}` },
    { header: "Valid dates", cell: (promo) => <span>{promo.startDate ? <DateTime value={promo.startDate} /> : "Any start"} – {promo.endDate ? <DateTime value={promo.endDate} /> : "No end date"}</span> },
    { header: "Status", cell: (promo) => <StatusBadge domain="promo" status={promo.active ? "ACTIVE" : "INACTIVE"} /> },
  ];

  return (
    <div className="stack">
      <PageHeader title="Promo codes" description="Manage discounts and campaign availability." actions={<Button onClick={openCreate}>Create promo code</Button>} />
      {error ? <ErrorState title="Couldn't update promo codes" description={error} onRetry={() => void load()} /> : null}
      {statusMessage ? <p role="status" className="helper">{statusMessage}</p> : null}
      <Section title="Campaigns" actions={<SegmentedControl ariaLabel="Promo code status" value={filter} onValueChange={setFilter} options={[{ value: "ALL", label: "All", count: rows.length }, { value: "ACTIVE", label: "Active", count: rows.filter((promo) => promo.active).length }, { value: "INACTIVE", label: "Inactive", count: rows.filter((promo) => !promo.active).length }]} />}>
        {loading ? <div aria-label="Loading promo codes" aria-busy="true" className="stack">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12" />)}</div> : (
          <DataTable
            data={sortedRows}
            columns={columns}
            getRowKey={(promo) => promo.id}
            ariaLabel="Promo codes"
            emptyState={<EmptyState title={rows.length ? "No promos in this status" : "No promo codes yet"} description={rows.length ? "Choose another status to see more campaigns." : "Create a promo code to launch your first campaign."} action={<Button onClick={rows.length ? () => setFilter("ALL") : openCreate}>{rows.length ? "Show all promos" : "Create promo code"}</Button>} />}
            rowActions={(promo) => [
              { label: "Edit promo", onSelect: () => openEdit(promo) },
              ...(promo.active ? [{ label: "Deactivate promo", destructive: true, onSelect: () => setDeactivateTarget(promo) }] : []),
            ]}
            rowActionsLabel={(promo) => `Actions for ${promo.code}`}
          />
        )}
      </Section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title={editingPromo ? "Edit promo code" : "Create promo code"} description={editingPromo ? `Update campaign rules for ${editingPromo.code}.` : "Set the discount and campaign dates."}>
        <form className="stack" onSubmit={(event) => void savePromo(event)}>
          {!editingPromo ? <Field label="Code"><input className="ui-control" value={form.code} onChange={(event) => setForm((state) => ({ ...state, code: event.target.value }))} required autoCapitalize="characters" /></Field> : <p className="admin-code">{editingPromo?.code}</p>}
          {!editingPromo ? <div className="admin-form-grid">
            <Field label="Discount type"><Select value={form.discountType} onChange={(event) => setForm((state) => ({ ...state, discountType: event.target.value as PromoFormState["discountType"] }))}><option value="FLAT">Fixed amount</option><option value="PERCENTAGE">Percentage</option></Select></Field>
            <Field label="Discount value"><input className="ui-control" type="number" min="0.01" step="0.01" value={form.discountValue} onChange={(event) => setForm((state) => ({ ...state, discountValue: event.target.value }))} required /></Field>
          </div> : null}
          <div className="admin-form-grid">
            <Field label="Maximum uses"><input className="ui-control" type="number" min="1" value={form.maxUses} onChange={(event) => setForm((state) => ({ ...state, maxUses: event.target.value }))} /></Field>
            <Field label="Minimum fare"><input className="ui-control" type="number" min="0" step="0.01" value={form.minRideFare} onChange={(event) => setForm((state) => ({ ...state, minRideFare: event.target.value }))} /></Field>
            <Field label="Start date"><input className="ui-control" type="date" value={form.startDate} onChange={(event) => setForm((state) => ({ ...state, startDate: event.target.value }))} /></Field>
            <Field label="End date"><input className="ui-control" type="date" value={form.endDate} onChange={(event) => setForm((state) => ({ ...state, endDate: event.target.value }))} /></Field>
          </div>
          <Field label="Description"><input className="ui-control" value={form.description} onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))} /></Field>
          {editingPromo ? <label className="field-inline"><input type="checkbox" checked={form.active} onChange={(event) => setForm((state) => ({ ...state, active: event.target.checked }))} /><span>Active campaign</span></label> : null}
          <Button type="submit" loading={submitting}>{editingPromo ? "Save changes" : "Create promo code"}</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }} title="Deactivate promo code?" description={deactivateTarget ? `${deactivateTarget.code} will stop applying to new ${tripsLabel}.` : `This promo will stop applying to new ${tripsLabel}.`} confirmLabel="Deactivate promo" onConfirm={deactivatePromo} />
    </div>
  );
}
