"use client";

import { useEffect, useState } from "react";
import { Button, ErrorState, Field, PageHeader, Section, Select } from "@velo/ui";
import { adminClient, type BrandingSettings } from "../_lib/admin-client";
import { toActionErrorMessage } from "../_lib/ui-state";

type BrandingForm = {
  brandName: string;
  primaryColor: string;
  logoUrl: string;
  riderLabel: string;
  driverLabel: string;
  tripLabel: string;
  currency: string;
  dispatchMode: BrandingSettings["dispatchMode"];
};

function toForm(settings: BrandingSettings): BrandingForm {
  return {
    brandName: settings.brandName ?? "Velo",
    primaryColor: settings.primaryColor ?? "#1A56FF",
    logoUrl: settings.logoUrl ?? "",
    riderLabel: settings.riderLabel ?? "Rider",
    driverLabel: settings.driverLabel ?? "Driver",
    tripLabel: settings.tripLabel ?? "Trip",
    currency: settings.currency ?? "USD",
    dispatchMode: settings.dispatchMode ?? "RIDE_HAILING",
  };
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export default function BrandingPage() {
  const [form, setForm] = useState<BrandingForm>({ brandName: "Velo", primaryColor: "#1A56FF", logoUrl: "", riderLabel: "Rider", driverLabel: "Driver", tripLabel: "Trip", currency: "USD", dispatchMode: "RIDE_HAILING" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const riderLabel = form.riderLabel.trim() || "Rider";
  const driverLabel = form.driverLabel.trim() || "Driver";
  const tripLabel = form.tripLabel.trim() || "Trip";

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try { setForm(toForm(await adminClient.getBranding())); }
    catch (loadError) { setError(toActionErrorMessage(loadError, "Couldn't load branding settings.")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function save(): Promise<void> {
    if (!isHexColor(form.primaryColor)) {
      setError("Enter a six-digit hex color, such as #1A56FF.");
      return;
    }
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
        currency: form.currency.trim(),
        dispatchMode: form.dispatchMode,
      });
      setForm(toForm(updated));
      setMessage("Branding settings saved.");
    } catch (saveError) {
      setError(toActionErrorMessage(saveError, "Couldn't save branding settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Branding" description="Set the customer-facing identity and operating labels." actions={<Button variant="secondary" disabled={loading || saving} onClick={() => void load()}>Reload</Button>} />
      {error ? <ErrorState title="Couldn't update branding" description={error} onRetry={() => void load()} /> : null}
      {message ? <p role="status" className="helper">{message}</p> : null}
      {loading ? <div className="branding-columns" role="status" aria-label="Loading branding settings" aria-busy="true"><Section.Skeleton rows={5} /><Section.Skeleton rows={3} /></div> : (
        <div className="branding-columns">
          <div className="stack">
            <Section title="Identity">
              <div className="stack">
                <Field label="Brand name"><input className="ui-control" value={form.brandName} onChange={(event) => setForm((current) => ({ ...current, brandName: event.target.value }))} /></Field>
                <Field label="Brand color" hint="Choose a color or enter a six-digit hex value.">
                  <div className="row-actions">
                    <input className="ui-control" aria-label="Choose brand color" type="color" value={isHexColor(form.primaryColor) ? form.primaryColor : "#1A56FF"} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))} style={{ width: "3.5rem", padding: "0.25rem" }} />
                    <input className="ui-control" aria-label="Brand color hex" value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))} aria-invalid={!isHexColor(form.primaryColor)} />
                  </div>
                </Field>
                <Field label="Logo URL"><input className="ui-control" type="url" value={form.logoUrl} placeholder="https://example.com/logo.svg" onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} /></Field>
              </div>
            </Section>
            <Section title="Labels">
              <div className="stack">
                <Field label={`${riderLabel} label`}><input className="ui-control" value={form.riderLabel} onChange={(event) => setForm((current) => ({ ...current, riderLabel: event.target.value }))} /></Field>
                <Field label={`${driverLabel} label`}><input className="ui-control" value={form.driverLabel} onChange={(event) => setForm((current) => ({ ...current, driverLabel: event.target.value }))} /></Field>
                <Field label={`${tripLabel} label`}><input className="ui-control" value={form.tripLabel} onChange={(event) => setForm((current) => ({ ...current, tripLabel: event.target.value }))} /></Field>
              </div>
            </Section>
            <Section title="Dispatch mode">
              <Field label="Operating model"><Select value={form.dispatchMode} onChange={(event) => setForm((current) => ({ ...current, dispatchMode: event.target.value as BrandingForm["dispatchMode"] }))}>
                <option value="RIDE_HAILING">Ride hailing</option>
                <option value="DELIVERY_MERCHANT">Delivery merchant</option>
                <option value="FLEET_MANAGED">Fleet managed</option>
              </Select></Field>
            </Section>
            <Section title="Currency">
              <Field label="ISO currency code" hint="Use a three-letter code such as USD or INR.">
                <input className="ui-control" aria-label="ISO currency code" maxLength={3} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
              </Field>
            </Section>
            <Button loading={saving} onClick={() => void save()}>Save branding</Button>
          </div>

          <Section title={`${riderLabel} preview`}>
            <div className="stack">
              <p className="helper">A preview of the {riderLabel.toLowerCase()} app brand bar and primary action.</p>
              <div className="admin-preview-bar">
                <span className="admin-preview-brand">
                  {form.logoUrl.trim() ? <span className="admin-preview-logo" role="img" aria-label={`${form.brandName || "Brand"} logo`} style={{ backgroundImage: `url("${form.logoUrl.trim()}")` }} /> : (form.brandName || "Brand")}
                </span>
                <span className="helper">{riderLabel}</span>
              </div>
              <button className="ui-button" data-variant="primary" data-size="md" type="button" style={{ backgroundColor: form.primaryColor, borderColor: form.primaryColor }}>
                Request {tripLabel.toLowerCase()}
              </button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
