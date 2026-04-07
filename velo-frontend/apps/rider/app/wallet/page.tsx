"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestRiderProxy } from "../_lib/rider-client";

type PaymentMethod = {
  id: number;
  type: "CARD" | "WALLET" | string;
  lastFourDigits?: string | null;
  expiryDate?: string | null;
  isDefault?: boolean | null;
};

const CARD_LAST4_PATTERN = /^\d{4}$/;

export default function RiderWalletPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [paymentType, setPaymentType] = useState<"CARD" | "WALLET">("CARD");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestRiderProxy<PaymentMethod[]>("payment-methods");
      setMethods(Array.isArray(response) ? response : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payment methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const defaultMethod = useMemo(() => methods.find((method) => method.isDefault), [methods]);

  async function createMethod(): Promise<void> {
    setError(null);
    setMessage(null);

    if (paymentType === "CARD" && !CARD_LAST4_PATTERN.test(lastFourDigits.trim())) {
      setError("Card methods require exactly 4 digits.");
      return;
    }

    if (paymentType === "CARD" && !expiryDate.trim()) {
      setError("Card methods require an expiry value.");
      return;
    }

    setCreating(true);
    try {
      await requestRiderProxy<PaymentMethod>("payment-methods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to add payment method.");
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
      setMessage(`Payment method #${id} is now default.`);
      await loadMethods();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to set default payment method.");
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
      setMessage(`Payment method #${id} removed.`);
      await loadMethods();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to remove payment method.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Wallet</p>
        <h1>Manage payment methods</h1>
        <p>{defaultMethod ? `Default: ${defaultMethod.type}` : "No default payment method set."}</p>
      </section>

      <section className="card stack">
        <strong>Add payment method</strong>
        <div className="grid grid-2">
          <label className="field">
            <span>Type</span>
            <select value={paymentType} onChange={(event) => setPaymentType(event.target.value as "CARD" | "WALLET")}>
              <option value="CARD">Card</option>
              <option value="WALLET">Wallet</option>
            </select>
          </label>
          <label className="field">
            <span>Last four digits</span>
            <input
              value={lastFourDigits}
              maxLength={4}
              inputMode="numeric"
              disabled={paymentType !== "CARD"}
              onChange={(event) => setLastFourDigits(event.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>Expiry</span>
          <input
            placeholder="MM/YY"
            value={expiryDate}
            disabled={paymentType !== "CARD"}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" disabled={creating} onClick={() => void createMethod()}>
          {creating ? "Adding..." : "Add method"}
        </button>
      </section>

      <section className="card stack">
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>Saved methods</strong>
          <button className="primary-button" type="button" disabled={loading} onClick={() => void loadMethods()}>
            Refresh
          </button>
        </div>

        {loading ? <p className="helper">Loading payment methods...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}

        {!loading && !error && methods.length === 0 ? <p className="helper">No payment methods found.</p> : null}

        {!loading && !error && methods.length > 0 ? (
          <div className="list">
            {methods.map((method) => (
              <article className="list-item" key={method.id}>
                <div>
                  <strong>{method.type}</strong>
                  <p>
                    {method.lastFourDigits ? `•••• ${method.lastFourDigits}` : "No card digits"} •{" "}
                    {method.expiryDate ?? "No expiry"}
                  </p>
                </div>
                <div className="actions">
                  <span className="badge">{method.isDefault ? "Default" : "Secondary"}</span>
                  {!method.isDefault ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={actingId === method.id}
                      onClick={() => void setDefault(method.id)}
                    >
                      {actingId === method.id ? "Saving..." : "Set default"}
                    </button>
                  ) : null}
                  <button
                    className="primary-button"
                    type="button"
                    disabled={actingId === method.id}
                    onClick={() => void removeMethod(method.id)}
                  >
                    {actingId === method.id ? "Removing..." : "Remove"}
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
