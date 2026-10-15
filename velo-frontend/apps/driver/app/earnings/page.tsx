"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@velo/ui/primitives";
import { DataTable, DateTime, EmptyState, ErrorState, Field, Money, PageHeader, Section, SegmentedControl, Sheet, StatusBadge } from "@velo/ui/composed";
import { Skeleton } from "@velo/ui/feedback";
import { getTenantLabelWords, getTenantTripLabelForCount } from "@velo/app-core/tenant";
import { useTenantBranding } from "@velo/ui/theme";
import {
  requestDriverProxy,
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
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export default function DriverEarningsPage() {
  const words = getTenantLabelWords(useTenantBranding());
  const [period, setPeriod] = useState<SummaryPeriod>("DAILY");
  const [summary, setSummary] = useState<DriverEarningsSummary | null>(null);
  const [balance, setBalance] = useState<DecimalValue | null>(null);
  const [earnings, setEarnings] = useState<DriverEarningItem[]>([]);
  const [payouts, setPayouts] = useState<DriverPayoutItem[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutSheetOpen, setPayoutSheetOpen] = useState(false);
  const [payoutValidationError, setPayoutValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestSequence = useRef(new LatestRequestSequence());

  const loadData = useCallback(async () => {
    const sequence = requestSequence.current.next();
    setLoading(true);
    setLoadError(null);

    try {
      const [summaryResponse, balanceResponse, earningsResponse, payoutsResponse] = await Promise.all([
        requestDriverProxy<DriverEarningsSummary>(`drivers/earnings/summary?period=${period}`),
        requestDriverProxy<DecimalValue>("drivers/earnings/balance"),
        requestDriverProxy<SpringPage<DriverEarningItem>>("drivers/earnings?pageOffset=0&pageSize=8"),
        requestDriverProxy<SpringPage<DriverPayoutItem>>("drivers/earnings/payouts?pageOffset=0&pageSize=8"),
      ]);

      if (!requestSequence.current.isCurrent(sequence)) return;
      setSummary(summaryResponse);
      setBalance(balanceResponse);
      setPayoutAmount((current) => current || String(balanceResponse));
      setEarnings(Array.isArray(earningsResponse.content) ? earningsResponse.content : []);
      setPayouts(Array.isArray(payoutsResponse.content) ? payoutsResponse.content : []);
    } catch (loadErrorValue) {
      if (requestSequence.current.isCurrent(sequence)) {
        setLoadError(loadErrorValue instanceof Error ? loadErrorValue.message : "Unable to load earnings data.");
      }
    } finally {
      if (requestSequence.current.isCurrent(sequence)) setLoading(false);
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
      setPayoutValidationError(validation.error);
      setMessage(null);
      return;
    }

    setPayoutValidationError(null);
    setRequestingPayout(true);
    setActionError(null);
    setMessage(null);

    try {
      await requestDriverProxy<DriverPayoutItem>(`drivers/earnings/payout?amount=${encodeURIComponent(validation.value)}`, {
        method: "POST",
      });
      setMessage("Payout request submitted.");
      setPayoutSheetOpen(false);
      await loadData();
      setPayoutAmount("");
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? mapApiError({ error: requestError.message }, "Unable to submit payout request.")
          : "Unable to submit payout request.",
      );
    } finally {
      setRequestingPayout(false);
    }
  }

  const periodOptions = [
    { value: "DAILY", label: "Today" },
    { value: "WEEKLY", label: "Week" },
    { value: "MONTHLY", label: "Month" },
  ];

  return (
    <main className="stack">
      <PageHeader title="Your earnings" description="See what you’ve earned and request a payout when you’re ready." />

      {loadError ? <ErrorState title="Couldn't load earnings" description={loadError} onRetry={() => void loadData()} /> : null}
      {actionError ? <ErrorState title="Couldn't request payout" description={actionError} onRetry={() => void requestPayout()} retryLabel="Retry payout" /> : null}
      {message ? <p role="status" className="helper">{message}</p> : null}

      <Section
        title="Your earnings"
        actions={(
          <SegmentedControl
            ariaLabel="Earnings period"
            value={period}
            onValueChange={(value) => setPeriod(value as SummaryPeriod)}
            options={periodOptions}
          />
        )}
      >
        {loading ? (
          <div className="stack compact" role="status" aria-label="Loading earnings summary" aria-busy="true">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : null}
        {!loading && summary ? (
          <div className="stack">
            <div>
              <p className="helper driver-earnings-title">Net earnings</p>
              <p className="driver-earnings-trip-count">{summary.rideCount ?? 0} {getTenantTripLabelForCount(summary.rideCount ?? 0, words.trip, { midSentence: true })}</p>
              <Money className="driver-key-figure" amount={summary.totalNet} emphasis />
            </div>
            <dl className="driver-money-breakdown">
              <div><dt>Gross earnings</dt><dd><Money amount={summary.totalGross} /></dd></div>
              <div><dt>Commission</dt><dd><Money amount={summary.totalCommission} /></dd></div>
              <div><dt>Available for payout</dt><dd><Money amount={balance} emphasis /></dd></div>
            </dl>
            <div className="driver-actions">
              <Button onClick={() => setPayoutSheetOpen(true)} disabled={numericBalance === null || numericBalance <= 0}>
                Request payout
              </Button>
              <Button variant="secondary" disabled={loading} onClick={() => void loadData()}>Refresh</Button>
            </div>
          </div>
        ) : null}
        {!loading && !loadError && !summary ? (
          <EmptyState
            title="No earnings for this period"
            description={`Try another period or go online to take your next ${words.tripWord}.`}
            action={<a href="/" className="ui-button" data-variant="secondary">Go online</a>}
          />
        ) : null}
      </Section>

      <Section title="Payout history">
        {loading ? (
          <div role="status" aria-label="Loading payout history" aria-busy="true" className="stack compact">
            {[0, 1].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
          </div>
        ) : null}
        {!loading && !loadError && payouts.length === 0 ? (
          <EmptyState
            title="No payouts yet"
            description="Request a payout when your balance is available."
            action={numericBalance !== null && numericBalance > 0
              ? <Button onClick={() => setPayoutSheetOpen(true)}>Request payout</Button>
              : <a href="/" className="ui-button" data-variant="secondary">Go online</a>}
          />
        ) : null}
        {!loading && !loadError && payouts.length > 0 ? (
          <>
            <div className="driver-desktop-ledger">
              <DataTable
                ariaLabel="Payout history"
                data={payouts}
                getRowKey={(payout) => payout.id}
                columns={[
                  { header: "Requested", cell: (payout) => <DateTime value={payout.requestedAt} /> },
                  { header: "Amount", align: "right", cell: (payout) => <Money amount={payout.amount} /> },
                  { header: "Status", cell: (payout) => <StatusBadge domain="payout" status={payout.status} /> },
                ]}
              />
            </div>
            <div className="driver-mobile-ledger" role="list" aria-label="Payout history">
              {payouts.map((payout) => (
                <article className="driver-ledger-row" key={payout.id} role="listitem">
                  <div className="driver-ledger-row-meta">
                    <DateTime value={payout.requestedAt} />
                    <StatusBadge domain="payout" status={payout.status} />
                  </div>
                  <Money className="driver-key-figure" amount={payout.amount} emphasis />
                </article>
              ))}
            </div>
          </>
        ) : null}
      </Section>

      <Section title={`Recent ${words.tripsWord}`}>
        {loading ? (
          <div role="status" aria-label="Loading earning entries" aria-busy="true" className="stack compact">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
          </div>
        ) : null}
        {!loading && !loadError && earnings.length === 0 ? (
          <EmptyState
            title="No earnings yet"
            description={`Your ${words.tripWord} earnings will appear here after you complete a ${words.tripWord}.`}
            action={<a href="/" className="ui-button" data-variant="secondary">Go online</a>}
          />
        ) : null}
        {!loading && !loadError && earnings.length > 0 ? (
          <>
            <div className="driver-desktop-ledger">
              <DataTable
                ariaLabel={`Recent ${words.tripWord} earnings`}
                data={earnings}
                getRowKey={(entry) => entry.id}
                columns={[
                  { header: words.trip, cell: (entry) => entry.rideId ? <code className="driver-reference">{words.trip} {entry.rideId}</code> : "—" },
                  { header: "Date", cell: (entry) => <DateTime value={entry.createdTime} /> },
                  { header: "Gross", align: "right", cell: (entry) => <Money amount={entry.grossFare} /> },
                  { header: "Commission", align: "right", cell: (entry) => <Money amount={entry.platformCommission} /> },
                  { header: "Net", align: "right", cell: (entry) => <Money amount={entry.netEarning} emphasis /> },
                ]}
              />
            </div>
            <div className="driver-mobile-ledger" role="list" aria-label={`Recent ${words.tripWord} earnings`}>
              {earnings.map((entry) => (
                <article className="driver-ledger-row" key={entry.id} role="listitem">
                  <div className="driver-ledger-row-meta">
                    <DateTime value={entry.createdTime} />
                    <StatusBadge domain="ride" status="ENDED" />
                  </div>
                  {entry.rideId ? <code className="driver-reference">{words.trip} {entry.rideId}</code> : null}
                  <Money className="driver-key-figure" amount={entry.netEarning} emphasis />
                  <div className="driver-ledger-breakdown">
                    <span>Gross <Money amount={entry.grossFare} /></span>
                    <span>Commission <Money amount={entry.platformCommission} /></span>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </Section>

      <Sheet
        open={payoutSheetOpen}
        onOpenChange={setPayoutSheetOpen}
        title="Request a payout"
        description="Choose an amount up to your available balance."
        side="bottom"
      >
        <form className="driver-sheet-form" onSubmit={(event) => { event.preventDefault(); void requestPayout(); }}>
          <p>Available balance: <Money amount={balance} emphasis /></p>
          <Field label="Amount" hint="The amount must be greater than zero and within your available balance." error={payoutValidationError ?? undefined}>
            <input
              className="ui-control"
              inputMode="decimal"
              value={payoutAmount}
              onChange={(event) => { setPayoutAmount(event.target.value); setPayoutValidationError(null); }}
              placeholder="100.00"
            />
          </Field>
          <Button className="driver-action-button" type="submit" loading={requestingPayout}>Request payout</Button>
        </form>
      </Sheet>
    </main>
  );
}
