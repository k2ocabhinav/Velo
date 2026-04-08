"use client";

import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import {
  adminClient,
  type PromoCode,
  type PromoCodeMutation,
} from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";

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

const initialCreateForm: PromoFormState = {
  code: "",
  discountType: "FLAT",
  discountValue: "",
  maxUses: "",
  minRideFare: "",
  startDate: "",
  endDate: "",
  description: "",
  active: true,
};

function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function toCreatePayload(form: PromoFormState): PromoCodeMutation | null {
  const code = form.code.trim().toUpperCase();
  const discountValue = toOptionalNumber(form.discountValue);
  if (!code || discountValue === undefined || discountValue <= 0) {
    return null;
  }

  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    return null;
  }

  return {
    code,
    discountType: form.discountType,
    discountValue,
    maxUses: toOptionalNumber(form.maxUses),
    minRideFare: toOptionalNumber(form.minRideFare),
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    description: form.description.trim() || undefined,
    active: form.active,
  };
}

function toUpdatePayload(form: PromoFormState): PromoCodeMutation | null {
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    return null;
  }

  return {
    maxUses: toOptionalNumber(form.maxUses),
    minRideFare: toOptionalNumber(form.minRideFare),
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    description: form.description.trim() || undefined,
    active: form.active,
  };
}

export default function PromoCodesPage() {
  const [rows, setRows] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [createForm, setCreateForm] = useState<PromoFormState>(initialCreateForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PromoFormState | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getPromoCodes();
      setRows(payload);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Unable to load promo codes."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.code.localeCompare(b.code));
  }, [rows]);

  async function deactivatePromo(id: number): Promise<void> {
    if (!window.confirm("Deactivate this promo code?")) {
      return;
    }

    setSubmittingId(id);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.deactivatePromoCode(id);
      await load();
      setStatusMessage("Promo code deactivated.");
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Unable to deactivate promo code."));
    } finally {
      setSubmittingId(null);
    }
  }

  function openEdit(promo: PromoCode): void {
    setEditingId(promo.id);
    setEditForm({
      code: promo.code,
      discountType: (promo.discountType as "FLAT" | "PERCENTAGE") ?? "FLAT",
      discountValue: String(promo.discountValue ?? ""),
      maxUses: promo.maxUses === null || promo.maxUses === undefined ? "" : String(promo.maxUses),
      minRideFare:
        promo.minRideFare === null || promo.minRideFare === undefined ? "" : String(promo.minRideFare),
      startDate: promo.startDate ?? "",
      endDate: promo.endDate ?? "",
      description: promo.description ?? "",
      active: Boolean(promo.active),
    });
  }

  async function submitCreate(): Promise<void> {
    const payload = toCreatePayload(createForm);
    if (!payload) {
      setError("Enter a valid code, discount value, and date range.");
      return;
    }

    setCreatePending(true);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.createPromoCode(payload);
      setCreateForm(initialCreateForm);
      await load();
      setStatusMessage("Promo code created.");
    } catch (createError) {
      setError(toActionErrorMessage(createError, "Unable to create promo code."));
    } finally {
      setCreatePending(false);
    }
  }

  async function submitEdit(id: number): Promise<void> {
    if (!editForm) {
      return;
    }

    const payload = toUpdatePayload(editForm);
    if (!payload) {
      setError("Enter a valid date range for this promo.");
      return;
    }

    setSubmittingId(id);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.updatePromoCode(id, payload);
      setEditingId(null);
      setEditForm(null);
      await load();
      setStatusMessage("Promo code updated.");
    } catch (editError) {
      setError(toActionErrorMessage(editError, "Unable to update promo code."));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Promo codes" description="Review active campaigns and deactivate when needed." />

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {statusMessage ? <p className="helper">{statusMessage}</p> : null}

      <section className="panel metric-card">
        <small>Create promo code</small>
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor="promo-code">Code</label>
            <input
              id="promo-code"
              value={createForm.code}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="WELCOME50"
            />
          </div>

          <div className="row-actions">
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="promo-discount-type">Discount type</label>
              <select
                id="promo-discount-type"
                value={createForm.discountType}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    discountType: event.target.value as "FLAT" | "PERCENTAGE",
                  }))
                }
              >
                <option value="FLAT">Flat</option>
                <option value="PERCENTAGE">Percentage</option>
              </select>
            </div>

            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="promo-discount-value">Discount value</label>
              <input
                id="promo-discount-value"
                type="number"
                min="0"
                step="0.01"
                value={createForm.discountValue}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, discountValue: event.target.value }))
                }
                placeholder="10"
              />
            </div>
          </div>

          <div className="row-actions">
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="promo-max-uses">Max uses</label>
              <input
                id="promo-max-uses"
                type="number"
                min="1"
                value={createForm.maxUses}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, maxUses: event.target.value }))}
                placeholder="optional"
              />
            </div>

            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="promo-min-fare">Min ride fare</label>
              <input
                id="promo-min-fare"
                type="number"
                min="0"
                step="0.01"
                value={createForm.minRideFare}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, minRideFare: event.target.value }))
                }
                placeholder="optional"
              />
            </div>
          </div>

          <div className="row-actions">
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor="promo-start-date">Start date</label>
              <input
                id="promo-start-date"
                type="date"
                value={createForm.startDate}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>
            <div className="field" style={{ minWidth: 180 }}>
              <label htmlFor="promo-end-date">End date</label>
              <input
                id="promo-end-date"
                type="date"
                value={createForm.endDate}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="promo-description">Description</label>
            <input
              id="promo-description"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Campaign details"
            />
          </div>

          <div className="row-actions">
            <button
              className="primary-button"
              type="button"
              disabled={createPending}
              onClick={() => void submitCreate()}
            >
              {createPending ? "Creating..." : "Create promo"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel metric-card">
        {loading ? (
          <p className="helper">Loading promo codes...</p>
        ) : sortedRows.length === 0 ? (
          <p className="helper">No promo codes found.</p>
        ) : (
          <div className="list">
            {sortedRows.map((promo) => (
              <div key={promo.id} className="list-item">
                <div>
                  <strong>{promo.code}</strong>
                  <p>{promo.discountType} · {promo.discountValue} · {promo.description ?? "No description"}</p>
                </div>
                <div className="stack" style={{ justifyItems: "end", gap: 8 }}>
                  <span className="badge" data-tone={promo.active ? "success" : "danger"}>
                    {promo.active ? "Active" : "Inactive"}
                  </span>
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={submittingId === promo.id}
                      onClick={() => openEdit(promo)}
                    >
                      Edit
                    </button>
                    {promo.active ? (
                      <button
                        className="danger-button"
                        type="button"
                        disabled={submittingId === promo.id}
                        onClick={() => void deactivatePromo(promo.id)}
                      >
                        {submittingId === promo.id ? "Working..." : "Deactivate"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editingId !== null && editForm ? (
          <div className="stack" style={{ marginTop: 14, gap: 10 }}>
            <small>Edit promo #{editingId}</small>
            <div className="row-actions">
              <div className="field" style={{ minWidth: 160 }}>
                <label htmlFor="edit-max-uses">Max uses</label>
                <input
                  id="edit-max-uses"
                  type="number"
                  min="1"
                  value={editForm.maxUses}
                  onChange={(event) => setEditForm((prev) => (prev ? { ...prev, maxUses: event.target.value } : prev))}
                  placeholder="optional"
                />
              </div>
              <div className="field" style={{ minWidth: 160 }}>
                <label htmlFor="edit-min-fare">Min ride fare</label>
                <input
                  id="edit-min-fare"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.minRideFare}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, minRideFare: event.target.value } : prev))
                  }
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="row-actions">
              <div className="field" style={{ minWidth: 180 }}>
                <label htmlFor="edit-start-date">Start date</label>
                <input
                  id="edit-start-date"
                  type="date"
                  value={editForm.startDate}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, startDate: event.target.value } : prev))
                  }
                />
              </div>
              <div className="field" style={{ minWidth: 180 }}>
                <label htmlFor="edit-end-date">End date</label>
                <input
                  id="edit-end-date"
                  type="date"
                  value={editForm.endDate}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, endDate: event.target.value } : prev))
                  }
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="edit-description">Description</label>
              <input
                id="edit-description"
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
                placeholder="Campaign details"
              />
            </div>

            <div className="row-actions">
              <label htmlFor="edit-active" className="helper">Active</label>
              <input
                id="edit-active"
                type="checkbox"
                checked={editForm.active}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, active: event.target.checked } : prev))
                }
              />
            </div>

            <div className="row-actions">
              <button
                className="primary-button"
                type="button"
                disabled={submittingId === editingId}
                onClick={() => void submitEdit(editingId)}
              >
                {submittingId === editingId ? "Saving..." : "Save changes"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={submittingId === editingId}
                onClick={() => {
                  setEditingId(null);
                  setEditForm(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
