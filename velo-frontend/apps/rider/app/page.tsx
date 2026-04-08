"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  requestRiderProxy,
  toCurrency,
  type DecimalValue,
  type SpringPage,
} from "./_lib/rider-client";
import {
  mapApiError,
  shouldDisableSubmit,
  validatePointInput,
} from "./_lib/ride-forms";
import {
  getRideFareValue,
  normalizeRidePage,
  selectTripLaneRide,
  type RiderHomeRide,
  type RiderHomeTripLane,
} from "./_lib/rider-home-state";

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

const INITIAL_TRIP_LANE: RiderHomeTripLane = {
  ride: null,
  mode: "empty",
  title: "No active trip right now",
  description: "Request a ride when you are ready. Your most recent trip will appear here once it starts.",
  statusLabel: null,
  timeLabel: null,
  count: 0,
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
  const [loadingTripLane, setLoadingTripLane] = useState(true);
  const [refreshingTripLane, setRefreshingTripLane] = useState(false);
  const [tripLane, setTripLane] = useState<RiderHomeTripLane>(INITIAL_TRIP_LANE);
  const [tripLaneError, setTripLaneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [lastRequest, setLastRequest] = useState<RideRequest | null>(null);
  const [failedAction, setFailedAction] = useState<"estimate" | "request" | null>(null);

  const formInputs = useMemo(
    () => [pickupLat, pickupLng, dropLat, dropLng, paymentMethod],
    [pickupLat, pickupLng, dropLat, dropLng, paymentMethod],
  );

  const loadTripLane = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) {
      setRefreshingTripLane(true);
    } else {
      setLoadingTripLane(true);
    }
    setTripLaneError(null);

    try {
      const response = await requestRiderProxy<SpringPage<RiderHomeRide>>("riders/getMyRides?pageOffset=0&pageSize=10");
      const rides = normalizeRidePage(response);
      setTripLane(selectTripLaneRide(rides));
    } catch (loadError) {
      setTripLaneError(
        loadError instanceof Error
          ? mapApiError({ error: loadError.message }, "Unable to load your trip lane right now.")
          : "Unable to load your trip lane right now.",
      );
      setTripLane(INITIAL_TRIP_LANE);
    } finally {
      setLoadingTripLane(false);
      setRefreshingTripLane(false);
    }
  }, []);

  useEffect(() => {
    void loadTripLane();
  }, [loadTripLane]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTripLane(true);
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [loadTripLane]);

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

  function clearActionFeedback(): void {
    setError(null);
    setMessage(null);
    setFailedAction(null);
  }

  async function estimateFare(): Promise<void> {
    setEstimating(true);
    clearActionFeedback();

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
      const nextMessage =
        estimateError instanceof Error
          ? mapApiError({ error: estimateError.message }, "Unable to fetch fare estimate.")
          : "Unable to fetch fare estimate.";
      setError(nextMessage);
      setFailedAction("estimate");
    } finally {
      setEstimating(false);
    }
  }

  async function requestRide(): Promise<void> {
    setRequesting(true);
    clearActionFeedback();

    try {
      const payload = buildRequestBody();
      const response = await requestRiderProxy<RideRequest>("riders/requestRide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLastRequest(response);
      setMessage("Ride request created successfully.");
      void loadTripLane(true);
    } catch (requestError) {
      const nextMessage =
        requestError instanceof Error
          ? mapApiError({ error: requestError.message }, "Unable to request a ride.")
          : "Unable to request a ride.";
      setError(nextMessage);
      setFailedAction("request");
    } finally {
      setRequesting(false);
    }
  }

  const canEstimate = !shouldDisableSubmit(estimating, formInputs);
  const canRequest = !shouldDisableSubmit(requesting, formInputs);

  async function retryLastAction(): Promise<void> {
    if (failedAction === "estimate") {
      await estimateFare();
    } else if (failedAction === "request") {
      await requestRide();
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Booking</p>
        <h1>Request your next ride</h1>
        <p>Estimate fares, apply promo codes, and request an immediate ride.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <div className="stack compact">
            <strong>{tripLane.mode === "active" ? "Active trip" : tripLane.title}</strong>
            <p className="helper">{tripLane.description}</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={loadingTripLane || refreshingTripLane}
            onClick={() => void loadTripLane(true)}
          >
            {refreshingTripLane ? "Refreshing..." : "Refresh trip lane"}
          </button>
        </div>

        {loadingTripLane ? <p className="helper">Loading trip lane...</p> : null}
        {tripLaneError ? <p className="error-text">{tripLaneError}</p> : null}

        {!loadingTripLane && !tripLaneError && tripLane.ride ? (
          <div className="list-item">
            <div className="stack compact">
              <strong>Ride #{tripLane.ride.id}</strong>
              <p className="helper">
                {tripLane.statusLabel ?? tripLane.ride.rideStatus} • {tripLane.ride.paymentMethod}
              </p>
              <p className="helper">Updated: {tripLane.timeLabel ?? "--"}</p>
            </div>
            <div className="stack compact" style={{ justifyItems: "end" }}>
              <span className="badge">{toCurrency(getRideFareValue(tripLane.ride))}</span>
              <Link className="secondary-button" href="/rides">
                Open rides
              </Link>
            </div>
          </div>
        ) : null}

        {!loadingTripLane && !tripLaneError && !tripLane.ride ? (
          <p className="helper">Your active trip lane is empty for now.</p>
        ) : null}
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
            disabled={!canEstimate}
            onClick={() => void estimateFare()}
          >
            {estimating ? "Estimating..." : "Estimate fare"}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!canRequest}
            onClick={() => void requestRide()}
          >
            {requesting ? "Requesting..." : "Request ride"}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
        {failedAction ? (
          <button className="secondary-button" type="button" onClick={() => void retryLastAction()}>
            {failedAction === "estimate" ? "Retry fare estimate" : "Retry ride request"}
          </button>
        ) : null}
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
