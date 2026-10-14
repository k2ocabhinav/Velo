"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { Button } from "@velo/ui/primitives";
import { DateTime, EmptyState, ErrorState, Money, PageHeader, RouteStrip, Section, StatusBadge } from "@velo/ui/composed";
import { CountdownBadge, LiveStatusPill, MatchingIndicator, Skeleton } from "@velo/ui/feedback";
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
import {
  getDriverRealtimeStatusText,
  useDriverNotificationSubscription,
  type DriverNotificationEvent,
} from "./_lib/driver-ws";

const INCOMING_TYPES = new Set(["RIDE_REQUESTED", "RIDE_DISPATCHED"]);
const DEFAULT_REFRESH_INTERVAL_MS = 30_000;
const ACTIVE_RIDE_REFRESH_INTERVAL_MS = 10_000;
const OFFER_TTL_MS = 45_000;

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

function getIncomingCardContent(
  notification: DriverNotification,
  tripLabel: string,
): Readonly<{ title: string; message: string }> {
  const tripNoun = tripLabel.toLowerCase();
  if (notification.type === "RIDE_DISPATCHED") {
    return {
      title: `Scheduled ${tripNoun} offer`,
      message: "A scheduled trip is ready for your response.",
    };
  }

  return {
    title: `New ${tripNoun} offer`,
    message: "A trip request is waiting for your response.",
  };
}

function getNextTripActionLabel(status: string): string {
  if (status.toUpperCase() === "CONFIRMED") return "Start trip";
  if (status.toUpperCase() === "ONGOING") return "Complete trip";
  return "Continue trip";
}

function toMapPoint(point: DriverRideRequestPreview["pickupLocation"]): { lat: number; lng: number } | null {
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

function buildPickupPreviewUrl(point: { lat: number; lng: number }): string {
  const delta = 0.0125;
  const left = point.lng - delta;
  const right = point.lng + delta;
  const top = point.lat + delta;
  const bottom = point.lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${point.lat}%2C${point.lng}`;
}

function toExpiryMs(createdTime: string | null | undefined): number | null {
  if (!createdTime) {
    return null;
  }

  const createdMs = new Date(createdTime).getTime();
  if (!Number.isFinite(createdMs)) {
    return null;
  }

  return createdMs + OFFER_TTL_MS;
}

type TenantBranding = {
  riderLabel?: string;
  tripLabel?: string;
};

export default function DriverHomePage() {
  const router = useRouter();

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
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  const riderLabel = branding?.riderLabel ?? "Rider";
  const tripLabel = branding?.tripLabel ?? "Trip";

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
      setIncomingError(incomingError instanceof Error ? incomingError.message : "Unable to load trip offers.");
    } finally {
      setLoadingIncoming(false);
      setRefreshingIncoming(false);
    }
  }, []);

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
        activeRideLoadError instanceof Error ? activeRideLoadError.message : "Unable to load active ride status.",
      );
      setActiveRide(null);
    } finally {
      setLoadingActiveRide(false);
      setRefreshingActiveRide(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadIncoming();
    void loadActiveRide();
    void requestDriverProxy<TenantBranding>("api/v1/tenant/branding")
      .then((payload) => setBranding(payload))
      .catch(() => setBranding(null));
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

  const queuedRequestCount = useMemo(() => incoming.length, [incoming]);
  const incomingRealtimeMessage = useMemo(() => {
    const base = getDriverRealtimeStatusText(realtime.state, realtime.reconnectAttempts);
    if (realtime.state === "error" && realtime.lastError) {
      return `${base} ${realtime.lastError}`;
    }
    return base;
  }, [realtime.lastError, realtime.reconnectAttempts, realtime.state]);

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
          ? mapApiError({ error: acceptError.message }, "Unable to accept this ride request.")
          : "Unable to accept this ride request.";
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
        title="Ready for your next trip"
        description={`Manage availability and respond to ${tripLabel.toLowerCase()} offers from here.`}
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
              <p>{profile.available ? "New trip offers can reach you." : "Go online when you're ready to drive."}</p>
              {profile.vehicleId ? <p>Vehicle {profile.vehicleId}</p> : null}
              <LiveStatusPill state={profile.available ? "connected" : "idle"} label={profile.available ? "Online" : "Offline"} />
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
              {togglingAvailability ? "Updating…" : profile.available ? "You're online" : "Go online"}
            </Button>
          </div>
        ) : null}
      </Section>

      <Section
        title="Trip offers"
        actions={(
          <Button variant="secondary" disabled={refreshingIncoming} onClick={() => void loadIncoming(true)}>
            {refreshingIncoming ? "Refreshing…" : "Refresh offers"}
          </Button>
        )}
      >
        {realtime.state === "error" ? (
          <ErrorState
            title="Live offers are paused"
            description={`${incomingRealtimeMessage} You can refresh to check for new offers.`}
            onRetry={() => void loadIncoming(true)}
            retryLabel="Refresh offers"
          />
        ) : (
          <div className="driver-row-meta">
            <LiveStatusPill state={realtime.state} label={realtime.state === "connected" ? "Listening for offers" : undefined} />
            {queuedRequestCount > 0 ? <span className="badge" data-tone="attention">{queuedRequestCount} waiting</span> : null}
          </div>
        )}
        {incomingError ? (
          <ErrorState title="Couldn't load trip offers" description={incomingError} onRetry={() => void loadIncoming()} />
        ) : null}
        {loadingIncoming ? (
          <div className="driver-offer-list" role="status" aria-label="Loading trip offers" aria-busy="true">
            {[0, 1].map((item) => <Skeleton key={item} className="h-32 w-full" />)}
          </div>
        ) : null}
        {!loadingIncoming && !incomingError && incoming.length === 0 ? (
          <EmptyState
            title="No trip offers yet"
            description={profile?.available ? "Keep your availability on and new offers will appear here." : "Go online when you're ready to receive trip offers."}
            action={profile?.available
              ? <Button variant="secondary" onClick={() => void loadIncoming(true)}>Refresh offers</Button>
              : <Button onClick={() => void toggleAvailability()} disabled={!profile || togglingAvailability}>Go online</Button>}
          />
        ) : null}
        {!loadingIncoming && !incomingError && incoming.length > 0 ? (
          <div className="driver-offer-list">
            {incoming.map((notification) => {
              const requestId = getRideRequestId(notification);
              const busy = requestId !== null && acceptingRequestId === requestId;
              const preview = requestId !== null ? rideRequestPreviews[requestId] : null;
              const pickup = toMapPoint(preview?.pickupLocation);
              const cardContent = getIncomingCardContent(notification, tripLabel);
              return (
                <article className="driver-offer" key={notification.id}>
                  <div className="stack compact">
                    <div className="driver-offer-meta">
                      <h3>{cardContent.title}</h3>
                      {preview?.fare !== undefined && preview.fare !== null ? <Money amount={preview.fare} emphasis /> : null}
                    </div>
                    <p className="driver-section-copy">{cardContent.message}</p>
                    <RouteStrip stage={preview?.rideRequestStatus ?? "requested"} variant="static" showDriverMarker={false} />
                    <div className="driver-row-meta">
                      <DateTime value={notification.createdTime} />
                      <MatchingIndicator label="Offer response window" expiresAtMs={toExpiryMs(notification.createdTime)} />
                      <CountdownBadge expiresAtMs={toExpiryMs(notification.createdTime)} prefix="Offer expires in" />
                    </div>
                    {pickup ? (
                      <iframe
                        title="Pickup map preview"
                        className="incoming-map-preview"
                        src={buildPickupPreviewUrl(pickup)}
                        loading="lazy"
                      />
                    ) : (
                      <p className="helper">Pickup map unavailable.</p>
                    )}
                  </div>
                  <div className="driver-offer-actions">
                    <Button
                      disabled={busy || requestId === null || (requestId !== null && isActionPending(pendingActions, `accept:${requestId}`))}
                      onClick={() => void acceptRide(notification)}
                    >
                      {busy ? "Accepting…" : "Accept trip"}
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

      <Section
        title="Current trip"
        actions={(
          <Button variant="secondary" disabled={refreshingActiveRide} onClick={() => void loadActiveRide(true)}>
            {refreshingActiveRide ? "Refreshing…" : "Refresh"}
          </Button>
        )}
      >
        {loadingActiveRide ? (
          <div className="stack compact" role="status" aria-label="Loading current trip" aria-busy="true">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}
        {!loadingActiveRide && activeRideError ? (
          <ErrorState title="Couldn't load your current trip" description={activeRideError} onRetry={() => void loadActiveRide()} />
        ) : null}
        {!loadingActiveRide && !activeRideError && !activeRide ? (
          <EmptyState
            title="No active trip"
            description="Your accepted trip will appear here with the next action when one is assigned."
            action={<Link href="/rides" className="ui-button" data-variant="secondary">View trips</Link>}
          />
        ) : null}
        {!loadingActiveRide && !activeRideError && activeRide ? (
          <div className="driver-trip-summary">
            <div className="driver-row-meta">
              <code className="driver-reference">Trip {activeRide.id}</code>
              <StatusBadge domain="ride" status={activeRide.rideStatus} />
              <DateTime value={activeRide.startedAt ?? activeRide.createdTime} />
            </div>
            <RouteStrip stage={activeRide.rideStatus} />
            <p>{riderLabel}: {activeRide.rider?.user?.name ?? activeRide.rider?.user?.email ?? `Assigned ${riderLabel.toLowerCase()}`}</p>
            <div className="driver-row-meta">
              <Money amount={getDriverRideFareValue(activeRide)} emphasis />
              <Link href={`/ride/${activeRide.id}`} className="ui-button" data-variant="primary">
                {getNextTripActionLabel(activeRide.rideStatus)}
              </Link>
            </div>
          </div>
        ) : null}
      </Section>
    </main>
  );
}
