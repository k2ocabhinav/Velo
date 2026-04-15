"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type BrandingSettings } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";

type BrandingForm = {
  brandName: string;
  primaryColor: string;
  logoUrl: string;
  riderLabel: string;
  driverLabel: string;
  tripLabel: string;
  dispatchMode: BrandingSettings["dispatchMode"];
};

function toForm(settings: BrandingSettings): BrandingForm {
  return {
    brandName: settings.brandName ?? "Velo",
    primaryColor: settings.primaryColor ?? "#2563EB",
    logoUrl: settings.logoUrl ?? "",
    riderLabel: settings.riderLabel ?? "Rider",
    driverLabel: settings.driverLabel ?? "Driver",
    tripLabel: settings.tripLabel ?? "Trip",
    dispatchMode: settings.dispatchMode ?? "RIDE_HAILING",
  };
}

export default function BrandingPage() {
  const [form, setForm] = useState<BrandingForm>({
    brandName: "Velo",
    primaryColor: "#2563EB",
    logoUrl: "",
    riderLabel: "Rider",
    driverLabel: "Driver",
    tripLabel: "Trip",
    dispatchMode: "RIDE_HAILING",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const settings = await adminClient.getBranding();
      setForm(toForm(settings));
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Unable to load branding settings."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await adminClient.updateBranding({
        brandName: form.brandName.trim(),
        primaryColor: form.primaryColor.trim(),
        logoUrl: form.logoUrl.trim() || null,
        riderLabel: form.riderLabel.trim(),
        driverLabel: form.driverLabel.trim(),
        tripLabel: form.tripLabel.trim(),
        dispatchMode: form.dispatchMode,
      });
      setForm(toForm(updated));
      setMessage("Branding settings saved.");
    } catch (saveError) {
      setError(toActionErrorMessage(saveError, "Unable to save branding settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageFrame
        title="Branding"
        description="Configure brand identity, role labels, and dispatch mode for this tenant."
      />

      {loading ? <p className="helper">Loading branding settings...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="helper">{message}</p> : null}

      {!loading ? (
        <section className="panel stack">
          <div className="grid grid-2">
            <label className="field">
              <span>Brand name</span>
              <input
                value={form.brandName}
                onChange={(event) => setForm((prev) => ({ ...prev, brandName: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Primary color (hex)</span>
              <input
                value={form.primaryColor}
                onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Rider label</span>
              <input
                value={form.riderLabel}
                onChange={(event) => setForm((prev) => ({ ...prev, riderLabel: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Driver label</span>
              <input
                value={form.driverLabel}
                onChange={(event) => setForm((prev) => ({ ...prev, driverLabel: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Trip label</span>
              <input
                value={form.tripLabel}
                onChange={(event) => setForm((prev) => ({ ...prev, tripLabel: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Dispatch mode</span>
              <select
                value={form.dispatchMode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    dispatchMode: event.target.value as BrandingForm["dispatchMode"],
                  }))
                }
              >
                <option value="RIDE_HAILING">Ride hailing</option>
                <option value="DELIVERY_MERCHANT">Delivery merchant</option>
                <option value="FLEET_MANAGED">Fleet managed</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>Logo URL</span>
            <input
              value={form.logoUrl}
              placeholder="https://..."
              onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
            />
          </label>

          <div className="actions">
            <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving..." : "Save branding"}
            </button>
            <button className="secondary-button" type="button" disabled={saving} onClick={() => void load()}>
              Reload
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
