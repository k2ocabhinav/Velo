"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  requestDriverProxy,
  toCurrency,
  toRelativeTimestamp,
  type DriverRide,
  type SpringPage,
} from "../../_lib/driver-client";
import {
  canSubmitCancelRide,
  canSubmitEndRide,
  canSubmitStartRide,
  mapApiError,
  validateOtpInput,
} from "../../_lib/driver-forms";
import { useDriverLocationPublisher } from "../../_lib/driver-location-publisher";

export default function DriverRidePage() {
  const params = useParams<{ id: string }>();
  const rideId = Number(params?.id);

  const [ride, setRide] = useState<DriverRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp] = useState("");
  const [pendingAction, setPendingAction] = useState<"START" | "END" | "CANCEL" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRide = useCallback(async () => {
    if (!Number.isFinite(rideId) || rideId <= 0) {
      setError("Ride id is invalid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await requestDriverProxy<SpringPage<DriverRide>>("drivers/getMyRides?pageOffset=0&pageSize=50");
      const rides = Array.isArray(page.content) ? page.content : [];
      const selectedRide = rides.find((item) => item.id === rideId) ?? null;

      if (!selectedRide) {
        setError(`Ride #${rideId} was not found in your recent history.`);
      }
      setRide(selectedRide);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ride details.");
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    void loadRide();
  }, [loadRide]);

  const status = ride?.rideStatus ?? null;
  const locationPublisher = useDriverLocationPublisher(status);

  const canStart = useMemo(() => canSubmitStartRide(status, otp, pendingAction !== null), [status, otp, pendingAction]);
  const canEnd = useMemo(() => canSubmitEndRide(status, pendingAction !== null), [status, pendingAction]);
  const canCancel = useMemo(() => canSubmitCancelRide(status, pendingAction !== null), [status, pendingAction]);

  async function startRide(): Promise<void> {
    if (!ride) {
      return;
    }

    const otpValidation = validateOtpInput(otp);
    if (!otpValidation.ok) {
      setError(otpValidation.error);
      return;
    }

    setPendingAction("START");
    setError(null);
    setMessage(null);

    try {
      const updated = await requestDriverProxy<DriverRide>(`drivers/startRide/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpValidation.value }),
      });
      setRide(updated);
      setMessage("Ride started.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? mapApiError({ error: actionError.message }, "Unable to start ride.")
          : "Unable to start ride.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function endRide(): Promise<void> {
    if (!ride) {
      return;
    }

    setPendingAction("END");
    setError(null);
    setMessage(null);

    try {
      const updated = await requestDriverProxy<DriverRide>(`drivers/endRide/${ride.id}`, {
        method: "POST",
      });
      setRide(updated);
      setMessage("Ride ended successfully.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? mapApiError({ error: actionError.message }, "Unable to end ride.")
          : "Unable to end ride.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function cancelRide(): Promise<void> {
    if (!ride) {
      return;
    }

    setPendingAction("CANCEL");
    setError(null);
    setMessage(null);

    try {
      const updated = await requestDriverProxy<DriverRide>(`drivers/cancelRide/${ride.id}`, {
        method: "POST",
      });
      setRide(updated);
      setMessage("Ride cancelled.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? mapApiError({ error: actionError.message }, "Unable to cancel ride.")
          : "Unable to cancel ride.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="stack">
      <section className="hero">
        <p className="badge">Ride Control</p>
        <h1>Manage ride #{Number.isFinite(rideId) ? rideId : "--"}</h1>
        <p>Use OTP-based start and status-aware actions for deterministic ride transitions.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <strong>Ride details</strong>
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void loadRide()}>
            Refresh
          </button>
        </div>

        {loading ? <p className="helper">Loading ride...</p> : null}
        {!loading && !ride && !error ? <p className="helper">Ride details are unavailable.</p> : null}

        {ride ? (
          <div className="list">
            <div className="list-item">
              <div className="stack compact">
                <strong>Status</strong>
                <p className="helper">{ride.rideStatus}</p>
              </div>
              <span className="badge">{ride.paymentMethod}</span>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Fare</strong>
                <p className="helper">Promo: {ride.promoCode ?? "--"}</p>
              </div>
              <span className="badge">{toCurrency(ride.fair)}</span>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Timeline</strong>
                <p className="helper">Created: {toRelativeTimestamp(ride.createdTime)}</p>
                <p className="helper">Started: {toRelativeTimestamp(ride.startedAt)}</p>
                <p className="helper">Ended: {toRelativeTimestamp(ride.endedAt)}</p>
              </div>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Live location publishing</strong>
                <p className="helper">{locationPublisher.message}</p>
                <p className="helper">
                  Last publish: {locationPublisher.lastPublishedAt ? toRelativeTimestamp(locationPublisher.lastPublishedAt) : "--"}
                </p>
              </div>
              <span className="badge">{locationPublisher.mode}</span>
            </div>
          </div>
        ) : null}

        {ride ? (
          <div className="stack">
            <label className="field">
              <span>Ride OTP</span>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                placeholder="Enter 4-digit OTP"
                maxLength={4}
              />
            </label>
            <div className="actions">
              <button className="primary-button" type="button" disabled={!canStart} onClick={() => void startRide()}>
                {pendingAction === "START" ? "Starting..." : "Start ride"}
              </button>
              <button className="primary-button" type="button" disabled={!canEnd} onClick={() => void endRide()}>
                {pendingAction === "END" ? "Ending..." : "End ride"}
              </button>
              <button className="secondary-button" type="button" disabled={!canCancel} onClick={() => void cancelRide()}>
                {pendingAction === "CANCEL" ? "Cancelling..." : "Cancel ride"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
      </section>

      <section className="card stack">
        <strong>Next</strong>
        <div className="actions">
          <Link className="secondary-button" href="/rides">
            Back to rides
          </Link>
          <Link className="secondary-button" href="/earnings">
            View earnings
          </Link>
        </div>
      </section>
    </main>
  );
}
