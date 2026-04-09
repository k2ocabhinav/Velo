"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isRideCancelableFromTripLane,
  normalizeRidePage,
  selectTripLaneRide,
  type RiderHomeRide,
  type RiderHomeTripLane,
} from "./_lib/rider-home-state";
import {
  getRiderRealtimeStatusText,
  useRiderNotificationSubscription,
  type RiderNotificationEvent,
} from "./_lib/rider-ws";
import { useActiveRideRedirect } from "./_lib/use-active-ride-redirect";
import { inputStringsToMapPoint, mapPointToInputStrings, type SelectionTarget } from "./_lib/booking-map-state";
import { fetchRoutePath, type MapPoint, type RoutePath } from "./_lib/map/routing";
import { BookingMapLoader } from "./_components/booking-map-loader";

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
  createdTime?: string;
};

const ACTIVE_TRIP_REFRESH_INTERVAL_MS = 10_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 30_000;
const TRIP_LANE_NOTIFICATION_TYPES = new Set([
  "RIDE_REQUESTED",
  "RIDE_ACCEPTED",
  "RIDE_STARTED",
  "RIDE_ENDED",
  "RIDE_CANCELLED",
  "RIDE_DISPATCHED",
]);

function isTripLaneNotification(event: RiderNotificationEvent): boolean {
  if (!event.type) {
    return false;
  }

  return TRIP_LANE_NOTIFICATION_TYPES.has(event.type.toUpperCase());
}

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
  useActiveRideRedirect("/");

  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropLat, setDropLat] = useState("");
  const [dropLng, setDropLng] = useState("");
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
  const [cancelingRideId, setCancelingRideId] = useState<number | null>(null);
  const [failedAction, setFailedAction] = useState<"estimate" | "request" | null>(null);
  const [lastTripLaneSyncAt, setLastTripLaneSyncAt] = useState<string | null>(null);

  const [activeTarget, setActiveTarget] = useState<SelectionTarget>("pickup");
  const [routePath, setRoutePath] = useState<RoutePath | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const routeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickupPoint = useMemo(() => inputStringsToMapPoint(pickupLat, pickupLng), [pickupLat, pickupLng]);
  const dropOffPoint = useMemo(() => inputStringsToMapPoint(dropLat, dropLng), [dropLat, dropLng]);

  useEffect(() => {
    if (routeDebounceRef.current) {
      clearTimeout(routeDebounceRef.current);
    }

    if (!pickupPoint || !dropOffPoint) {
      setRoutePath(null);
      return;
    }

    let cancelled = false;
    setLoadingRoute(true);

    routeDebounceRef.current = setTimeout(() => {
      void fetchRoutePath(pickupPoint, dropOffPoint)
        .then((result) => {
          if (!cancelled) setRoutePath(result);
        })
        .finally(() => {
          if (!cancelled) setLoadingRoute(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      if (routeDebounceRef.current) {
        clearTimeout(routeDebounceRef.current);
      }
    };
  }, [pickupPoint, dropOffPoint]);

  const handleMapPointSelected = useCallback(
    (target: SelectionTarget, point: MapPoint) => {
      const strings = mapPointToInputStrings(point);
      if (target === "pickup") {
        setPickupLat(strings.lat);
        setPickupLng(strings.lng);
      } else {
        setDropLat(strings.lat);
        setDropLng(strings.lng);
      }
      // Auto-advance: after placing pickup, switch to dropoff
      if (target === "pickup") {
        setActiveTarget("dropoff");
      }
    },
    [],
  );

  const formInputs = useMemo(
    () => [pickupLat, pickupLng, dropLat, dropLng, paymentMethod],
    [pickupLat, pickupLng, dropLat, dropLng, paymentMethod],
  );

  const loadTripLane = useCallback(
    async (refresh = false, pendingRequestOverride?: RideRequest | null): Promise<void> => {
      if (refresh) {
        setRefreshingTripLane(true);
      } else {
        setLoadingTripLane(true);
      }
      setTripLaneError(null);
      const pendingRequest = pendingRequestOverride === undefined ? lastRequest : pendingRequestOverride;

      try {
        const response = await requestRiderProxy<SpringPage<RiderHomeRide>>("riders/getMyRides?pageOffset=0&pageSize=10");
        const rides = normalizeRidePage(response);
        setTripLane(selectTripLaneRide(rides, pendingRequest));
        setLastTripLaneSyncAt(new Date().toISOString());
      } catch (loadError) {
        setTripLaneError(
          loadError instanceof Error
            ? mapApiError({ error: loadError.message }, "Unable to load your trip lane right now.")
            : "Unable to load your trip lane right now.",
        );
        setTripLane(selectTripLaneRide([], pendingRequest));
      } finally {
        setLoadingTripLane(false);
        setRefreshingTripLane(false);
      }
    },
    [lastRequest],
  );

  useEffect(() => {
    void loadTripLane();
  }, [loadTripLane]);

  const tripLaneRefreshInterval =
    tripLane.mode === "active" || tripLane.mode === "pending"
      ? ACTIVE_TRIP_REFRESH_INTERVAL_MS
      : BACKGROUND_REFRESH_INTERVAL_MS;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTripLane(true);
    }, tripLaneRefreshInterval);

    return () => window.clearInterval(intervalId);
  }, [loadTripLane, tripLaneRefreshInterval]);

  const handleRealtimeNotification = useCallback(
    (event: RiderNotificationEvent) => {
      if (!isTripLaneNotification(event)) {
        return;
      }

      setLastTripLaneSyncAt(new Date().toISOString());
      void loadTripLane(true);
    },
    [loadTripLane],
  );

  const realtime = useRiderNotificationSubscription(true, handleRealtimeNotification);

  const tripLaneSyncMessage = useMemo(() => {
    const base = getRiderRealtimeStatusText(realtime.state, realtime.reconnectAttempts);
    if (realtime.state === "error" && realtime.lastError) {
      return `${base} ${realtime.lastError}`;
    }

    if (lastTripLaneSyncAt) {
      const syncedAt = new Date(lastTripLaneSyncAt);
      const syncLabel = Number.isNaN(syncedAt.getTime()) ? "recently" : syncedAt.toLocaleTimeString();
      return `${base} Last trip sync ${syncLabel}.`;
    }

    return base;
  }, [lastTripLaneSyncAt, realtime.lastError, realtime.reconnectAttempts, realtime.state]);

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
      const pendingRequest: RideRequest = {
        ...response,
        createdTime: new Date().toISOString(),
      };
      setLastRequest(pendingRequest);
      setMessage("Ride request created successfully.");
      void loadTripLane(true, pendingRequest);
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

  async function cancelActiveRide(): Promise<void> {
    const ride = tripLane.ride;
    if (!ride || !isRideCancelableFromTripLane(ride.rideStatus)) {
      return;
    }

    setCancelingRideId(ride.id);
    clearActionFeedback();

    try {
      await requestRiderProxy<RiderHomeRide>(`riders/cancelRide/${ride.id}`, {
        method: "POST",
      });
      const updatedRequest = lastRequest
        ? {
            ...lastRequest,
            rideRequestStatus: "CANCELLED",
          }
        : null;
      setLastRequest(updatedRequest);
      setMessage(`Ride #${ride.id} canceled.`);
      await loadTripLane(true, updatedRequest);
    } catch (cancelError) {
      const nextMessage =
        cancelError instanceof Error
          ? mapApiError({ error: cancelError.message }, "Unable to cancel ride.")
          : "Unable to cancel ride.";
      setError(nextMessage);
    } finally {
      setCancelingRideId(null);
    }
  }

  const canEstimate = !shouldDisableSubmit(estimating, formInputs);
  const hasInFlightTrip = tripLane.mode === "pending" || tripLane.mode === "active";
  const canRequest = !shouldDisableSubmit(requesting, formInputs) && !hasInFlightTrip;

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
            <p className={realtime.state === "error" ? "error-text" : "helper"}>{tripLaneSyncMessage}</p>
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
              <div className="actions">
                {isRideCancelableFromTripLane(tripLane.ride.rideStatus) ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={cancelingRideId === tripLane.ride.id}
                    onClick={() => void cancelActiveRide()}
                  >
                    {cancelingRideId === tripLane.ride.id ? "Canceling..." : "Cancel ride"}
                  </button>
                ) : null}
                <Link className="secondary-button" href="/rides">
                  Open rides
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {!loadingTripLane && !tripLaneError && !tripLane.ride && tripLane.mode === "pending" ? (
          <div className="list-item">
            <div className="stack compact">
              <strong>Request #{lastRequest?.id ?? "pending id"}</strong>
              <p className="helper">
                {tripLane.statusLabel ?? lastRequest?.rideRequestStatus ?? "PENDING"} •{" "}
                {lastRequest?.paymentMethod ?? paymentMethod}
              </p>
              <p className="helper">Updated: {tripLane.timeLabel ?? "--"}</p>
            </div>
            <div className="stack compact" style={{ justifyItems: "end" }}>
              <span className="badge">Finding driver</span>
              <Link className="secondary-button" href="/rides">
                Open rides
              </Link>
            </div>
          </div>
        ) : null}

        {!loadingTripLane && !tripLaneError && !tripLane.ride ? (
          tripLane.mode === "pending" ? null : <p className="helper">Your active trip lane is empty for now.</p>
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
        {hasInFlightTrip ? (
          <p className="helper">You already have an active or pending trip. Complete or cancel it before requesting another ride.</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
        {failedAction ? (
          <button className="secondary-button" type="button" onClick={() => void retryLastAction()}>
            {failedAction === "estimate" ? "Retry fare estimate" : "Retry ride request"}
          </button>
        ) : null}
      </section>

      <section className="card stack">
        <strong>Select on map</strong>
        <p className="helper">
          Tap the map to place a marker. Drag markers to fine-tune.
          {loadingRoute ? " Calculating route..." : routePath && routePath.points.length > 1 ? " Route preview shown." : null}
        </p>
        <div className="booking-map-controls">
          <button
            className={activeTarget === "pickup" ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => setActiveTarget("pickup")}
          >
            Set pickup
          </button>
          <button
            className={activeTarget === "dropoff" ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => setActiveTarget("dropoff")}
          >
            Set drop-off
          </button>
        </div>
        <BookingMapLoader
          pickup={pickupPoint}
          dropOff={dropOffPoint}
          routePoints={routePath?.points ?? []}
          activeTarget={activeTarget}
          onPointSelected={handleMapPointSelected}
        />
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
