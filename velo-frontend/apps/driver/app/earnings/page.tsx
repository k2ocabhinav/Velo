"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@velo/ui/feedback";
import {
  requestDriverProxy,
  toCurrency,
  toRelativeTimestamp,
  type DecimalValue,
  type DriverEarningItem,
  type DriverEarningsSummary,
  type DriverPayoutItem,
  type SpringPage,
} from "../_lib/driver-client";
import { mapApiError, validatePayoutAmount } from "../_lib/driver-forms";
import { LatestRequestSequence } from "../_lib/latest-request-sequence";

type SummaryPeriod = "DAILY" | "WEEKLY" | "MONTHLY";

function parseDecimalValue(value: DecimalValue | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export default function DriverEarningsPage() {
  const [period, setPeriod] = useState<SummaryPeriod>("DAILY");
  const [summary, setSummary] = useState<DriverEarningsSummary | null>(null);
  const [balance, setBalance] = useState<DecimalValue | null>(null);
  const [earnings, setEarnings] = useState<DriverEarningItem[]>([]);
  const [payouts, setPayouts] = useState<DriverPayoutItem[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestSequence = useRef(new LatestRequestSequence());

  const loadData = useCallback(async () => {
    const sequence = requestSequence.current.next();
    setLoading(true);
    setError(null);

    try {
      const [summaryResponse, balanceResponse, earningsResponse, payoutsResponse] = await Promise.all([
        requestDriverProxy<DriverEarningsSummary>(`drivers/earnings/summary?period=${period}`),
        requestDriverProxy<DecimalValue>("drivers/earnings/balance"),
        requestDriverProxy<SpringPage<DriverEarningItem>>("drivers/earnings?pageOffset=0&pageSize=8"),
        requestDriverProxy<SpringPage<DriverPayoutItem>>("drivers/earnings/payouts?pageOffset=0&pageSize=8"),
      ]);

      if (!requestSequence.current.isCurrent(sequence)) {
        return;
      }
      setSummary(summaryResponse);
      setBalance(balanceResponse);
      setEarnings(Array.isArray(earningsResponse.content) ? earningsResponse.content : []);
      setPayouts(Array.isArray(payoutsResponse.content) ? payoutsResponse.content : []);
    } catch (loadError) {
      if (requestSequence.current.isCurrent(sequence)) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load earnings data.");
      }
    } finally {
      if (requestSequence.current.isCurrent(sequence)) {
        setLoading(false);
      }
    }
  }, [period]);

  useEffect(() => {
    void loadData();
    return () => requestSequence.current.invalidate();
  }, [loadData]);

  const numericBalance = useMemo(() => parseDecimalValue(balance), [balance]);

  async function requestPayout(): Promise<void> {
    const validation = validatePayoutAmount(payoutAmount, numericBalance);
    if (!validation.ok) {
      setError(validation.error);
      setMessage(null);
      return;
    }

    setRequestingPayout(true);
    setError(null);
    setMessage(null);

    try {
      await requestDriverProxy<DriverPayoutItem>(`drivers/earnings/payout?amount=${encodeURIComponent(validation.value)}`, {
        method: "POST",
      });
      setPayoutAmount("");
      setMessage("Payout request submitted.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? mapApiError({ error: requestError.message }, "Unable to submit payout request.")
          : "Unable to submit payout request.",
      );
    } finally {
      setRequestingPayout(false);
    }
  }

  return (
    <main className="stack">
      <section className="hero">
        <p className="badge">Earnings</p>
        <h1>Track earnings and request payouts</h1>
        <p>Review net totals, payout status, and recent earning records in one place.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <strong>Summary</strong>
          <div className="actions">
            <label className="field-inline">
              <span>Period</span>
              <select value={period} onChange={(event) => setPeriod(event.target.value as SummaryPeriod)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>
            <button className="secondary-button" type="button" disabled={loading} onClick={() => void loadData()}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-3" aria-label="Loading earnings summary" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <article className="list-item" key={index}>
                <div className="stack compact">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20" />
              </article>
            ))}
          </div>
        ) : null}
        {!loading && summary ? (
          <div className="grid grid-3">
            <article className="list-item">
              <div className="stack compact">
                <strong>Total net</strong>
                <p className="helper">Rides: {summary.rideCount ?? 0}</p>
              </div>
              <span className="badge">{toCurrency(summary.totalNet)}</span>
            </article>
            <article className="list-item">
              <div className="stack compact">
                <strong>Total gross</strong>
                <p className="helper">Commission: {toCurrency(summary.totalCommission)}</p>
              </div>
              <span className="badge">{toCurrency(summary.totalGross)}</span>
            </article>
            <article className="list-item">
              <div className="stack compact">
                <strong>Available balance</strong>
                <p className="helper">Ready for payout</p>
              </div>
              <span className="badge">{toCurrency(balance)}</span>
            </article>
          </div>
        ) : null}

        <div className="stack">
          <strong>Request payout</strong>
          <div className="actions">
            <label className="field-inline">
              <span>Amount</span>
              <input
                inputMode="decimal"
                value={payoutAmount}
                onChange={(event) => setPayoutAmount(event.target.value)}
                placeholder="100.00"
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={requestingPayout}
              onClick={() => void requestPayout()}
            >
              {requestingPayout ? "Submitting..." : "Request payout"}
            </button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
      </section>

      <section className="card stack">
        <strong>Payout history</strong>
        {loading ? (
          <div className="list" aria-label="Loading payout history" aria-busy="true">
            {Array.from({ length: 2 }, (_, index) => (
              <article className="list-item" key={index}>
                <div className="stack compact">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-20" />
              </article>
            ))}
          </div>
        ) : null}
        {!loading && payouts.length === 0 ? <p className="helper">No payout requests yet.</p> : null}
        {!loading && payouts.length > 0 ? (
          <div className="list">
            {payouts.map((payout) => (
              <article className="list-item" key={payout.id}>
                <div className="stack compact">
                  <strong>Payout #{payout.id}</strong>
                  <p className="helper">Requested: {toRelativeTimestamp(payout.requestedAt)}</p>
                </div>
                <div className="stack compact" style={{ justifyItems: "end" }}>
                  <span className="badge">{toCurrency(payout.amount)}</span>
                  <span className="helper">{payout.status}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <strong>Recent earning entries</strong>
        {loading ? (
          <div className="list" aria-label="Loading earning entries" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <article className="list-item" key={index}>
                <div className="stack compact">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-5 w-20" />
              </article>
            ))}
          </div>
        ) : null}
        {!loading && earnings.length === 0 ? <p className="helper">No earnings entries yet.</p> : null}
        {!loading && earnings.length > 0 ? (
          <div className="list">
            {earnings.map((entry) => (
              <article className="list-item" key={entry.id}>
                <div className="stack compact">
                  <strong>Entry #{entry.id}</strong>
                  <p className="helper">Ride #{entry.rideId ?? "--"}</p>
                  <p className="helper">{toRelativeTimestamp(entry.createdTime)}</p>
                </div>
                <div className="stack compact" style={{ justifyItems: "end" }}>
                  <span className="badge">{toCurrency(entry.netEarning)}</span>
                  <p className="helper">Gross: {toCurrency(entry.grossFare)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
