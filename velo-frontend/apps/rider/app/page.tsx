"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CountdownBadge, MatchingIndicator, ReconnectingIndicator } from "@velo/ui/feedback";
import { formatDateTime } from "@velo/app-core/formatters";
import {
  requestRiderProxy,
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
  shouldShowTripBanner,
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
import { rememberWalletBalance } from "./_lib/wallet-balance";
import {
  DefinitionList,
  ErrorState,
  Field,
  Money,
  RouteStrip,
  Select,
  Sheet,
  Skeleton,
  StatusBadge,
  ConfirmDialog,
} from "@velo/ui";
import { Button } from "@velo/ui/primitives";

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

  const [bookingOpen, setBookingOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

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
      setBookingOpen(true);
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
              ? mapApiError({ error: failedResult.reason.message }, "Couldn't check your current trip.")
              : "Couldn't check your current trip.",
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
      const syncLabel = Number.isNaN(syncedAt.getTime()) ? "recently" : formatDateTime(syncedAt);
      return `Trip status updated ${syncLabel}.`;
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
      rememberWalletBalance(response.walletBalance);
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
      setMessage(`${tripLabel} cancelled. Request a new ${tripLabel.toLowerCase()} when ready.`);
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
      <main className="app-shell rider-page">
        <ErrorState
          title={`${riderLabel} booking is unavailable`}
          description="This service is not available for this account. Contact the operations team for help."
          retryLabel="Check again"
          onRetry={() => window.location.reload()}
        />
      </main>
    );
  }

  return (
    <main className="booking-page">
      <div className="booking-map-stage">
        <BookingMapLoader
          pickup={pickupPoint}
          dropOff={dropOffPoint}
          routePoints={routePath?.points ?? []}
          activeTarget={activeTarget}
          onPointSelected={handleMapPointSelected}
        />
        <div className="booking-map-toolbar">
          <div className="booking-selection-control" role="group" aria-label="Choose a map location">
            <button
              className={activeTarget === "pickup" ? "map-target is-active" : "map-target"}
              type="button"
              aria-pressed={activeTarget === "pickup"}
              onClick={() => setActiveTarget("pickup")}
            >
              Pickup
            </button>
            <button
              className={activeTarget === "dropoff" ? "map-target is-active" : "map-target"}
              type="button"
              aria-pressed={activeTarget === "dropoff"}
              onClick={() => setActiveTarget("dropoff")}
            >
              Where to?
            </button>
          </div>
          <Button variant="secondary" onClick={() => setBookingOpen(true)}>Plan a trip</Button>
        </div>
        <p className="map-instruction" aria-live="polite">
          {loadingRoute ? "Updating route" : routePath ? "Route ready" : `Tap the map to set ${activeTarget === "pickup" ? "pickup" : "destination"}`}
        </p>
      </div>

      <div className="booking-overlay-content">
        {loadingTripLane ? (
          <div className="trip-banner-skeleton" aria-label="Checking for an active trip">
            <Skeleton className="skeleton-line skeleton-line-wide" />
            <Skeleton className="skeleton-line" />
          </div>
        ) : tripLaneError ? (
          <ErrorState
            className="trip-banner-error"
            title="Couldn't check your current trip"
            description="Refresh to check for a trip in progress."
            onRetry={() => void loadTripLane(true)}
          />
        ) : shouldShowTripBanner(tripLane) ? (
          <section className="trip-banner" aria-label="Trip status">
            <div className="trip-banner-copy">
              <StatusBadge
                domain={tripLane.ride ? "ride" : "request"}
                status={tripLane.ride?.rideStatus ?? lastRequest?.rideRequestStatus ?? "PENDING"}
              />
              <strong>{tripLane.ride ? "Your trip is underway" : "Finding a driver nearby"}</strong>
              {realtime.state !== "error" && realtime.state !== "reconnecting" ? <p>{tripLaneSyncMessage}</p> : null}
              <ReconnectingIndicator
                state={realtime.state}
                attempts={realtime.reconnectAttempts}
                onRetry={() => void loadTripLane(true)}
                retrying={refreshingTripLane}
                className="trip-banner-realtime"
              />
              {tripLane.ride ? <Money className="trip-banner-fare" amount={getRideFareValue(tripLane.ride)} /> : null}
              {tripLane.ride ? (
                <RouteStrip stage={tripLane.ride.rideStatus} variant="static" />
              ) : (
                <div className="trip-matching-row">
                  <MatchingIndicator label={`Matching you with a nearby ${driverLabel.toLowerCase()}`} expiresAtMs={pendingRequestExpiresAtMs} />
                  <CountdownBadge expiresAtMs={pendingRequestExpiresAtMs} prefix="Request expires in" />
                </div>
              )}
            </div>
            <div className="trip-banner-actions">
              <Link className="ui-button" data-variant="secondary" href={tripLane.ride ? "/ride/active" : "/rides"}>
                View trip
              </Link>
              {tripLane.ride && isRideCancelableFromTripLane(tripLane.ride.rideStatus) ? (
                <Button variant="ghost" disabled={cancelingRideId !== null} onClick={() => setCancelDialogOpen(true)}>
                  Cancel trip
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
        {message ? <p className="booking-feedback" role="status">{message}</p> : null}
      </div>

      {!bookingOpen ? (
        <button className="booking-sheet-launcher" type="button" onClick={() => setBookingOpen(true)}>
          <span className="booking-peek-locations">
            <span className="booking-peek-location"><span>Pickup</span><strong>{pickupPoint ? "Selected" : "Choose location"}</strong></span>
            <span className="booking-peek-location"><span>Destination</span><strong>{dropOffPoint ? "Selected" : "Where to?"}</strong></span>
          </span>
          <span className="booking-peek-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
          </span>
        </button>
      ) : null}

      <Sheet
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        side="bottom"
        title={`Plan a ${tripLabel.toLowerCase()}`}
        description="Choose locations on the map, then review your fare."
      >
        <div className="stack booking-form">
          <div className="booking-location-row">
            <div className="booking-location-summary">
              <span className="location-dot" aria-hidden="true" />
              <div>
                <strong>Pickup</strong>
                <p>{pickupPoint ? "Location selected" : "Choose a point on the map"}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setActiveTarget("pickup"); setBookingOpen(false); }}>
                Choose on map
              </Button>
            </div>
            <div className="booking-location-summary">
              <span className="location-dot destination" aria-hidden="true" />
              <div>
                <strong>Where to?</strong>
                <p>{dropOffPoint ? "Destination selected" : "Choose a point on the map"}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setActiveTarget("dropoff"); setBookingOpen(false); }}>
                Choose on map
              </Button>
            </div>
          </div>

          <div className="cluster">
            <Button variant="secondary" loading={resolvingPickupLocation} disabled={estimating || requesting} onClick={() => void setPickupToCurrentLocation()}>
              Use current location
            </Button>
            <Button variant="ghost" disabled={estimating || requesting} onClick={clearLocations}>Clear locations</Button>
          </div>

          <div className="booking-compact-fields">
            <Field label="Payment">
              <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="WALLET">Wallet</option>
                <option value="CASH">Cash</option>
                <option value="CARD" disabled>Card (coming soon)</option>
                <option value="UPI" disabled>UPI (coming soon)</option>
              </Select>
            </Field>
            <Field label="Promo code" hint="Optional">
              <input value={promoCode} autoComplete="off" placeholder="Enter a code" onChange={(event) => setPromoCode(event.target.value)} />
            </Field>
          </div>

          <details className="advanced-fields">
            <summary>Enter coordinates</summary>
            <div className="grid grid-2">
              <Field label="Pickup latitude"><input value={pickupLat} onChange={(event) => setPickupLat(event.target.value)} /></Field>
              <Field label="Pickup longitude"><input value={pickupLng} onChange={(event) => setPickupLng(event.target.value)} /></Field>
              <Field label="Destination latitude"><input value={dropLat} onChange={(event) => setDropLat(event.target.value)} /></Field>
              <Field label="Destination longitude"><input value={dropLng} onChange={(event) => setDropLng(event.target.value)} /></Field>
            </div>
          </details>

          {estimate ? (
            <div className="fare-summary" aria-live="polite">
              <div className="fare-summary-total">
                <div>
                  <span className="helper">Estimated fare</span>
                  {estimate.promoApplied && estimate.originalFare !== undefined ? (
                    <span className="helper fare-original"><Money amount={estimate.originalFare} /></span>
                  ) : null}
                </div>
                <Money amount={estimate.discountedFare ?? estimate.estimatedFare} emphasis />
              </div>
              <DefinitionList items={[
                { label: "Distance", value: `${estimate.distanceKm} km` },
                { label: "Estimated time", value: `${estimate.durationMinutes} min` },
                { label: "Base fare", value: <Money amount={estimate.baseFare} /> },
                ...(estimate.discountAmount ? [{ label: "Discount", value: <Money amount={estimate.discountAmount} /> }] : []),
              ]} />
              {estimate.promoMessage ? <p className={estimate.promoApplied ? "helper" : "error-text"} role={estimate.promoApplied ? undefined : "alert"}>{estimate.promoMessage}</p> : null}
            </div>
          ) : null}

          {estimate?.walletSufficient === false && paymentMethod === "WALLET" ? (
            <p className="error-text" role="alert">Your wallet balance is too low for this fare. Choose cash or check your wallet.</p>
          ) : null}
          {error ? (
            <ErrorState
              title={error}
              retryLabel={failedAction === "estimate" ? "Retry fare estimate" : failedAction === "request" ? "Retry trip request" : "Retry location"}
              onRetry={() => void (failedAction ? retryLastAction() : setPickupToCurrentLocation())}
            />
          ) : null}

          {!hasSelectedLocations ? <p className="helper">Choose a pickup and destination on the map to estimate your fare.</p> : null}
          {estimate && !hasFreshEstimate ? <p className="helper">Trip details changed. Update the estimate before you request.</p> : null}
          {hasInFlightTrip ? <p className="helper">Finish or cancel your current trip before requesting another.</p> : null}

          <Button variant="secondary" loading={estimating} disabled={!canEstimate} onClick={() => void estimateFare()}>
            {estimate && !hasFreshEstimate ? "Update estimate" : "Estimate fare"}
          </Button>
          <Button loading={requesting} disabled={!canRequest} onClick={() => void requestRide()}>
            Request trip
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel this trip?"
        description="Your driver will be notified that the trip is cancelled."
        confirmLabel="Cancel trip"
        onConfirm={cancelActiveRide}
      />
    </main>
  );
}
