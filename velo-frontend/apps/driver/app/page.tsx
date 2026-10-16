"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import { Button } from "@velo/ui/primitives";
import { createRouteStageLabels, DateTime, EmptyState, ErrorState, Money, PageHeader, RouteStrip, Section, StatusBadge } from "@velo/ui/composed";
import { CountdownBadge, LiveStatusPill, ReconnectingIndicator, Skeleton } from "@velo/ui/feedback";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import {
  requestDriverProxy,
  type DriverNotification,
  type DriverProfile,
  type DriverRideRequestPreview,
  type DriverRide,
  type SpringPage,
} from "./_lib/driver-client";
import { mapApiError } from "./_lib/driver-forms";
import {
  getDriverRideFareValue,
  normalizeDriverRidePage,
  selectCurrentDriverRide,
} from "./_lib/driver-ride-state";
import { formatOfferLocation, getIncomingOfferTitle, getNextTripActionLabel, getRiderFirstName, PENDING_DROP_OFF_LABEL, PENDING_PICKUP_LABEL, resolveOfferExpiresAtMs } from "./_lib/driver-offer";
import { useDriverLocationPublisher } from "./_lib/driver-location-publisher";
import {
  useDriverNotificationSubscription,
  type DriverNotificationEvent,
} from "./_lib/driver-ws";

const INCOMING_TYPES = new Set(["RIDE_REQUESTED", "RIDE_DISPATCHED"]);
const DEFAULT_REFRESH_INTERVAL_MS = 30_000;
const ACTIVE_RIDE_REFRESH_INTERVAL_MS = 10_000;

function isIncomingRideType(type: string | null | undefined): boolean {
  return Boolean(type && INCOMING_TYPES.has(type));
}

function toIncomingNotification(event: DriverNotificationEvent): DriverNotification | null {
  if (!isIncomingRideType(event.type)) {
    return null;
  }

  if (typeof event.id !== "number" || typeof event.title !== "string" || typeof event.message !== "string") {
    return null;
  }

  return {
    id: event.id,
    title: event.title,
    message: event.message,
    type: event.type ?? "GENERAL",
    read: Boolean(event.read),
    createdTime: event.createdTime ?? new Date().toISOString(),
    referenceId: typeof event.referenceId === "number" ? event.referenceId : null,
  };
}

function getRideRequestId(notification: DriverNotification): number | null {
  return typeof notification.referenceId === "number" ? notification.referenceId : null;
}

export default function DriverHomePage() {
  const router = useRouter();
  const words = getTenantLabelWords(useTenantBrandingOrDefault());
  const stageLabels = createRouteStageLabels(words.trip, words.driver);

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const [incoming, setIncoming] = useState<DriverNotification[]>([]);
  const [rideRequestPreviews, setRideRequestPreviews] = useState<Record<number, DriverRideRequestPreview | null>>({});
  const [loadingIncoming, setLoadingIncoming] = useState(true);
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [refreshingIncoming, setRefreshingIncoming] = useState(false);
  const [activeRide, setActiveRide] = useState<DriverRide | null>(null);
  const [loadingActiveRide, setLoadingActiveRide] = useState(true);
  const [refreshingActiveRide, setRefreshingActiveRide] = useState(false);
  const [activeRideError, setActiveRideError] = useState<string | null>(null);

  const [acceptingRequestId, setAcceptingRequestId] = useState<number | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locationPublisher = useDriverLocationPublisher(null, profile?.available === true, words.trip);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try {
      const response = await requestDriverProxy<DriverProfile>("drivers/getMyProfile");
      setProfile(response);
    } catch (profileError) {
      setProfileError(profileError instanceof Error ? profileError.message : "Unable to load profile.");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadIncoming = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshingIncoming(true);
    } else {
      setLoadingIncoming(true);
    }
    setIncomingError(null);

    try {
      const page = await requestDriverProxy<SpringPage<DriverNotification>>("notifications?page=0&size=25");
      const items = Array.isArray(page.content) ? page.content : [];
      const filtered = items.filter((item) => isIncomingRideType(item.type) && !item.read);
      const previewUpdates: Record<number, DriverRideRequestPreview> = {};
      const actionable: DriverNotification[] = [];

      await Promise.all(
        filtered.map(async (item) => {
          const requestId = getRideRequestId(item);
          if (!requestId) {
            return;
          }
          try {
            const preview = await requestDriverProxy<DriverRideRequestPreview>(`drivers/ride-requests/${requestId}`);
            if ((preview.rideRequestStatus ?? "").toUpperCase() !== "PENDING") {
              return;
            }
            previewUpdates[requestId] = preview;
            actionable.push(item);
          } catch {
            // Ignore non-actionable or stale notifications.
          }
        }),
      );

      setRideRequestPreviews((current) => ({ ...current, ...previewUpdates }));
      setIncoming(actionable);
    } catch (incomingError) {
      setIncomingError(incomingError instanceof Error ? incomingError.message : `Unable to load ${words.tripWord} offers.`);
    } finally {
      setLoadingIncoming(false);
      setRefreshingIncoming(false);
    }
  }, [words.tripWord]);

  const loadActiveRide = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshingActiveRide(true);
    } else {
      setLoadingActiveRide(true);
    }
    setActiveRideError(null);

    try {
      const page = await requestDriverProxy<SpringPage<DriverRide>>("drivers/getMyRides?pageOffset=0&pageSize=20");
      const rides = normalizeDriverRidePage(page);
      setActiveRide(selectCurrentDriverRide(rides));
    } catch (activeRideLoadError) {
      setActiveRideError(
        activeRideLoadError instanceof Error ? activeRideLoadError.message : `Unable to load active ${words.tripWord} status.`,
      );
      setActiveRide(null);
    } finally {
      setLoadingActiveRide(false);
      setRefreshingActiveRide(false);
    }
  }, [words.tripWord]);

  useEffect(() => {
    void loadProfile();
    void loadIncoming();
    void loadActiveRide();
  }, [loadProfile, loadIncoming, loadActiveRide]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadIncoming(true);
    }, DEFAULT_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadIncoming]);

  useEffect(() => {
    const intervalMs = activeRide ? ACTIVE_RIDE_REFRESH_INTERVAL_MS : DEFAULT_REFRESH_INTERVAL_MS;
    const intervalId = window.setInterval(() => {
      void loadActiveRide(true);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRide, loadActiveRide]);

  const handleIncomingNotification = useCallback(
    (event: DriverNotificationEvent) => {
      const normalized = toIncomingNotification(event);
      if (normalized && !normalized.read) {
        const requestId = getRideRequestId(normalized);
        if (requestId) {
          void requestDriverProxy<DriverRideRequestPreview>(`drivers/ride-requests/${requestId}`)
            .then((preview) => {
              if ((preview.rideRequestStatus ?? "").toUpperCase() !== "PENDING") {
                return;
              }
              setRideRequestPreviews((current) => ({ ...current, [requestId]: preview }));
              setIncoming((current) => {
                if (current.some((item) => item.id === normalized.id)) {
                  return current;
                }
                return [normalized, ...current];
              });
            })
            .catch(() => undefined);
        }
      }

      if (event.type?.toUpperCase().startsWith("RIDE_")) {
        void loadActiveRide(true);
      }
    },
    [loadActiveRide],
  );

  const realtime = useDriverNotificationSubscription(true, handleIncomingNotification);

  const handleOfferExpired = useCallback(() => {
    void loadIncoming(true);
  }, [loadIncoming]);

  const queuedRequestCount = useMemo(() => incoming.length, [incoming]);
  const activeRideFare = getDriverRideFareValue(activeRide);

  async function toggleAvailability(): Promise<void> {
    if (!profile) {
      return;
    }
    if (isActionPending(pendingActions, "availability")) {
      return;
    }

    setPendingActions((current) => setActionPending(current, "availability", true));
    setTogglingAvailability(true);
    setError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      const updated = await requestDriverProxy<DriverProfile>("drivers/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !profile.available }),
      });
      setProfile(updated);
      setMessage(updated.available ? "You are now online." : "You are now offline.");
    } catch (availabilityError) {
      setError(
        availabilityError instanceof Error
          ? mapApiError({ error: availabilityError.message }, "Unable to update availability.")
          : "Unable to update availability.",
      );
      setRetryAction(() => () => { void toggleAvailability(); });
    } finally {
      setTogglingAvailability(false);
      setPendingActions((current) => setActionPending(current, "availability", false));
    }
  }

  async function acceptRide(notification: DriverNotification): Promise<void> {
    const rideRequestId = getRideRequestId(notification);
    if (!rideRequestId) {
      setError("This offer is no longer available. Refresh to check for new offers.");
      setRetryAction(() => () => { void loadIncoming(true); });
      return;
    }
    const actionKey = `accept:${rideRequestId}`;
    if (isActionPending(pendingActions, actionKey)) {
      return;
    }

    setPendingActions((current) => setActionPending(current, actionKey, true));
    setAcceptingRequestId(rideRequestId);
    setError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      const ride = await requestDriverProxy<DriverRide>(`drivers/acceptRide/${rideRequestId}`, {
        method: "POST",
      });

      if (!notification.read) {
        await requestDriverProxy<DriverNotification>(`notifications/${notification.id}/read`, {
          method: "POST",
        }).catch(() => undefined);
      }

      setIncoming((current) => current.filter((item) => item.id !== notification.id));
      setMessage("Offer accepted.");
      setActiveRide(ride);
      router.push(`/ride/${ride.id}`);
    } catch (acceptError) {
      const nextMessage =
        acceptError instanceof Error
          ? mapApiError({ error: acceptError.message }, `Unable to accept this ${words.tripWord} request.`, words)
          : `Unable to accept this ${words.tripWord} request.`;
      setError(nextMessage);
      setRetryAction(() => () => { void acceptRide(notification); });
      if (nextMessage.toLowerCase().includes("already been assigned") || nextMessage.toLowerCase().includes("cancelled")) {
        setIncoming((current) => current.filter((item) => item.id !== notification.id));
      }
    } finally {
      setAcceptingRequestId(null);
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  async function markRead(notification: DriverNotification): Promise<void> {
    const actionKey = `dismiss:${notification.id}`;
    if (isActionPending(pendingActions, actionKey)) {
      return;
    }

    setPendingActions((current) => setActionPending(current, actionKey, true));
    setMarkingNotificationId(notification.id);
    setError(null);
    setRetryAction(null);
    setMessage(null);

    try {
      await requestDriverProxy<DriverNotification>(`notifications/${notification.id}/read`, {
        method: "POST",
      });
      setIncoming((current) => current.filter((item) => item.id !== notification.id));
      setMessage("Offer declined.");
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Unable to mark notification as read.");
      setRetryAction(() => () => { void markRead(notification); });
    } finally {
      setMarkingNotificationId(null);
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  return (
    <main className="stack">
      <PageHeader
        title={`Ready for your next ${words.tripWord}`}
        description={`Manage availability and respond to ${words.tripWord} offers from here.`}
      />

      {error ? (
        <ErrorState
          title="Couldn't complete that action"
          description={error}
          onRetry={retryAction ?? (() => { void Promise.all([loadProfile(), loadIncoming(true), loadActiveRide(true)]); })}
          retryLabel={retryAction ? "Retry action" : "Refresh"}
        />
      ) : null}
      {message ? <p role="status" className="helper">{message}</p> : null}

      <Section
        title={`${words.trip} offers`}
        actions={(
          <Button variant="secondary" disabled={refreshingIncoming} onClick={() => void loadIncoming(true)}>
            {refreshingIncoming ? "Refreshing…" : "Refresh offers"}
          </Button>
        )}
      >
        <div className="driver-row-meta">
          {realtime.state === "error" || realtime.state === "reconnecting" ? (
            <ReconnectingIndicator
              state={realtime.state}
              attempts={realtime.reconnectAttempts}
              message="Live offers paused. The list refreshes automatically."
              onRetry={() => void loadIncoming(true)}
              retryLabel="Refresh offers"
              retrying={refreshingIncoming}
            />
          ) : <LiveStatusPill state={realtime.state} label={realtime.state === "connected" ? "Listening for offers" : undefined} />}
          {queuedRequestCount > 0 ? <span className="badge" data-tone="attention">{queuedRequestCount} waiting</span> : null}
        </div>
        {incomingError ? (
          <ErrorState title={`Couldn't load ${words.tripWord} offers`} description={incomingError} onRetry={() => void loadIncoming()} />
        ) : null}
        {loadingIncoming ? (
          <div className="driver-offer-list" role="status" aria-label={`Loading ${words.tripWord} offers`} aria-busy="true">
            {[0, 1].map((item) => <Skeleton key={item} className="h-32 w-full" />)}
          </div>
        ) : null}
        {!loadingIncoming && !incomingError && incoming.length === 0 ? (
          <EmptyState
            title={`No ${words.tripWord} offers yet`}
            description={profile?.available ? "Keep your availability on and new offers will appear here." : `Go online when you're ready to receive ${words.tripWord} offers.`}
            action={!profile?.available
              ? <Button onClick={() => void toggleAvailability()} disabled={!profile || togglingAvailability}>Go online</Button>
              : undefined}
          />
        ) : null}
        {!loadingIncoming && !incomingError && incoming.length > 0 ? (
          <div className="driver-offer-list">
            {incoming.map((notification) => {
              const requestId = getRideRequestId(notification);
              const busy = requestId !== null && acceptingRequestId === requestId;
              const preview = requestId !== null ? rideRequestPreviews[requestId] : null;
              const offerTitle = getIncomingOfferTitle(notification.type, words.tripWord);
              const riderName = getRiderFirstName(preview?.rider);
              const pickupLabel = formatOfferLocation(preview?.pickupAddress, preview?.pickupLocation, PENDING_PICKUP_LABEL);
              const dropOffLabel = formatOfferLocation(preview?.dropOffAddress, preview?.dropOffLocation, PENDING_DROP_OFF_LABEL);
              const offerExpiresAtMs = resolveOfferExpiresAtMs(preview?.expiresAt, notification.createdTime);
              return (
                <article className="driver-offer" key={notification.id}>
                  <div className="driver-offer-header">
                    <h3>{offerTitle}</h3>
                    <div className="driver-offer-meta">
                      {preview?.fare !== undefined && preview.fare !== null ? <Money amount={preview.fare} emphasis /> : null}
                      <CountdownBadge
                        expiresAtMs={offerExpiresAtMs}
                        prefix="Offer expires in"
                        expiredLabel="Expired"
                        onExpire={handleOfferExpired}
                      />
                    </div>
                  </div>
                  {riderName || pickupLabel || dropOffLabel ? (
                    <div className="driver-offer-route" role="group" aria-label="Offer route">
                      {riderName ? (
                        <p className="driver-offer-rider">
                          <span className="driver-offer-label">{words.rider}</span>
                          <span>{riderName}</span>
                        </p>
                      ) : null}
                      {pickupLabel || dropOffLabel ? (
                        <div
                          className="driver-offer-stops"
                          data-has-pickup={Boolean(pickupLabel)}
                          data-has-drop-off={Boolean(dropOffLabel)}
                        >
                          {pickupLabel ? (
                            <div className="driver-offer-stop driver-offer-pickup">
                              <span className="driver-offer-label">Pickup</span>
                              <span className="driver-offer-location" title={pickupLabel}>{pickupLabel}</span>
                            </div>
                          ) : null}
                          {pickupLabel && dropOffLabel ? <span className="driver-offer-route-arrow" aria-hidden="true">→</span> : null}
                          {dropOffLabel ? (
                            <div className="driver-offer-stop driver-offer-drop-off">
                              <span className="driver-offer-label">Drop-off</span>
                              <span className="driver-offer-location" title={dropOffLabel}>{dropOffLabel}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="driver-offer-actions">
                    <Button
                      disabled={busy || requestId === null || (requestId !== null && isActionPending(pendingActions, `accept:${requestId}`))}
                      onClick={() => void acceptRide(notification)}
                    >
                      {busy ? "Accepting…" : `Accept ${words.tripWord}`}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={markingNotificationId === notification.id || isActionPending(pendingActions, `dismiss:${notification.id}`)}
                      onClick={() => void markRead(notification)}
                    >
                      {markingNotificationId === notification.id ? "Declining…" : "Decline"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </Section>

      <Section title="Availability">
        {loadingProfile ? (
          <div className="stack compact" role="status" aria-label="Loading driver profile" aria-busy="true">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : null}
        {!loadingProfile && profileError ? (
          <ErrorState title="Couldn't load your profile" description={profileError} onRetry={() => void loadProfile()} />
        ) : null}
        {!loadingProfile && !profileError && profile ? (
          <div className="driver-availability">
            <div className="driver-availability-copy">
              <strong>{profile.available ? "You're online" : "You're offline"}</strong>
              <p>{profile.available ? `New ${words.tripWord} offers can reach you.` : "Go online when you're ready to drive."}</p>
              {profile.vehicleId ? <p>Vehicle {profile.vehicleId}</p> : null}
              {profile.available && locationPublisher.mode === "degraded" ? (
                <p className="helper" role="status">{locationPublisher.message}</p>
              ) : null}
            </div>
            <Button
              className="driver-availability-toggle"
              data-online={profile.available || undefined}
              role="switch"
              aria-checked={profile.available}
              aria-label={profile.available ? "Go offline" : "Go online"}
              disabled={togglingAvailability || isActionPending(pendingActions, "availability")}
              onClick={() => void toggleAvailability()}
            >
              {togglingAvailability ? "Updating…" : profile.available ? "Go offline" : "Go online"}
            </Button>
          </div>
        ) : null}
      </Section>

      <Section
        title={`Current ${words.tripWord}`}
        actions={(
          <Button variant="secondary" disabled={refreshingActiveRide} onClick={() => void loadActiveRide(true)}>
            {refreshingActiveRide ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      >
        {loadingActiveRide ? (
          <div className="stack compact" role="status" aria-label={`Loading current ${words.tripWord}`} aria-busy="true">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}
        {!loadingActiveRide && activeRideError ? (
          <ErrorState title={`Couldn't load your current ${words.tripWord}`} description={activeRideError} onRetry={() => void loadActiveRide()} />
        ) : null}
        {!loadingActiveRide && !activeRideError && !activeRide ? (
          <EmptyState
            title={`No active ${words.tripWord}`}
            description={`Your accepted ${words.tripWord} will appear here with the next action when one is assigned.`}
            action={<Link href="/rides" className="ui-button" data-variant="secondary">{`View ${words.tripsWord}`}</Link>}
          />
        ) : null}
        {!loadingActiveRide && !activeRideError && activeRide ? (
          <div className="driver-trip-summary">
            <div className="driver-row-meta">
              <code className="driver-reference">{words.trip} {activeRide.id}</code>
              <StatusBadge domain="ride" status={activeRide.rideStatus} labels={words} />
              <DateTime value={activeRide.startedAt ?? activeRide.createdTime} />
            </div>
            <RouteStrip stage={activeRide.rideStatus} stageLabels={stageLabels} />
            <p>{activeRide.rider?.user?.name?.trim() || words.rider}</p>
            <div className="driver-row-meta">
              {activeRideFare !== null && activeRideFare !== undefined ? <Money amount={activeRideFare} emphasis /> : null}
              <Link href={`/ride/${activeRide.id}`} className="ui-button" data-variant="primary">
                {getNextTripActionLabel(activeRide.rideStatus, words.tripWord)}
              </Link>
            </div>
          </div>
        ) : null}
      </Section>
    </main>
  );
}
