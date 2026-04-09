"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestDriverProxy, toCurrency, toRelativeTimestamp, type DriverRide, type SpringPage } from "../../_lib/driver-client";
import {
  canSubmitCancelRide,
  canSubmitEndRide,
  canSubmitRateRider,
  canSubmitStartRide,
  mapApiError,
  validateOtpInput,
  validateRatingInput,
} from "../../_lib/driver-forms";
import { useDriverLocationPublisher } from "../../_lib/driver-location-publisher";
import {
  formatMapPoint,
  getDriverRideFareValue,
  getDriverRideStatusLabel,
  isDriverRideActive,
  normalizeDriverRidePage,
  toDriverRideTimeline,
  toMapPoint,
} from "../../_lib/driver-ride-state";
import { fetchRoutePath, type RoutePath } from "../../_lib/map/routing";
import { getDriverRealtimeStatusText, useDriverNotificationSubscription, type DriverNotificationEvent } from "../../_lib/driver-ws";
import { DriverRideMapLoader } from "./_components/driver-ride-map-loader";

const ACTIVE_RIDE_REFRESH_INTERVAL_MS = 10_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 30_000;

export default function DriverRidePage() {
  const params = useParams<{ id: string }>();
  const rideId = Number(params?.id);

  const [ride, setRide] = useState<DriverRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingAction, setPendingAction] = useState<"START" | "END" | "CANCEL" | null>(null);
  const [ratingValue, setRatingValue] = useState("5");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratedRideId, setRatedRideId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<RoutePath | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const loadRide = useCallback(
    async (refresh = false): Promise<void> => {
      if (!Number.isFinite(rideId) || rideId <= 0) {
        setError("Ride id is invalid.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const page = await requestDriverProxy<SpringPage<DriverRide>>("drivers/getMyRides?pageOffset=0&pageSize=50");
        const rides = normalizeDriverRidePage(page);
        const selectedRide = rides.find((item) => item.id === rideId) ?? null;

        if (!selectedRide) {
          setError(`Ride #${rideId} was not found in your recent history.`);
        }
        setRide(selectedRide);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load ride details.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [rideId],
  );

  useEffect(() => {
    void loadRide();
  }, [loadRide]);

  const status = ride?.rideStatus ?? null;
  const statusLabel = getDriverRideStatusLabel(status);
  const locationPublisher = useDriverLocationPublisher(status);

  const pickupPoint = useMemo(() => toMapPoint(ride?.pickupLocation), [ride?.pickupLocation]);
  const dropOffPoint = useMemo(() => toMapPoint(ride?.dropOffLocation), [ride?.dropOffLocation]);
  const driverPoint = locationPublisher.lastPublishedPoint;
  const timeline = toDriverRideTimeline(status);

  useEffect(() => {
    if (!pickupPoint || !dropOffPoint) {
      setRoutePath(null);
      return;
    }

    let cancelled = false;
    setLoadingRoute(true);

    void fetchRoutePath(pickupPoint, dropOffPoint)
      .then((nextRoute) => {
        if (!cancelled) {
          setRoutePath(nextRoute);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRoute(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dropOffPoint, pickupPoint, ride?.id]);

  const handleRealtimeNotification = useCallback(
    (event: DriverNotificationEvent) => {
      if (!event.type?.toUpperCase().startsWith("RIDE_")) {
        return;
      }

      void loadRide(true);
    },
    [loadRide],
  );

  const realtime = useDriverNotificationSubscription(true, handleRealtimeNotification);

  useEffect(() => {
    if (!Number.isFinite(rideId) || rideId <= 0) {
      return;
    }

    const refreshIntervalMs = isDriverRideActive(status)
      ? ACTIVE_RIDE_REFRESH_INTERVAL_MS
      : BACKGROUND_REFRESH_INTERVAL_MS;
    const intervalId = window.setInterval(() => {
      void loadRide(true);
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadRide, rideId, status]);

  const ratingAlreadySubmitted = ratedRideId === ride?.id;

  const canStart = useMemo(() => canSubmitStartRide(status, otp, pendingAction !== null), [status, otp, pendingAction]);
  const canEnd = useMemo(() => canSubmitEndRide(status, pendingAction !== null), [status, pendingAction]);
  const canCancel = useMemo(() => canSubmitCancelRide(status, pendingAction !== null), [status, pendingAction]);
  const canRate = useMemo(
    () => canSubmitRateRider(status, ratingValue, pendingAction !== null || submittingRating, ratingAlreadySubmitted),
    [pendingAction, ratingAlreadySubmitted, ratingValue, status, submittingRating],
  );

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
      setMessage("Ride ended successfully. Please rate the rider.");
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

  async function rateRider(): Promise<void> {
    if (!ride) {
      return;
    }

    const validation = validateRatingInput(ratingValue);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setSubmittingRating(true);
    setError(null);
    setMessage(null);

    try {
      await requestDriverProxy("drivers/rateRider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: ride.id,
          rating: validation.value,
        }),
      });
      setRatedRideId(ride.id);
      setMessage(`Rider rated ${validation.value} star${validation.value === 1 ? "" : "s"} for ride #${ride.id}.`);
    } catch (ratingError) {
      setError(
        ratingError instanceof Error
          ? mapApiError({ error: ratingError.message }, "Unable to submit rider rating.")
          : "Unable to submit rider rating.",
      );
    } finally {
      setSubmittingRating(false);
    }
  }

  return (
    <main className="stack">
      <section className="hero">
        <p className="badge">Ride Control</p>
        <h1>Manage ride #{Number.isFinite(rideId) ? rideId : "--"} end-to-end</h1>
        <p>Start, track, complete, and close the trip with deterministic feedback at every step.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <strong>Ride details</strong>
          <button className="secondary-button" type="button" disabled={loading || refreshing} onClick={() => void loadRide(true)}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? <p className="helper">Loading ride...</p> : null}
        {!loading && !ride && !error ? <p className="helper">Ride details are unavailable.</p> : null}

        {ride ? (
          <div className="list">
            <div className="list-item">
              <div className="stack compact">
                <strong>Status</strong>
                <p className="helper">{statusLabel}</p>
                <p className="helper">{getDriverRealtimeStatusText(realtime.state, realtime.reconnectAttempts)}</p>
              </div>
              <span className="badge">{ride.paymentMethod}</span>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Rider</strong>
                <p className="helper">{ride.rider?.user?.name ?? "Assigned rider"}</p>
                <p className="helper">{ride.rider?.user?.email ?? "--"}</p>
              </div>
              <span className="badge">Ride #{ride.id}</span>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Fare</strong>
                <p className="helper">Promo: {ride.promoCode ?? "--"}</p>
                <p className="helper">OTP: {ride.otp ?? "--"}</p>
              </div>
              <span className="badge">{toCurrency(getDriverRideFareValue(ride))}</span>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Route coordinates</strong>
                <p className="helper">Pickup: {formatMapPoint(pickupPoint)}</p>
                <p className="helper">Drop-off: {formatMapPoint(dropOffPoint)}</p>
                <p className="helper">Driver location: {formatMapPoint(driverPoint)}</p>
              </div>
              <span className="helper">{loadingRoute ? "Routing..." : "Route ready"}</span>
            </div>
            <div className="list-item">
              <div className="stack compact">
                <strong>Timeline</strong>
                <p className="helper">Created: {toRelativeTimestamp(ride.createdTime)}</p>
                <p className="helper">Started: {toRelativeTimestamp(ride.startedAt)}</p>
                <p className="helper">Ended: {toRelativeTimestamp(ride.endedAt)}</p>
              </div>
            </div>
          </div>
        ) : null}

        {ride ? (
          <div className="timeline">
            {timeline.map((step) => (
              <div className="timeline-item" key={step.label}>
                <span className={`timeline-dot${step.done ? " done" : ""}`} />
                <p>{step.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
      </section>

      <section className="card stack">
        <div className="split-row">
          <strong>Live map</strong>
          <p className="helper">{locationPublisher.message}</p>
        </div>
        {realtime.lastError ? <p className="helper">{realtime.lastError}</p> : null}
        <p className="helper">
          Last publish: {locationPublisher.lastPublishedAt ? toRelativeTimestamp(locationPublisher.lastPublishedAt) : "--"}
        </p>
        <DriverRideMapLoader
          pickup={pickupPoint}
          dropOff={dropOffPoint}
          driver={driverPoint}
          routePoints={routePath?.points ?? []}
        />
      </section>

      <section className="card stack">
        <strong>Ride actions</strong>
        {ride ? (
          <>
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

            <label className="field-inline">
              <span>Rate rider</span>
              <select value={ratingValue} onChange={(event) => setRatingValue(event.target.value)}>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
              <button className="secondary-button" type="button" disabled={!canRate} onClick={() => void rateRider()}>
                {submittingRating ? "Submitting..." : ratingAlreadySubmitted ? "Rated" : "Rate rider"}
              </button>
            </label>
            {status !== "ENDED" ? <p className="helper">Rider rating unlocks after the trip is completed.</p> : null}
          </>
        ) : null}
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
