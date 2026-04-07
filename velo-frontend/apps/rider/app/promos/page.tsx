"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toCurrency, type DecimalValue, requestRiderProxy } from "../_lib/rider-client";

type PromoCode = {
  id: number;
  code: string;
  discountType: string;
  discountValue: DecimalValue;
  maxUses?: number | null;
  currentUses?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  minRideFare?: DecimalValue | null;
  active: boolean;
  description?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatDiscount(promo: PromoCode): string {
  if (/PERCENT/i.test(promo.discountType)) {
    return `${promo.discountValue}% off`;
  }

  return `${toCurrency(promo.discountValue)} off`;
}

export default function RiderPromosPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await requestRiderProxy<PromoCode[]>("promo-codes/active");
      setPromos(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load promo codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromos();
  }, [loadPromos]);

  const sortedPromos = useMemo(() => [...promos].sort((a, b) => a.code.localeCompare(b.code)), [promos]);

  async function copyPromoCode(id: number, code: string): Promise<void> {
    setCopyingId(id);
    setMessage(null);
    setError(null);

    try {
      await navigator.clipboard.writeText(code);
      setMessage(`Copied "${code}" to clipboard.`);
    } catch {
      setError("Unable to copy promo code.");
    } finally {
      setCopyingId(null);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Promos</p>
        <h1>Use active offers on your next ride</h1>
        <p>{sortedPromos.length} active promo code(s) available.</p>
      </section>

      <section className="card stack">
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>Active promo codes</strong>
          <button className="primary-button" type="button" disabled={loading} onClick={() => void loadPromos()}>
            Refresh
          </button>
        </div>

        {loading ? <p className="helper">Loading promo codes...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}

        {!loading && !error && sortedPromos.length === 0 ? <p className="helper">No active promo codes right now.</p> : null}

        {!loading && !error && sortedPromos.length > 0 ? (
          <div className="list">
            {sortedPromos.map((promo) => (
              <article className="list-item" key={promo.id}>
                <div className="stack" style={{ gap: 4 }}>
                  <strong>{promo.code}</strong>
                  <p>
                    {formatDiscount(promo)}
                    {promo.minRideFare ? ` • min fare ${toCurrency(promo.minRideFare)}` : ""}
                  </p>
                  <p className="helper">
                    {promo.description ?? "No description"} • {formatDate(promo.startDate)} to {formatDate(promo.endDate)}
                  </p>
                </div>
                <div className="actions">
                  <span className="badge">
                    {promo.currentUses ?? 0}/{promo.maxUses ?? "∞"} used
                  </span>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={copyingId === promo.id}
                    onClick={() => void copyPromoCode(promo.id, promo.code)}
                  >
                    {copyingId === promo.id ? "Copying..." : "Copy code"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
