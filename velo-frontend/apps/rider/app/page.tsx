"use client";

import { useState } from "react";
import Link from "next/link";
import { requestRiderProxy, toCurrency, type DecimalValue } from "./_lib/rider-client";
import {
  mapApiError,
  shouldDisableSubmit,
  validatePointInput,
} from "./_lib/ride-forms";

type FareEstimate = {
  estimatedFare: DecimalValue;
  baseFare: DecimalValue;
  surgeMultiplier: number;
  discountAmount: DecimalValue;
  distanceKm: number;
  durationMinutes: number;
};

type RideRequest = {
  id?: number;
  rideRequestStatus?: string;
  paymentMethod: string;
};

export default function RiderHomePage() {
  const [pickupLat, setPickupLat] = useState("12.9716");
  const [pickupLng, setPickupLng] = useState("77.5946");
  const [dropLat, setDropLat] = useState("12.9352");
  const [dropLng, setDropLng] = useState("77.6245");
  const [paymentMethod, setPaymentMethod] = useState("WALLET");
  const [promoCode, setPromoCode] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [lastRequest, setLastRequest] = useState<RideRequest | null>(null);

  function buildRequestBody() {
    const pickup = validatePointInput({ lat: pickupLat, lng: pickupLng }, "Pickup");
    if (!pickup.ok) {
      throw new Error(pickup.error);
    }

    const drop = validatePointInput({ lat: dropLat, lng: dropLng }, "Drop-off");
    if (!drop.ok) {
      throw new Error(drop.error);
    }

    return {
      pickupLocation: pickup.point,
      dropOffLocation: drop.point,
      paymentMethod,
      promoCode: promoCode.trim() || undefined,
    };
  }

  async function estimateFare(): Promise<void> {
    setEstimating(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildRequestBody();
      const response = await requestRiderProxy<FareEstimate>("riders/fare-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setEstimate(response);
      setMessage("Fare estimate updated.");
    } catch (estimateError) {
      setError(
        estimateError instanceof Error
          ? mapApiError({ error: estimateError.message }, "Unable to fetch fare estimate.")
          : "Unable to fetch fare estimate.",
      );
    } finally {
      setEstimating(false);
    }
  }

  async function requestRide(): Promise<void> {
    setRequesting(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildRequestBody();
      const response = await requestRiderProxy<RideRequest>("riders/requestRide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLastRequest(response);
      setMessage("Ride request created successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? mapApiError({ error: requestError.message }, "Unable to request a ride.")
          : "Unable to request a ride.",
      );
    } finally {
      setRequesting(false);
    }
  }

  const disableBooking = shouldDisableSubmit(
    estimating || requesting,
    [pickupLat, pickupLng, dropLat, dropLng, paymentMethod],
  );

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Booking</p>
        <h1>Request your next ride</h1>
        <p>Estimate fares, apply promo codes, and request an immediate ride.</p>
      </section>

      <section className="card stack">
        <strong>Trip details</strong>
        <div className="grid grid-2">
          <label className="field">
            <span>Pickup latitude</span>
            <input value={pickupLat} onChange={(event) => setPickupLat(event.target.value)} />
          </label>
          <label className="field">
            <span>Pickup longitude</span>
            <input value={pickupLng} onChange={(event) => setPickupLng(event.target.value)} />
          </label>
          <label className="field">
            <span>Drop-off latitude</span>
            <input value={dropLat} onChange={(event) => setDropLat(event.target.value)} />
          </label>
          <label className="field">
            <span>Drop-off longitude</span>
            <input value={dropLng} onChange={(event) => setDropLng(event.target.value)} />
          </label>
        </div>

        <div className="grid grid-2">
          <label className="field">
            <span>Payment method</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="WALLET">Wallet</option>
              <option value="CASH">Cash</option>
            </select>
          </label>
          <label className="field">
            <span>Promo code (optional)</span>
            <input
              value={promoCode}
              placeholder="SAVE10"
              onChange={(event) => setPromoCode(event.target.value)}
            />
          </label>
        </div>

        <div className="actions">
          <button
            className="primary-button"
            type="button"
            disabled={disableBooking}
            onClick={() => void estimateFare()}
          >
            {estimating ? "Estimating..." : "Estimate fare"}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={disableBooking}
            onClick={() => void requestRide()}
          >
            {requesting ? "Requesting..." : "Request ride"}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
      </section>

      <section className="card stack">
        <strong>Latest estimate</strong>
        {!estimate ? (
          <p className="helper">No estimate yet.</p>
        ) : (
          <div className="list">
            <div className="list-item">
              <div>
                <strong>Total</strong>
                <p>Distance: {estimate.distanceKm} km • Duration: {estimate.durationMinutes} min</p>
              </div>
              <span className="badge">{toCurrency(estimate.estimatedFare)}</span>
            </div>
            <div className="list-item">
              <div>
                <strong>Base fare</strong>
                <p>Surge multiplier: {estimate.surgeMultiplier}x</p>
              </div>
              <span className="badge">{toCurrency(estimate.baseFare)}</span>
            </div>
            <div className="list-item">
              <div>
                <strong>Discount</strong>
                <p>Promo adjustments</p>
              </div>
              <span className="badge">{toCurrency(estimate.discountAmount)}</span>
            </div>
          </div>
        )}
      </section>

      <section className="card stack">
        <strong>Latest ride request</strong>
        {!lastRequest ? (
          <p className="helper">No ride request submitted yet.</p>
        ) : (
          <div className="list-item">
            <div>
              <strong>Request #{lastRequest.id ?? "pending id"}</strong>
              <p>Status: {lastRequest.rideRequestStatus ?? "PENDING"}</p>
            </div>
            <span className="badge">{lastRequest.paymentMethod}</span>
          </div>
        )}
        <div className="actions">
          <Link href="/rides" className="primary-button">
            View ride history
          </Link>
          <Link href="/scheduled" className="primary-button">
            Manage scheduled rides
          </Link>
        </div>
      </section>
    </main>
  );
}
