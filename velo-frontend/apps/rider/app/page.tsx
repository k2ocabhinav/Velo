"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CountdownBadge, LiveStatusPill, MatchingIndicator } from "@velo/ui/feedback";
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
  normalizeCurrentRideRequest,
  normalizeRidePage,
  hasInFlightRideRequest,
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
import {
  buildRideDraftSignature,
  hasCompleteLocationSelection,
  inputStringsToMapPoint,
  mapPointToInputStrings,
  type SelectionTarget,
} from "./_lib/booking-map-state";
import { fetchRoutePath, type MapPoint, type RoutePath } from "./_lib/map/routing";
import { BookingMapLoader } from "./_components/booking-map-loader";

type FareEstimate = {
  estimatedFare: DecimalValue;
  baseFare: DecimalValue;
  originalFare?: DecimalValue;
  discountedFare?: DecimalValue;
  savings?: DecimalValue;
  promoApplied?: boolean;
  promoMessage?: string | null;
  surgeMultiplier: number;
  discountAmount: DecimalValue;
  walletBalance?: DecimalValue | null;
  walletSufficient?: boolean | null;
  distanceKm: number;
  durationMinutes: number;
};

type RideRequest = {
  id?: number;
  rideRequestStatus?: string;
  paymentMethod: string;
  requestedTime?: string | null;
  createdTime?: string;
};

type TenantBranding = {
  brandName?: string;
  riderLabel?: string;
  driverLabel?: string;
  tripLabel?: string;
  primaryColor?: string;
  dispatchMode?: "RIDE_HAILING" | "DELIVERY_MERCHANT" | "FLEET_MANAGED";
  riderPortalEnabled?: boolean;
};

const ACTIVE_TRIP_REFRESH_INTERVAL_MS = 10_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 30_000;
const GEOLOCATION_TIMEOUT_MS = 8_000;
const OFFER_TTL_MS = 45_000;
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
  const [resolvingPickupLocation, setResolvingPickupLocation] = useState(false);
  const [loadingTripLane, setLoadingTripLane] = useState(true);
  const [refreshingTripLane, setRefreshingTripLane] = useState(false);
  const [tripLane, setTripLane] = useState<RiderHomeTripLane>(INITIAL_TRIP_LANE);
  const [tripLaneError, setTripLaneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [estimateSignature, setEstimateSignature] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<RideRequest | null>(null);
  const [cancelingRideId, setCancelingRideId] = useState<number | null>(null);
  const [failedAction, setFailedAction] = useState<"estimate" | "request" | null>(null);
  const [lastTripLaneSyncAt, setLastTripLaneSyncAt] = useState<string | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);

  const [activeTarget, setActiveTarget] = useState<SelectionTarget>("pickup");
  const [routePath, setRoutePath] = useState<RoutePath | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const routeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickupPoint = useMemo(() => inputStringsToMapPoint(pickupLat, pickupLng), [pickupLat, pickupLng]);
  const dropOffPoint = useMemo(() => inputStringsToMapPoint(dropLat, dropLng), [dropLat, dropLng]);
  const bookingStep = !pickupPoint ? 1 : !dropOffPoint ? 2 : 3;
  const hasSelectedLocations = hasCompleteLocationSelection(pickupPoint, dropOffPoint);
  const currentDraftSignature = useMemo(
    () =>
      buildRideDraftSignature({
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        paymentMethod,
        promoCode,
      }),
    [dropLat, dropLng, paymentMethod, pickupLat, pickupLng, promoCode],
  );
  const hasFreshEstimate = Boolean(estimate && estimateSignature && estimateSignature === currentDraftSignature);
  const riderLabel = branding?.riderLabel ?? "Rider";
  const driverLabel = branding?.driverLabel ?? "Driver";
  const tripLabel = branding?.tripLabel ?? "Trip";
  const riderPortalEnabled = branding?.riderPortalEnabled ?? true;

  useEffect(() => {
    let cancelled = false;
    setLoadingBranding(true);

    void requestRiderProxy<TenantBranding>("api/v1/tenant/branding")
      .then((payload) => {
        if (!cancelled) {
          setBranding(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranding(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBranding(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!estimateSignature) {
      return;
    }

    if (estimateSignature !== currentDraftSignature) {
      setEstimateSignature(null);
    }
  }, [currentDraftSignature, estimateSignature]);

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
        const [ridesResult, currentRequestResult] = await Promise.allSettled([
          requestRiderProxy<SpringPage<RiderHomeRide>>("riders/getMyRides?pageOffset=0&pageSize=10"),
          requestRiderProxy<RideRequest | null>("riders/current-request"),
        ]);
        const currentRequest =
          currentRequestResult.status === "fulfilled"
            ? normalizeCurrentRideRequest(currentRequestResult.value)
            : pendingRequest;
        const rides = ridesResult.status === "fulfilled" ? normalizeRidePage(ridesResult.value) : [];

        if (currentRequestResult.status === "fulfilled") {
          setLastRequest((previous) => {
            const next = currentRequest as RideRequest | null;
            if (
              previous?.id === next?.id &&
              previous?.rideRequestStatus === next?.rideRequestStatus &&
              previous?.paymentMethod === next?.paymentMethod &&
              previous?.createdTime === next?.createdTime
            ) {
              return previous;
            }
            return next;
          });
        }
        setTripLane(selectTripLaneRide(rides, currentRequest));
        const failedResult = [ridesResult, currentRequestResult].find((result) => result.status === "rejected");
        if (failedResult?.status === "rejected") {
          setTripLaneError(
            failedResult.reason instanceof Error
              ? mapApiError({ error: failedResult.reason.message }, "Unable to load your trip lane right now.")
              : "Unable to load your trip lane right now.",
          );
        } else {
          setLastTripLaneSyncAt(new Date().toISOString());
        }
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

      const eventType = event.type?.toUpperCase();
      if (eventType === "RIDE_CANCELLED") {
        setMessage("Your driver cancelled the trip. Please request a new ride.");
      }
      if (eventType === "RIDE_ACCEPTED") {
        setMessage(`Ride accepted — ${driverLabel} is on the way.`);
      }

      setLastTripLaneSyncAt(new Date().toISOString());
      void loadTripLane(true);
    },
    [driverLabel, loadTripLane],
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
      return `Last lane sync ${syncLabel}.`;
    }

    return base;
  }, [lastTripLaneSyncAt, realtime.lastError, realtime.reconnectAttempts, realtime.state]);

  const pendingRequestExpiresAtMs = useMemo(() => {
    const createdTime = lastRequest?.createdTime;
    if (!createdTime) {
      return null;
    }

    const createdMs = new Date(createdTime).getTime();
    if (!Number.isFinite(createdMs)) {
      return null;
    }

    return createdMs + OFFER_TTL_MS;
  }, [lastRequest?.createdTime]);

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

  async function setPickupToCurrentLocation(): Promise<void> {
    clearActionFeedback();
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is unavailable in this browser. Set pickup manually on the map.");
      return;
    }

    setResolvingPickupLocation(true);
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextPoint: MapPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const strings = mapPointToInputStrings(nextPoint);
          setPickupLat(strings.lat);
          setPickupLng(strings.lng);
          setActiveTarget("dropoff");
          setMessage("Pickup pinned to your current location. Set drop-off next.");
          resolve();
        },
        (locationError) => {
          const nextMessage =
            locationError.code === locationError.PERMISSION_DENIED
              ? "Location permission was denied. Set pickup manually on the map."
              : "Unable to read current location right now. Set pickup manually on the map.";
          setError(nextMessage);
          resolve();
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: GEOLOCATION_TIMEOUT_MS,
        },
      );
    });
    setResolvingPickupLocation(false);
  }

  function clearLocations(): void {
    setPickupLat("");
    setPickupLng("");
    setDropLat("");
    setDropLng("");
    setRoutePath(null);
    setEstimate(null);
    setEstimateSignature(null);
    setActiveTarget("pickup");
    clearActionFeedback();
    setMessage("Pickup and drop-off have been cleared.");
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
      setEstimateSignature(currentDraftSignature);
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
    clearActionFeedback();
    if (loadingTripLane) {
      setError("Checking your current trip status. Please try again in a moment.");
      return;
    }
    if (hasInFlightTrip) {
      setError("You already have a pending or active trip request.");
      return;
    }
    if (!hasSelectedLocations) {
      setError("Set pickup and drop-off before requesting a ride.");
      return;
    }
    if (!hasFreshEstimate) {
      setError("Estimate fare with the latest trip details before requesting a ride.");
      setFailedAction("estimate");
      return;
    }
    setRequesting(true);

    try {
      const payload = buildRequestBody();
      const response = await requestRiderProxy<RideRequest>("riders/requestRide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const pendingRequest: RideRequest = {
        ...response,
        createdTime: response.requestedTime ?? new Date().toISOString(),
      };
      setLastRequest(pendingRequest);
      setMessage(`${tripLabel} requested. We are now matching you with a nearby ${driverLabel.toLowerCase()}.`);
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
      setPickupLat("");
      setPickupLng("");
      setDropLat("");
      setDropLng("");
      setRoutePath(null);
      setEstimate(null);
      setEstimateSignature(null);
      setActiveTarget("pickup");
      setMessage(`${tripLabel} #${ride.id} cancelled. Request a new ${tripLabel.toLowerCase()}.`);
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

  const canEstimate = hasSelectedLocations && !shouldDisableSubmit(estimating, formInputs);
  const hasInFlightTrip = tripLane.mode === "pending" || tripLane.mode === "active" || hasInFlightRideRequest(lastRequest);
  const canRequest =
    !loadingTripLane &&
    hasSelectedLocations &&
    hasFreshEstimate &&
    !shouldDisableSubmit(requesting, formInputs) &&
    !hasInFlightTrip;

  async function retryLastAction(): Promise<void> {
    if (failedAction === "estimate") {
      await estimateFare();
    } else if (failedAction === "request") {
      await requestRide();
    }
  }

  if (!loadingBranding && !riderPortalEnabled) {
    return (
      <main
        className="app-shell stack"
        style={branding?.primaryColor ? ({ "--accent": branding.primaryColor } as CSSProperties) : undefined}
      >
        <section className="hero">
          <p className="badge">Portal unavailable</p>
          <h1>{riderLabel} portal is disabled for this tenant</h1>
          <p>This tenant uses merchant dispatch mode. Please contact your operations admin.</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="app-shell stack"
      style={branding?.primaryColor ? ({ "--accent": branding.primaryColor } as CSSProperties) : undefined}
    >
      <section className="hero">
        <p className="badge">Booking</p>
        <h1>Request your next {tripLabel.toLowerCase()}</h1>
        <p>Estimate fares, apply promo codes, and request an immediate {tripLabel.toLowerCase()}.</p>
      </section>

      <section className="card stack">
        <strong>Select on map</strong>
        <p className="helper">Tap the map to place a marker. Drag markers to fine-tune pickup and drop-off.</p>
        <div className="lane-status-row">
          <LiveStatusPill
            state={loadingRoute ? "connecting" : routePath && routePath.points.length > 1 ? "connected" : "idle"}
            label={loadingRoute ? "Calculating route" : routePath && routePath.points.length > 1 ? "Route ready" : "Pick locations"}
          />
        </div>
        <p className="helper">Active selection: {activeTarget === "pickup" ? "Pickup" : "Drop-off"}.</p>
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
        <div className="split-row">
          <div className="stack compact">
            <strong>{tripLane.mode === "active" ? `Active ${tripLabel.toLowerCase()}` : tripLane.title}</strong>
            <p className="helper">{tripLane.description}</p>
            <div className="lane-status-row">
              <LiveStatusPill
                state={realtime.state}
                label={realtime.state === "connected" ? "Actively listening" : undefined}
              />
              <span className={realtime.state === "error" ? "error-text" : "helper"}>{tripLaneSyncMessage}</span>
            </div>
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

        {loadingTripLane ? (
          <div className="lane-loading" aria-live="polite" aria-label="Loading trip lane">
            <div className="lane-skeleton" data-size="lg" />
            <div className="lane-skeleton" data-size="md" />
            <div className="lane-skeleton" data-size="sm" />
          </div>
        ) : null}
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
                {tripLane.mode === "active" ? (
                  <Link className="secondary-button" href="/ride/active">
                    Open live {tripLabel.toLowerCase()}
                  </Link>
                ) : null}
                <Link className="secondary-button" href="/rides">
                  Open {tripLabel.toLowerCase()} history
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
              <MatchingIndicator
                label={`Matching nearby ${driverLabel.toLowerCase()}s`}
                expiresAtMs={pendingRequestExpiresAtMs}
              />
              <CountdownBadge expiresAtMs={pendingRequestExpiresAtMs} prefix="Request expires in" />
              <Link className="secondary-button" href="/rides">
                Open {tripLabel.toLowerCase()} history
              </Link>
            </div>
          </div>
        ) : null}

        {!loadingTripLane && !tripLaneError && !tripLane.ride ? (
          tripLane.mode === "pending" ? null : <p className="helper">Your active {tripLabel.toLowerCase()} lane is empty for now.</p>
        ) : null}
        {!loadingTripLane && !tripLaneError && tripLane.mode !== "active" && tripLane.mode !== "pending" ? (
          <div className="actions">
            <button className="secondary-button" type="button" onClick={clearLocations}>
              Request new {tripLabel.toLowerCase()}
            </button>
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <strong>{tripLabel} details</strong>
        <p className="helper">
          Step {bookingStep} of 3:
          {" "}
          {bookingStep === 1
            ? "Set pickup on the map."
            : bookingStep === 2
              ? "Set drop-off on the map."
              : "Estimate fare and confirm request."}
        </p>

        <div className="grid grid-2">
          <label className="field">
            <span>Payment method</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="WALLET">Wallet</option>
              <option value="CASH">Cash</option>
              <option value="CARD" disabled>Card (Coming soon)</option>
              <option value="UPI" disabled>UPI (Coming soon)</option>
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
            className="secondary-button"
            type="button"
            disabled={resolvingPickupLocation || estimating || requesting}
            onClick={() => void setPickupToCurrentLocation()}
          >
            {resolvingPickupLocation ? "Locating..." : "Use current location"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={estimating || requesting}
            onClick={clearLocations}
          >
            Clear locations
          </button>
        </div>
        <details>
          <summary>Advanced coordinates</summary>
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
        </details>

        {!hasSelectedLocations ? (
          <p className="helper">Select pickup and drop-off to unlock fare estimation and {tripLabel.toLowerCase()} request.</p>
        ) : (
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
              {requesting ? "Requesting..." : hasFreshEstimate ? `Request ${tripLabel.toLowerCase()}` : "Estimate to unlock request"}
            </button>
          </div>
        )}
        {estimate && !hasFreshEstimate ? (
          <p className="helper">Trip details changed. Re-estimate fare to refresh price before requesting.</p>
        ) : null}
        {hasInFlightTrip ? (
          <p className="helper">You already have an active or pending {tripLabel.toLowerCase()}. Complete or cancel it before requesting another one.</p>
        ) : null}
        {estimate?.walletSufficient === false && paymentMethod === "WALLET" ? (
          <p className="error-text">Wallet balance is insufficient for this estimated fare. Choose Cash or top up your wallet.</p>
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
              <div className="stack compact" style={{ justifyItems: "end" }}>
                {estimate.originalFare !== undefined && estimate.discountedFare !== undefined && estimate.promoApplied ? (
                  <>
                    <span className="helper" style={{ textDecoration: "line-through" }}>
                      {toCurrency(estimate.originalFare)}
                    </span>
                    <span className="badge">{toCurrency(estimate.discountedFare)}</span>
                    <span className="helper">You save {toCurrency(estimate.savings ?? estimate.discountAmount)}</span>
                  </>
                ) : (
                  <span className="badge">{toCurrency(estimate.estimatedFare)}</span>
                )}
              </div>
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
            <div className="list-item">
              <div>
                <strong>Wallet status</strong>
                <p>Current balance for wallet payments.</p>
              </div>
              <span className="badge">
                {estimate.walletBalance !== undefined && estimate.walletBalance !== null
                  ? toCurrency(estimate.walletBalance)
                  : "—"}
              </span>
            </div>
            {estimate.promoMessage ? (
              <p className={estimate.promoApplied ? "helper" : "error-text"}>{estimate.promoMessage}</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="card stack">
        <strong>Latest {tripLabel.toLowerCase()} request</strong>
        {!lastRequest ? (
          <p className="helper">No {tripLabel.toLowerCase()} request submitted yet.</p>
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
            View {tripLabel.toLowerCase()} history
          </Link>
          <Link href="/scheduled" className="primary-button">
            Manage scheduled rides
          </Link>
        </div>
      </section>
    </main>
  );
}
