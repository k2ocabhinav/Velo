"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DateTime,
  EmptyState,
  ErrorState,
  Field,
  Money,
  PageHeader,
  Section,
  Select,
  Sheet,
  Skeleton,
  ConfirmDialog,
} from "@velo/ui";
import { requestRiderProxy, type DecimalValue, type SpringPage } from "../_lib/rider-client";

type PaymentMethod = {
  id: number;
  type: "CARD" | "WALLET" | string;
  lastFourDigits?: string | null;
  expiryDate?: string | null;
  isDefault?: boolean | null;
};

type WalletTransaction = {
  id: number;
  type: string;
  amount: DecimalValue;
  method: string;
  rideReference?: number | null;
  timestamp: string;
};

type WalletSummary = {
  balance: DecimalValue;
  currency: string;
  transactions: SpringPage<WalletTransaction>;
};

const CARD_LAST4_PATTERN = /^\d{4}$/;

function transactionTypeLabel(type: string): string {
  if (type === "CREDIT") return "Added to wallet";
  if (type === "DEBIT") return "Used from wallet";
  return "Wallet transaction";
}

function transactionMethodLabel(method: string): string {
  if (method === "BANKING") return "Bank transfer";
  if (method === "RIDE") return "Trip payment";
  if (method === "WALLET") return "Wallet";
  return "Payment method";
}

export default function RiderWalletPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<"CARD" | "WALLET">("CARD");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [removeMethodId, setRemoveMethodId] = useState<number | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletPage, setWalletPage] = useState(0);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await requestRiderProxy<PaymentMethod[]>("payment-methods");
      setMethods(Array.isArray(response) ? response : []);
    } catch (loadError) {
      setLoadError(loadError instanceof Error ? loadError.message : "Couldn't load saved payment methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async (page: number) => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const response = await requestRiderProxy<WalletSummary>(`riders/wallet?page=${page}&size=10`);
      setWallet(response);
    } catch (loadError) {
      setWallet(null);
      setWalletError(loadError instanceof Error ? loadError.message : "Couldn't load your wallet.");
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  useEffect(() => {
    void loadWallet(walletPage);
  }, [loadWallet, walletPage]);

  const defaultMethod = useMemo(() => methods.find((method) => method.isDefault), [methods]);

  async function createMethod(): Promise<void> {
    setError(null);
    setMessage(null);

    if (paymentType === "CARD" && !CARD_LAST4_PATTERN.test(lastFourDigits.trim())) {
      setError("Enter the last four digits of your card.");
      return;
    }
    if (paymentType === "CARD" && !expiryDate.trim()) {
      setError("Enter the card expiry date.");
      return;
    }

    setCreating(true);
    try {
      await requestRiderProxy<PaymentMethod>("payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: paymentType,
          lastFourDigits: paymentType === "CARD" ? lastFourDigits.trim() : null,
          expiryDate: paymentType === "CARD" ? expiryDate.trim() : null,
          isDefault: methods.length === 0,
        }),
      });
      setLastFourDigits("");
      setExpiryDate("");
      setMessage("Payment method added.");
      await loadMethods();
      setAddSheetOpen(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Couldn't add this payment method.");
    } finally {
      setCreating(false);
    }
  }

  async function setDefault(id: number): Promise<void> {
    setActingId(id);
    setError(null);
    setMessage(null);
    try {
      await requestRiderProxy<PaymentMethod>(`payment-methods/${id}/default`, { method: "PUT" });
      setMessage("Default payment method updated.");
      await loadMethods();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Couldn't update the default payment method.");
    } finally {
      setActingId(null);
    }
  }

  async function removeMethod(id: number): Promise<void> {
    setActingId(id);
    setError(null);
    setMessage(null);
    try {
      await requestRiderProxy<void>(`payment-methods/${id}`, { method: "DELETE" });
      setMessage("Payment method removed.");
      await loadMethods();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Couldn't remove this payment method.");
    } finally {
      setActingId(null);
      setRemoveMethodId(null);
    }
  }

  const selectedMethod = methods.find((method) => method.id === removeMethodId);
  const transactions = wallet?.transactions.content ?? [];
  const transactionPageCount = wallet?.transactions.totalPages ?? 1;
  const currentTransactionPage = wallet?.transactions.number ?? walletPage;

  return (
    <main className="app-shell rider-page stack">
      <PageHeader
        title="Wallet"
        description="Check your balance, transaction history, and saved payment methods."
        actions={<Button onClick={() => { setError(null); setAddSheetOpen(true); }}>Add method</Button>}
      />

      {walletError ? <ErrorState title="Couldn't load wallet" description={walletError} onRetry={() => void loadWallet(walletPage)} /> : null}

      <Section title="Available balance" className="wallet-balance-section">
        {walletLoading ? (
          <div className="stack" role="status" aria-label="Loading wallet balance" aria-busy="true">
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line skeleton-line-wide" />
          </div>
        ) : wallet ? (
          <>
            <Money amount={wallet.balance} currency={wallet.currency} emphasis className="wallet-balance-figure" />
            <p className="helper">Available for your next trip.</p>
          </>
        ) : null}
      </Section>

      <Section title="Recent transactions">
        {walletLoading ? (
          <div className="stack" role="status" aria-label="Loading wallet transactions" aria-busy="true">
            {[0, 1, 2].map((row) => <div className="wallet-transaction-row" key={row}><Skeleton className="skeleton-line skeleton-line-wide" /><Skeleton className="skeleton-line" /></div>)}
          </div>
        ) : null}
        {!walletLoading && !walletError && transactions.length === 0 ? (
          <EmptyState title="No wallet transactions yet" description="Wallet activity will appear here after a balance change or trip payment." />
        ) : null}
        {!walletLoading && !walletError && transactions.length > 0 ? (
          <>
            <ul className="wallet-transaction-list">
              {transactions.map((transaction) => (
                <li className="wallet-transaction-row" key={transaction.id}>
                  <div className="wallet-transaction-details">
                    <strong>{transactionTypeLabel(transaction.type)}</strong>
                    <p className="helper">
                      <DateTime value={transaction.timestamp} />
                      <span aria-hidden="true"> · </span>
                      {transactionMethodLabel(transaction.method)}
                      {transaction.rideReference !== null && transaction.rideReference !== undefined ? (
                        <span className="wallet-ride-reference"> · <span className="mono">Trip #{transaction.rideReference}</span></span>
                      ) : null}
                    </p>
                  </div>
                  <Money amount={transaction.amount} currency={wallet?.currency} />
                </li>
              ))}
            </ul>
            {transactionPageCount > 1 ? (
              <nav className="wallet-transaction-pagination" aria-label="Wallet transaction pages">
                <Button variant="secondary" size="sm" disabled={currentTransactionPage <= 0} onClick={() => setWalletPage((page) => Math.max(0, page - 1))}>Previous</Button>
                <span className="helper">Page {currentTransactionPage + 1} of {transactionPageCount}</span>
                <Button variant="secondary" size="sm" disabled={currentTransactionPage + 1 >= transactionPageCount} onClick={() => setWalletPage((page) => Math.min(transactionPageCount - 1, page + 1))}>Next</Button>
              </nav>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title="Saved payment methods" actions={
        <Button variant="secondary" disabled={loading} onClick={() => void loadMethods()}>Refresh</Button>
      }>
        {message ? <p className="booking-feedback" role="status">{message}</p> : null}
        {error && !addSheetOpen ? <p className="error-text" role="alert">{error}</p> : null}
        {loadError ? <ErrorState title={loadError} onRetry={() => void loadMethods()} /> : null}
        {loading ? (
          <div className="stack" aria-label="Loading saved payment methods">
            {[0, 1].map((row) => <div className="payment-skeleton-row" key={row}><Skeleton className="skeleton-line skeleton-line-wide" /><Skeleton className="skeleton-line" /></div>)}
          </div>
        ) : null}
        {!loading && !loadError && methods.length === 0 ? (
          <EmptyState
            title="No saved payment methods"
            description="Add a card or wallet option to make your next booking easier."
            action={<Button onClick={() => setAddSheetOpen(true)}>Add method</Button>}
          />
        ) : null}
        {!loading && !loadError && methods.length > 0 ? (
          <div className="payment-method-list">
            {methods.map((method) => (
              <article className="payment-method-row" key={method.id}>
                <div>
                  <strong>{method.type === "CARD" ? "Card" : method.type === "WALLET" ? "Wallet" : "Payment method"}</strong>
                  <p className="helper">
                    {method.lastFourDigits ? `Ending in ${method.lastFourDigits}` : "No card details"}
                    {method.expiryDate ? ` · Expires ${method.expiryDate}` : ""}
                  </p>
                </div>
                <div className="payment-method-actions">
                  {method.isDefault ? <span className="badge" data-tone="success">Default</span> : null}
                  {!method.isDefault ? (
                    <Button variant="secondary" size="sm" disabled={actingId === method.id} onClick={() => void setDefault(method.id)}>
                      {actingId === method.id ? "Saving…" : "Set default"}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" disabled={actingId === method.id} onClick={() => setRemoveMethodId(method.id)}>
                    Remove
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </Section>

      <Sheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        side="bottom"
        title="Add payment method"
        description="Save a card or wallet option for future trips."
      >
        <div className="stack payment-method-form">
          {error ? <p className="error-text" role="alert">{error}</p> : null}
          <Field label="Payment type">
            <Select value={paymentType} onChange={(event) => setPaymentType(event.target.value as "CARD" | "WALLET")}>
              <option value="CARD">Card</option>
              <option value="WALLET">Wallet</option>
            </Select>
          </Field>
          <Field label="Last four digits" hint="We never save your full card number.">
            <input value={lastFourDigits} maxLength={4} inputMode="numeric" autoComplete="off" disabled={paymentType !== "CARD"} onChange={(event) => setLastFourDigits(event.target.value)} />
          </Field>
          <Field label="Expiry date" hint="Format: MM/YY">
            <input placeholder="MM/YY" value={expiryDate} disabled={paymentType !== "CARD"} onChange={(event) => setExpiryDate(event.target.value)} />
          </Field>
          <Button loading={creating} onClick={() => void createMethod()}>Add method</Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={removeMethodId !== null}
        onOpenChange={(open) => { if (!open) setRemoveMethodId(null); }}
        title="Remove this payment method?"
        description={selectedMethod?.lastFourDigits ? `The card ending in ${selectedMethod.lastFourDigits} will be removed.` : "This saved payment method will be removed."}
        confirmLabel="Remove method"
        onConfirm={async () => { if (removeMethodId !== null) await removeMethod(removeMethodId); }}
      />
      {defaultMethod ? <span className="sr-only">Default payment method: {defaultMethod.type === "CARD" ? "Card" : "Wallet"}</span> : null}
    </main>
  );
}
