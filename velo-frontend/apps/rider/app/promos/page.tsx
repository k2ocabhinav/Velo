"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import {
  Button,
  DateTime,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  Section,
  Skeleton,
  StatusBadge,
} from "@velo/ui";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { requestRiderProxy, type DecimalValue } from "../_lib/rider-client";

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

export default function RiderPromosPage() {
  const words = getTenantLabelWords(useTenantBrandingOrDefault());
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await requestRiderProxy<PromoCode[]>("promo-codes/active");
      setPromos(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load available offers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPromos(); }, [loadPromos]);

  const sortedPromos = useMemo(() => [...promos].sort((a, b) => a.code.localeCompare(b.code)), [promos]);

  async function copyPromoCode(id: number, code: string): Promise<void> {
    setCopyingId(id);
    setMessage(null);
    setActionError(null);
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Offer code copied.");
    } catch {
      setActionError("Couldn't copy the offer code. You can select and copy it manually.");
    } finally {
      setCopyingId(null);
    }
  }

  return (
    <main className="app-shell rider-page stack">
      <PageHeader title="Offers" description={`Save an offer and apply it when you book your next ${words.tripWord}.`} />
      <Section title="Available offers" actions={<Button variant="secondary" disabled={loading} onClick={() => void loadPromos()}>Refresh</Button>}>
        {message ? <p className="booking-feedback" role="status">{message}</p> : null}
        {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}
        {error ? <ErrorState title={error} onRetry={() => void loadPromos()} /> : null}
        {loading ? <div className="stack" aria-label="Loading offers">{[0, 1, 2].map((row) => <Skeleton className="promo-skeleton-row" key={row} />)}</div> : null}
        {!loading && !error && sortedPromos.length === 0 ? (
          <EmptyState
            title="No offers available right now"
            description={`Check again later or plan your next ${words.tripWord}.`}
            action={<Link className="ui-button" data-variant="primary" href="/">{`Book a ${words.tripWord}`}</Link>}
          />
        ) : null}
        {!loading && !error && sortedPromos.length > 0 ? (
          <div className="promo-list">
            {sortedPromos.map((promo) => (
              <article className="promo-row" key={promo.id}>
                <div className="promo-row-main">
                  <div className="promo-row-heading">
                    <strong>{promo.code}</strong>
                    <StatusBadge domain="promo" status={promo.active ? "ACTIVE" : "INACTIVE"} />
                  </div>
                  <p className="promo-value">
                    {/PERCENT/i.test(promo.discountType) ? `${promo.discountValue}% off` : <><Money amount={promo.discountValue} /> off</>}
                  </p>
                  <p className="helper">{promo.description || `Use this offer on an eligible ${words.tripWord}.`}</p>
                  <div className="promo-details">
                    {promo.minRideFare ? <span>Minimum fare <Money amount={promo.minRideFare} /></span> : null}
                    <span>{promo.currentUses ?? 0}{promo.maxUses == null ? " used" : ` of ${promo.maxUses} used`}</span>
                    {promo.endDate ? <span>Ends <DateTime value={promo.endDate} /></span> : null}
                  </div>
                </div>
                <Button variant="secondary" disabled={copyingId === promo.id} onClick={() => void copyPromoCode(promo.id, promo.code)}>
                  {copyingId === promo.id ? "Copying…" : "Copy code"}
                </Button>
              </article>
            ))}
          </div>
        ) : null}
      </Section>
    </main>
  );
}
