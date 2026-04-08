"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestRiderProxy, toCurrency, type DecimalValue } from "../../_lib/rider-client";
import { applyRideUpdateStatus, normalizeRideLifecycleStatus, resolveActiveRidePollingIntervalMs } from "../../_lib/rider-active-ride-state";
import { fetchRoutePath, type MapPoint, type RoutePath } from "../../_lib/map/routing";
import { mapApiError, validateRatingInput } from "../../_lib/ride-forms";
import { getRideStatusLabel } from "../../_lib/rider-home-state";
import { getRiderRealtimeStatusText, useRiderRideUpdatesSubscription, type RiderRideUpdateEvent } from "../../_lib/rider-ws";

const ActiveRideMap = dynamic(
  () => import("./_components/active-ride-map").then((module) => module.ActiveRideMap),
  { ssr: false },
);

type PointDto = {
  coordinates?: [number, number] | number[];
  type?: string;
};

type RiderTrackingPayload = {
  rideId?: number | null;
  rideRequestId?: number | null;
  status?: string | null;
  pickupLocation?: PointDto | null;
  dropOffLocation?: PointDto | null;
  driver?: {
    id?: number;
    name?: string | null;
    vehicleId?: string | null;
    rating?: number | null;
  } | null;
  lastDriverLocation?: {
    lat?: number;
    lng?: number;
    heading?: number | null;
    speedKph?: number | null;
    accuracyM?: number | null;
    capturedAt?: string | null;
  } | null;
  etaMinutes?: number | null;
  routePolyline?: string | null;
  updatedAt?: string | null;
  canCancel?: boolean | null;
};

type RiderRideItem = {
  id: number;
  rideStatus: string;
  fare?: DecimalValue | null;
  fair?: DecimalValue | null;
  endedAt?: string | null;
};

function toMapPoint(point: PointDto | null | undefined): MapPoint | null {
  if (!point || !Array.isArray(point.coordinates) || point.coordinates.length < 2) {
    return null;
  }

  const lng = Number(point.coordinates[0]);
  const lat = Number(point.coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function toDriverPoint(location: RiderTrackingPayload["lastDriverLocation"]): MapPoint | null {
  if (!location) {
    return null;
  }

  const lat = typeof location.lat === "number" ? location.lat : Number(location.lat);
  const lng = typeof location.lng === "number" ? location.lng : Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function toTimeline(progressStatus: string | null | undefined): Array<{ label: string; done: boolean }> {
  const status = normalizeRideLifecycleStatus(progressStatus);
  const order = ["PENDING", "CONFIRMED", "ONGOING", "ENDED"] as const;
  const statusIndex = order.indexOf(status as (typeof order)[number]);

  return [
    { label: "Finding driver", done: statusIndex >= 0 || status === "CANCELLED" },
    { label: "Driver assigned", done: statusIndex >= 1 },
    { label: "Trip in progress", done: statusIndex >= 2 },
    { label: "Trip completed", done: statusIndex >= 3 },
  ];
}

export default function RiderActiveRidePage() {
  const [tracking, setTracking] = useState<RiderTrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<RoutePath | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [ratingValue, setRatingValue] = useState("5");
  const [ratingRide, setRatingRide] = useState<RiderRideItem | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const lifecycleStatus = normalizeRideLifecycleStatus(tracking?.status);

  const pickup = useMemo(() => toMapPoint(tracking?.pickupLocation), [tracking?.pickupLocation]);
  const dropOff = useMemo(() => toMapPoint(tracking?.dropOffLocation), [tracking?.dropOffLocation]);
  const driver = useMemo(() => toDriverPoint(tracking?.lastDriverLocation), [tracking?.lastDriverLocation]);

  const loadRecentEndedRide = useCallback(async (): Promise<void> => {
    try {
      const payload = await requestRiderProxy<{ content?: RiderRideItem[] }>("riders/getMyRides?pageOffset=0&pageSize=10");
      const rides = Array.isArray(payload?.content) ? payload.content : [];
      const latestEnded = rides.find((ride) => ride.rideStatus?.toUpperCase() === "ENDED") ?? null;
      setRatingRide(latestEnded);
    } catch {
      // keep rating fallback optional
    }
  }, []);

  const loadTracking = useCallback(
    async (refresh = false): Promise<void> => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const payload = await requestRiderProxy<RiderTrackingPayload | null>("riders/active-ride");
        setTracking(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? mapApiError({ error: loadError.message }, "Unable to load active ride state.")
            : "Unable to load active ride state.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTracking();
    void loadRecentEndedRide();
  }, [loadRecentEndedRide, loadTracking]);

  useEffect(() => {
    if (!loading && !tracking) {
      void loadRecentEndedRide();
    }
  }, [loading, loadRecentEndedRide, tracking]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadTracking(true);
    }, resolveActiveRidePollingIntervalMs(lifecycleStatus));

    return () => {
      window.clearInterval(interval);
    };
  }, [lifecycleStatus, loadTracking]);

  useEffect(() => {
    if (!pickup || !dropOff) {
      setRoutePath(null);
      return;
    }

    let cancelled = false;
    setLoadingRoute(true);

    void fetchRoutePath(pickup, dropOff)
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
  }, [dropOff, pickup, tracking?.rideId, tracking?.rideRequestId]);

  const handleRideUpdate = useCallback(
    (event: RiderRideUpdateEvent) => {
      const nextStatus = applyRideUpdateStatus(lifecycleStatus, event);
      setTracking((current) => {
        if (!current) {
          return current;
        }

        if (event.rideId && current.rideId && event.rideId !== current.rideId) {
          return current;
        }

        const updated: RiderTrackingPayload = {
          ...current,
          status: nextStatus === "IDLE" ? current.status : nextStatus,
          updatedAt: event.updatedAt ?? current.updatedAt,
        };

        if (event.driverLocation) {
          updated.lastDriverLocation = {
            lat: event.driverLocation.lat,
            lng: event.driverLocation.lng,
            heading: event.driverLocation.heading ?? null,
            speedKph: event.driverLocation.speedKph ?? null,
            accuracyM: event.driverLocation.accuracyM ?? null,
            capturedAt: event.driverLocation.capturedAt ?? null,
          };
        }

        return updated;
      });

      if (event.eventType === "RIDE_COMPLETED") {
        setMessage("Ride completed. Please rate your driver.");
        void loadRecentEndedRide();
      } else if (event.eventType === "RIDE_CANCELLED") {
        setMessage("Ride cancelled.");
      }

      void loadTracking(true);
    },
    [lifecycleStatus, loadRecentEndedRide, loadTracking],
  );

  const realtime = useRiderRideUpdatesSubscription(true, handleRideUpdate);

  async function cancelRide(): Promise<void> {
    if (!tracking?.rideId || lifecycleStatus !== "CONFIRMED") {
      return;
    }

    setSubmittingCancel(true);
    setError(null);
    setMessage(null);

    try {
      await requestRiderProxy(`riders/cancelRide/${tracking.rideId}`, { method: "POST" });
      setMessage(`Ride #${tracking.rideId} cancelled.`);
      await loadTracking(true);
      await loadRecentEndedRide();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? mapApiError({ error: cancelError.message }, "Unable to cancel active ride.")
          : "Unable to cancel active ride.",
      );
    } finally {
      setSubmittingCancel(false);
    }
  }

  async function submitRating(): Promise<void> {
    if (!ratingRide) {
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
      await requestRiderProxy("riders/rateDriver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: ratingRide.id,
          rating: validation.rating,
        }),
      });
      setMessage(`Rated ride #${ratingRide.id} with ${validation.rating} star${validation.rating === 1 ? "" : "s"}.`);
      await loadRecentEndedRide();
    } catch (ratingError) {
      setError(
        ratingError instanceof Error
          ? mapApiError({ error: ratingError.message }, "Unable to submit rating.")
          : "Unable to submit rating.",
      );
    } finally {
      setSubmittingRating(false);
    }
  }

  const timeline = toTimeline(tracking?.status);
  const realtimeText = getRiderRealtimeStatusText(realtime.state, realtime.reconnectAttempts);
  const statusLabel = tracking?.status ? getRideStatusLabel(tracking.status) : "No active ride";
  const canCancel = Boolean(tracking?.rideId && tracking.canCancel && lifecycleStatus === "CONFIRMED");
  const fareValue = ratingRide?.fare ?? ratingRide?.fair ?? null;

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Active Trip</p>
        <h1>Live trip continuity</h1>
        <p>Stay on this screen for real-time updates, fallback refreshes, and completion prompts.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <div className="stack compact">
            <strong>{statusLabel}</strong>
            {lifecycleStatus === "PENDING" ? (
              <p className="finding-driver-indicator">
                Finding driver
                <span className="dot one">.</span>
                <span className="dot two">.</span>
                <span className="dot three">.</span>
              </p>
            ) : (
              <p className="helper">{tracking?.updatedAt ? `Updated ${formatDateTime(tracking.updatedAt)}` : "Waiting for updates."}</p>
            )}
            <p className={realtime.state === "error" ? "error-text" : "helper"}>{realtimeText}</p>
            {realtime.lastError ? <p className="helper">{realtime.lastError}</p> : null}
          </div>
          <button className="secondary-button" type="button" disabled={refreshing} onClick={() => void loadTracking(true)}>
            {refreshing ? "Refreshing..." : "Refresh now"}
          </button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
        {loading ? <p className="helper">Loading active ride...</p> : null}

        {!loading && !tracking ? (
          <div className="stack compact">
            <p className="helper">No active trip right now.</p>
            <Link className="secondary-button" href="/">
              Go to booking
            </Link>
          </div>
        ) : null}

        {!loading && tracking ? (
          <>
            <div className="timeline">
              {timeline.map((step) => (
                <div key={step.label} className="timeline-item">
                  <span className={`timeline-dot ${step.done ? "done" : ""}`} />
                  <p>{step.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-2">
              <article className="card stack compact">
                <strong>Trip details</strong>
                <p className="helper">Ride #{tracking.rideId ?? "—"} • Request #{tracking.rideRequestId ?? "—"}</p>
                <p className="helper">Driver: {tracking.driver?.name ?? "Pending assignment"}</p>
                <p className="helper">Vehicle: {tracking.driver?.vehicleId ?? "—"}</p>
                <p className="helper">ETA: {typeof tracking.etaMinutes === "number" ? `${tracking.etaMinutes} min` : "—"}</p>
                {canCancel ? (
                  <button className="secondary-button" type="button" disabled={submittingCancel} onClick={() => void cancelRide()}>
                    {submittingCancel ? "Cancelling..." : "Cancel trip"}
                  </button>
                ) : null}
              </article>

              <article className="card stack compact">
                <strong>Driver telemetry</strong>
                <p className="helper">
                  Driver location:{" "}
                  {tracking.lastDriverLocation?.lat && tracking.lastDriverLocation?.lng
                    ? `${tracking.lastDriverLocation.lat.toFixed(5)}, ${tracking.lastDriverLocation.lng.toFixed(5)}`
                    : "Waiting for location"}
                </p>
                <p className="helper">
                  Speed:{" "}
                  {typeof tracking.lastDriverLocation?.speedKph === "number"
                    ? `${tracking.lastDriverLocation.speedKph.toFixed(1)} km/h`
                    : "—"}
                </p>
                <p className="helper">Captured: {formatDateTime(tracking.lastDriverLocation?.capturedAt ?? null)}</p>
              </article>
            </div>

            {pickup && dropOff ? (
              <div className="stack compact">
                <strong>Route map</strong>
                <p className="helper">{loadingRoute ? "Loading route..." : "Route uses OSRM with fallback when unavailable."}</p>
                <ActiveRideMap pickup={pickup} dropOff={dropOff} driver={driver} routePoints={routePath?.points ?? []} />
              </div>
            ) : (
              <p className="helper">Map appears once pickup and drop-off coordinates are available.</p>
            )}
          </>
        ) : null}
      </section>

      {!tracking && ratingRide ? (
        <section className="card stack">
          <strong>Rate your latest ride</strong>
          <p className="helper">
            Ride #{ratingRide.id} ended {formatDateTime(ratingRide.endedAt ?? null)} • {toCurrency(fareValue)}
          </p>
          <div className="actions">
            <label className="field-inline">
              <span>Rating</span>
              <select value={ratingValue} disabled={submittingRating} onChange={(event) => setRatingValue(event.target.value)}>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </label>
            <button className="primary-button" type="button" disabled={submittingRating} onClick={() => void submitRating()}>
              {submittingRating ? "Submitting..." : "Submit rating"}
            </button>
            <Link className="secondary-button" href="/rides">
              Open ride history
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
