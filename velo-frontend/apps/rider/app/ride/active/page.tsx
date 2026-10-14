"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestRiderProxy, type DecimalValue } from "../../_lib/rider-client";
import { applyRideUpdateStatus, normalizeRideLifecycleStatus, resolveActiveRidePollingIntervalMs } from "../../_lib/rider-active-ride-state";
import { fetchRoutePath, type MapPoint, type RoutePath } from "../../_lib/map/routing";
import { mapApiError, validateRatingInput } from "../../_lib/ride-forms";
import { useRiderRideUpdatesSubscription, type RiderRideUpdateEvent } from "../../_lib/rider-ws";
import { ReconnectingIndicator } from "@velo/ui/feedback";
import {
  Button,
  DateTime,
  DefinitionList,
  EmptyState,
  ErrorState,
  Money,
  PageHeader,
  RouteStrip,
  Section,
  Select,
  Skeleton,
  StatusBadge,
  ConfirmDialog,
} from "@velo/ui";

const ActiveRideMap = dynamic(
  () => import("./_components/active-ride-map").then((module) => module.ActiveRideMap),
  { ssr: false, loading: () => <Skeleton className="active-map-skeleton" aria-label="Loading live map" /> },
);

type PointDto = {
  coordinates?: [number, number] | number[];
  type?: string;
};

type RiderTrackingPayload = {
  rideId?: number | null;
  rideRequestId?: number | null;
  status?: string | null;
  otp?: string | null;
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
  paymentMethod?: string | null;
  endedAt?: string | null;
};

type TenantBranding = {
  riderLabel?: string;
  driverLabel?: string;
  tripLabel?: string;
  primaryColor?: string;
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

export default function RiderActiveRidePage() {
  const [tracking, setTracking] = useState<RiderTrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<"cancel" | "end" | "rate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<RoutePath | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [ratingValue, setRatingValue] = useState("5");
  const [ratingRide, setRatingRide] = useState<RiderRideItem | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [submittingEndTrip, setSubmittingEndTrip] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  const lifecycleStatus = normalizeRideLifecycleStatus(tracking?.status);
  const driverLabel = branding?.driverLabel ?? "Driver";

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
      setActionError(null);
      setRetryAction(null);

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
    void requestRiderProxy<TenantBranding>("api/v1/tenant/branding")
      .then((payload) => setBranding(payload))
      .catch(() => setBranding(null));
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
    setActionError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      await requestRiderProxy(`riders/cancelRide/${tracking.rideId}`, { method: "POST" });
      setMessage("Trip cancelled.");
      await loadTracking(true);
      await loadRecentEndedRide();
    } catch (cancelError) {
      setActionError(
        cancelError instanceof Error
          ? mapApiError({ error: cancelError.message }, "Unable to cancel active ride.")
          : "Unable to cancel active ride.",
      );
      setRetryAction("cancel");
    } finally {
      setSubmittingCancel(false);
    }
  }

  async function endRide(): Promise<void> {
    if (!tracking?.rideId || lifecycleStatus !== "ONGOING") {
      return;
    }

    setSubmittingEndTrip(true);
    setError(null);
    setActionError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      await requestRiderProxy(`riders/endRide/${tracking.rideId}`, { method: "POST" });
      setMessage("Trip completed.");
      await loadTracking(true);
      await loadRecentEndedRide();
    } catch (endError) {
      setActionError(
        endError instanceof Error
          ? mapApiError({ error: endError.message }, "Unable to end this trip.")
          : "Unable to end this trip.",
      );
      setRetryAction("end");
    } finally {
      setSubmittingEndTrip(false);
    }
  }

  async function submitRating(): Promise<void> {
    if (!ratingRide) {
      return;
    }

    const validation = validateRatingInput(ratingValue);
    if (!validation.ok) {
      setActionError(validation.error);
      setRetryAction("rate");
      return;
    }

    setSubmittingRating(true);
    setError(null);
    setActionError(null);
    setRetryAction(null);
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
      setMessage("Thanks for rating your driver.");
      await loadRecentEndedRide();
    } catch (ratingError) {
      setActionError(
        ratingError instanceof Error
          ? mapApiError({ error: ratingError.message }, "Unable to submit rating.")
          : "Unable to submit rating.",
      );
      setRetryAction("rate");
    } finally {
      setSubmittingRating(false);
    }
  }

  const statusHeadline = lifecycleStatus === "PENDING"
    ? "Finding a driver"
    : lifecycleStatus === "CONFIRMED"
      ? typeof tracking?.etaMinutes === "number" ? `Driver arriving in ${tracking.etaMinutes} min` : "Driver assigned"
      : lifecycleStatus === "ONGOING"
        ? "Your trip is in progress"
        : lifecycleStatus === "ENDED"
          ? "Trip complete"
          : lifecycleStatus === "CANCELLED"
            ? "Trip cancelled"
            : "Your trip";
  const canCancel = Boolean(tracking?.rideId && tracking.canCancel && lifecycleStatus === "CONFIRMED");
  const fareValue = ratingRide?.fare ?? ratingRide?.fair ?? null;

  return (
    <main className="app-shell rider-page stack">
      <PageHeader title="Your trip" description="Follow your driver and see the latest trip updates." />

      {error ? (
        <ErrorState
          title="Couldn't refresh trip details"
          description="Check your connection, then retry to get the latest trip status."
          onRetry={() => void loadTracking(true)}
        />
      ) : null}
      {!error && actionError ? (
        <ErrorState
          title={actionError}
          retryLabel="Retry"
          onRetry={() => {
            if (retryAction === "cancel") setCancelDialogOpen(true);
            else if (retryAction === "end") setEndDialogOpen(true);
            else if (retryAction === "rate") void submitRating();
          }}
        />
      ) : null}

      {!error && tracking ? (
        <ReconnectingIndicator
          state={realtime.state}
          attempts={realtime.reconnectAttempts}
          message="Live updates paused. Trip details refresh automatically."
          retryLabel="Refresh trip"
          retrying={refreshing}
          onRetry={() => void loadTracking(true)}
        />
      ) : null}

      {loading ? (
        <Section title="Loading your trip">
          <div className="stack" aria-label="Loading trip details">
            <Skeleton className="skeleton-line skeleton-line-wide" />
            <Skeleton className="skeleton-card" />
            <Skeleton className="active-map-skeleton" />
          </div>
        </Section>
      ) : null}

      {!loading && !error && tracking ? (
        <>
          <Section className="active-trip-hero">
            <div className="active-trip-status-row">
              <StatusBadge status={tracking.status} domain="ride" />
              {tracking.updatedAt ? <span className="helper">Updated <DateTime value={tracking.updatedAt} /></span> : null}
            </div>
            <h2 className="active-trip-headline">{statusHeadline}</h2>
            <RouteStrip stage={tracking.status ?? "PENDING"} />
            {message ? <p className="booking-feedback" role="status">{message}</p> : null}
          </Section>

          {lifecycleStatus === "CONFIRMED" && tracking.otp ? (
            <Section title="Start your trip">
              <p className="helper">Share this code with your driver when you meet.</p>
              <code className="trip-otp">{tracking.otp}</code>
            </Section>
          ) : null}

          <Section title={driverLabel}>
            {tracking.driver ? (
              <DefinitionList items={[
                { label: "Name", value: tracking.driver.name || "Driver assigned" },
                ...(tracking.driver.vehicleId ? [{ label: "Vehicle plate", value: tracking.driver.vehicleId }] : []),
                ...(typeof tracking.driver.rating === "number" ? [{ label: "Rating", value: `${tracking.driver.rating.toFixed(1)} out of 5` }] : []),
              ]} />
            ) : <p className="helper">We’ll show your driver details when someone accepts your trip.</p>}
          </Section>

          <Section title="Live map">
            {loadingRoute ? <p className="helper">Updating route…</p> : null}
            {pickup && dropOff ? (
              <ActiveRideMap pickup={pickup} dropOff={dropOff} driver={driver} routePoints={routePath?.points ?? []} />
            ) : (
              <EmptyState
                title="Map details are not ready yet"
                description="Refresh the trip to check for updated pickup and destination details."
                action={<Button variant="secondary" loading={refreshing} onClick={() => void loadTracking(true)}>Refresh trip</Button>}
              />
            )}
          </Section>

          <div className="active-trip-actions">
            {canCancel ? (
              <Button variant="danger" disabled={submittingCancel} onClick={() => setCancelDialogOpen(true)}>
                Cancel trip
              </Button>
            ) : null}
            {lifecycleStatus === "ONGOING" ? (
              <Button variant="secondary" loading={submittingEndTrip} onClick={() => setEndDialogOpen(true)}>
                End trip
              </Button>
            ) : null}
            <Button variant="secondary" loading={refreshing} onClick={() => void loadTracking(true)}>
              Refresh
            </Button>
          </div>
        </>
      ) : null}

      {!loading && !error && !tracking ? (
        <>
          <EmptyState
            title="No active trip"
            description="Book a trip when you’re ready. Your recent completed trip is shown below for rating."
            action={<a className="ui-button" data-variant="primary" href="/">Book a trip</a>}
          />
          {ratingRide ? (
            <Section title="Rate your last trip">
              <div className="completed-trip-summary">
                <div>
                  <StatusBadge status="ENDED" domain="ride" />
                  <p className="helper">{ratingRide.endedAt ? <DateTime value={ratingRide.endedAt} /> : "Completed trip"}</p>
                </div>
                <Money amount={fareValue} />
              </div>
              <div className="rating-form">
                <label className="ui-field">
                  <span className="ui-field-label">Your rating</span>
                  <Select value={ratingValue} disabled={submittingRating} onChange={(event) => setRatingValue(event.target.value)}>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </Select>
                </label>
                <Button loading={submittingRating} onClick={() => void submitRating()}>Submit rating</Button>
              </div>
              {message ? <p className="booking-feedback" role="status">{message}</p> : null}
            </Section>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel this trip?"
        description="Your driver will be notified that the trip is cancelled."
        confirmLabel="Cancel trip"
        onConfirm={cancelRide}
      />
      <ConfirmDialog
        open={endDialogOpen}
        onOpenChange={setEndDialogOpen}
        title="End this trip?"
        description="This will mark the current trip as complete."
        confirmLabel="End trip"
        destructive={false}
        onConfirm={endRide}
      />
    </main>
  );
}
