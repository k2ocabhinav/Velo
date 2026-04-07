"use client";

import { useEffect, useMemo, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type PromoCode } from "../_lib/admin-client";

export default function PromoCodesPage() {
  const [rows, setRows] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getPromoCodes();
      setRows(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load promo codes.");
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
    setSubmittingId(id);
    setError(null);
    try {
      await adminClient.deactivatePromoCode(id);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to deactivate promo code.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Promo codes" description="Review active campaigns and deactivate when needed." />

      {error ? <p className="error-text">{error}</p> : null}

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
                  {promo.active ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={submittingId === promo.id}
                      onClick={() => void deactivatePromo(promo.id)}
                    >
                      {submittingId === promo.id ? "Deactivating..." : "Deactivate"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
