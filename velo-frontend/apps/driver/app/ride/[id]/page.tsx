"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@velo/ui/primitives";
import { ConfirmDialog, DateTime, EmptyState, ErrorState, Field, Money, PageHeader, RouteStrip, Section, Select, StatusBadge } from "@velo/ui/composed";
import { requestDriverProxy, type DriverRide, type SpringPage } from "../../_lib/driver-client";
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
import { normalizeDriverRidePage, toMapPoint, getDriverRideFareValue } from "../../_lib/driver-ride-state";
import { fetchRoutePath, type RoutePath } from "../../_lib/map/routing";
import { getDriverRealtimeStatusText, useDriverNotificationSubscription, type DriverNotificationEvent } from "../../_lib/driver-ws";
import { DriverRideMapLoader } from "./_components/driver-ride-map-loader";

const ACTIVE_RIDE_REFRESH_INTERVAL_MS = 10_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 30_000;

function getPaymentMethodLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = { CASH: "Cash", WALLET: "Wallet", CARD: "Card" };
  if (!value) return "Not provided";
  return labels[value.toUpperCase()] ?? value.toLowerCase().replace(/[_-]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function getNavigationUrl(point: { lat: number; lng: number } | null): string | null {
  if (!point) return null;
  const destination = `${point.lat},${point.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [routePath, setRoutePath] = useState<RoutePath | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const loadRide = useCallback(async (refresh = false): Promise<void> => {
    if (!Number.isFinite(rideId) || rideId <= 0) {
      setNotFound(true);
      setLoadError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    setNotFound(false);

    try {
      const page = await requestDriverProxy<SpringPage<DriverRide>>("drivers/getMyRides?pageOffset=0&pageSize=50");
      const selectedRide = normalizeDriverRidePage(page).find((item) => item.id === rideId) ?? null;
      setNotFound(!selectedRide);
      setRide(selectedRide);
    } catch (loadErrorValue) {
      setLoadError(loadErrorValue instanceof Error ? loadErrorValue.message : "Unable to load trip details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rideId]);

  useEffect(() => {
    void loadRide();
  }, [loadRide]);

  const status = ride?.rideStatus ?? null;
  const locationPublisher = useDriverLocationPublisher(status);
  const pickupPoint = useMemo(() => toMapPoint(ride?.pickupLocation), [ride?.pickupLocation]);
  const dropOffPoint = useMemo(() => toMapPoint(ride?.dropOffLocation), [ride?.dropOffLocation]);
  const driverPoint = locationPublisher.lastPublishedPoint;

  useEffect(() => {
    if (!pickupPoint || !dropOffPoint) {
      setRoutePath(null);
      return;
    }
    let cancelled = false;
    setLoadingRoute(true);
    void fetchRoutePath(pickupPoint, dropOffPoint)
      .then((nextRoute) => { if (!cancelled) setRoutePath(nextRoute); })
      .finally(() => { if (!cancelled) setLoadingRoute(false); });
    return () => { cancelled = true; };
  }, [dropOffPoint, pickupPoint, ride?.id]);

  const handleRealtimeNotification = useCallback((event: DriverNotificationEvent) => {
    if (event.type?.toUpperCase().startsWith("RIDE_")) void loadRide(true);
  }, [loadRide]);
  const realtime = useDriverNotificationSubscription(true, handleRealtimeNotification);

  useEffect(() => {
    if (!Number.isFinite(rideId) || rideId <= 0) return;
    const interval = isActiveStatus(status) ? ACTIVE_RIDE_REFRESH_INTERVAL_MS : BACKGROUND_REFRESH_INTERVAL_MS;
    const intervalId = window.setInterval(() => { void loadRide(true); }, interval);
    return () => window.clearInterval(intervalId);
  }, [loadRide, rideId, status]);

  const ratingAlreadySubmitted = ratedRideId === ride?.id;
  const otpRequired = Boolean(ride?.rider);
  const canEnterStartDetails = status === "CONFIRMED" && pendingAction === null;
  const canStart = canSubmitStartRide(status, otp, pendingAction !== null, otpRequired);
  const canEnd = canSubmitEndRide(status, pendingAction !== null);
  const canCancel = canSubmitCancelRide(status, pendingAction !== null);
  const canRate = Boolean(ride?.rider) && canSubmitRateRider(status, ratingValue, pendingAction !== null || submittingRating, ratingAlreadySubmitted);
  const navigationPoint = status === "ONGOING" ? dropOffPoint : pickupPoint;
  const navigationUrl = getNavigationUrl(navigationPoint);

  async function startRide(): Promise<void> {
    if (!ride) return;
    const otpValidation = otpRequired ? validateOtpInput(otp) : { ok: true as const, value: "" };
    if (!otpValidation.ok) {
      setActionError(otpValidation.error);
      return;
    }
    setPendingAction("START");
    setActionError(null);
    setRetryAction(null);
    setMessage(null);
    try {
      const updated = await requestDriverProxy<DriverRide>(`drivers/startRide/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpValidation.value }),
      });
      setRide(updated);
      setMessage("Trip started.");
    } catch (actionErrorValue) {
      setActionError(actionErrorValue instanceof Error ? mapApiError({ error: actionErrorValue.message }, "Unable to start trip.") : "Unable to start trip.");
      setRetryAction(() => () => { void startRide(); });
    } finally {
      setPendingAction(null);
    }
  }

  async function endRide(): Promise<void> {
    if (!ride) return;
    setPendingAction("END");
    setActionError(null);
    setRetryAction(null);
    setMessage(null);
    try {
      const updated = await requestDriverProxy<DriverRide>(`drivers/endRide/${ride.id}`, { method: "POST" });
      setRide(updated);
      setMessage(ride.rider ? "Trip completed. Please rate the rider." : "Trip completed.");
    } catch (actionErrorValue) {
      setActionError(actionErrorValue instanceof Error ? mapApiError({ error: actionErrorValue.message }, "Unable to complete trip.") : "Unable to complete trip.");
      setRetryAction(() => () => { void endRide(); });
    } finally {
      setPendingAction(null);
    }
  }

  async function cancelRide(): Promise<void> {
    if (!ride) return;
    setPendingAction("CANCEL");
    setActionError(null);
    setRetryAction(null);
    setMessage(null);
    try {
      const updated = await requestDriverProxy<DriverRide>(`drivers/cancelRide/${ride.id}`, { method: "POST" });
      setRide(updated);
      setMessage("Trip cancelled.");
    } catch (actionErrorValue) {
      setActionError(actionErrorValue instanceof Error ? mapApiError({ error: actionErrorValue.message }, "Unable to cancel trip.") : "Unable to cancel trip.");
      setRetryAction(() => () => { void cancelRide(); });
    } finally {
      setPendingAction(null);
    }
  }

  async function rateRider(): Promise<void> {
    if (!ride) return;
    const validation = validateRatingInput(ratingValue);
    if (!validation.ok) {
      setActionError(validation.error);
      return;
    }
    setSubmittingRating(true);
    setActionError(null);
    setRetryAction(null);
    setMessage(null);
    try {
      await requestDriverProxy("drivers/rateRider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: ride.id, rating: validation.value }),
      });
      setRatedRideId(ride.id);
      setMessage("Rider rating submitted.");
    } catch (ratingError) {
      setActionError(ratingError instanceof Error ? mapApiError({ error: ratingError.message }, "Unable to submit rider rating.") : "Unable to submit rider rating.");
      setRetryAction(() => () => { void rateRider(); });
    } finally {
      setSubmittingRating(false);
    }
  }

  return (
    <main className="stack">
      <PageHeader title="Trip details" description="Follow the route and complete the next action when you’re ready." />

      {actionError ? (
        <ErrorState
          title="Couldn't update this trip"
          description={actionError}
          onRetry={retryAction ?? (() => void loadRide(true))}
          retryLabel={retryAction ? "Retry action" : "Refresh trip"}
        />
      ) : null}
      {message ? <p role="status" className="helper">{message}</p> : null}

      {loading ? (
        <Section title="Loading trip">
          <div className="stack compact" role="status" aria-label="Loading trip details" aria-busy="true">
            <div className="h-5 w-32 animate-pulse rounded-md bg-[hsl(var(--color-surface-hover))]" />
            <div className="h-14 w-full animate-pulse rounded-md bg-[hsl(var(--color-surface-hover))]" />
            <div className="h-64 w-full animate-pulse rounded-md bg-[hsl(var(--color-surface-hover))]" />
          </div>
        </Section>
      ) : null}
      {!loading && !ride && loadError ? (
        <ErrorState title="Couldn't load this trip" description={loadError} onRetry={() => void loadRide()} />
      ) : null}
      {!loading && !ride && !loadError ? (
        <EmptyState title={notFound ? "Trip unavailable" : "No trip selected"} description={notFound ? "This trip isn’t in your recent history." : "Open a trip from your history to see its details."} action={<Link href="/rides" className="ui-button" data-variant="secondary">Back to trips</Link>} />
      ) : null}

      {!loading && ride ? (
        <>
          <Section title="Trip progress" actions={<Button variant="secondary" disabled={refreshing} onClick={() => void loadRide(true)}>{refreshing ? "Refreshing…" : "Refresh"}</Button>}>
            <div className="driver-trip-summary">
              <div className="driver-row-meta">
                <code className="driver-reference">Trip {ride.id}</code>
                <StatusBadge domain="ride" status={ride.rideStatus} />
                <DateTime value={ride.startedAt ?? ride.createdTime ?? ride.endedAt} />
              </div>
              <RouteStrip stage={status ?? "requested"} />
              <dl className="driver-money-breakdown">
                <div><dt>Rider</dt><dd>{ride.rider?.user?.name ?? "Dispatch rider"}</dd></div>
                <div><dt>Fare</dt><dd><Money amount={getDriverRideFareValue(ride)} emphasis /></dd></div>
                <div><dt>Payment</dt><dd>{getPaymentMethodLabel(ride.paymentMethod)}</dd></div>
                {ride.promoCode ? <div><dt>Promotion</dt><dd>{ride.promoCode}</dd></div> : null}
              </dl>
              <div className="driver-map-actions">
                {navigationUrl ? <a className="ui-button" data-variant="secondary" href={navigationUrl} target="_blank" rel="noreferrer">Navigate to {status === "ONGOING" ? "drop-off" : "pickup"}</a> : null}
                {ride.rider?.user?.phoneNumber ? <a className="ui-button" data-variant="secondary" href={`tel:${ride.rider.user.phoneNumber}`}>Call rider</a> : null}
                {loadingRoute ? <span className="helper" role="status">Updating route…</span> : null}
              </div>
            </div>
          </Section>

          <Section title="Live map">
            {realtime.state === "error" ? (
              <ErrorState
                title="Live updates are paused"
                description={`${getDriverRealtimeStatusText(realtime.state, realtime.reconnectAttempts)} Trip details will refresh automatically.`}
                onRetry={() => void loadRide(true)}
                retryLabel="Refresh trip"
              />
            ) : null}
            {locationPublisher.mode === "degraded" ? (
              <p className="driver-error-text" role="alert">{locationPublisher.message}</p>
            ) : <p className="helper">{locationPublisher.message}</p>}
            <DriverRideMapLoader pickup={pickupPoint} dropOff={dropOffPoint} driver={driverPoint} routePoints={routePath?.points ?? []} />
          </Section>

          <Section title="Next action">
            {canEnterStartDetails && otpRequired ? (
              <Field label="Rider OTP" hint="Enter the 4-digit code from the rider to start the trip.">
                <input
                  className="ui-control driver-otp-input"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="••••"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="4-digit rider OTP"
                  maxLength={4}
                />
              </Field>
            ) : null}
            {canEnterStartDetails && !otpRequired ? <p className="helper">This dispatch trip does not require an OTP.</p> : null}
            {canEnterStartDetails ? <Button className="driver-action-button" disabled={!canStart} loading={pendingAction === "START"} onClick={() => void startRide()}>Start trip</Button> : null}
            {canEnd ? <Button className="driver-action-button" loading={pendingAction === "END"} onClick={() => void endRide()}>Complete trip</Button> : null}
            {!canEnterStartDetails && !canEnd ? <p className="helper">No trip action is needed right now.</p> : null}
            {canCancel ? <Button variant="secondary" className="driver-action-button" onClick={() => setCancelDialogOpen(true)}>Cancel trip</Button> : null}
            {ride.rider && status === "ENDED" ? (
              <div className="driver-actions">
                <Field label="Rate rider">
                  <Select value={ratingValue} onChange={(event) => setRatingValue(event.target.value)}>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </Select>
                </Field>
                <Button variant="secondary" disabled={!canRate} loading={submittingRating} onClick={() => void rateRider()}>
                  {ratingAlreadySubmitted ? "Rated" : "Submit rating"}
                </Button>
              </div>
            ) : null}
          </Section>

          <ConfirmDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
            title="Cancel this trip?"
            description="The trip will be cancelled and removed from your active work."
            confirmLabel="Cancel trip"
            onConfirm={cancelRide}
          />
        </>
      ) : null}
    </main>
  );
}

function isActiveStatus(status: string | null): boolean {
  return status === "CONFIRMED" || status === "ONGOING";
}
