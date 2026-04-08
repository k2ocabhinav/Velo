"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  requestDriverProxy,
  toRelativeTimestamp,
  type DriverNotification,
  type DriverProfile,
  type DriverRide,
  type SpringPage,
} from "./_lib/driver-client";
import { mapApiError } from "./_lib/driver-forms";
import {
  getDriverRealtimeStatusText,
  useDriverNotificationSubscription,
  type DriverNotificationEvent,
} from "./_lib/driver-ws";

const INCOMING_TYPES = new Set(["RIDE_REQUESTED", "RIDE_DISPATCHED"]);
const REFRESH_INTERVAL_MS = 30_000;

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

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const [incoming, setIncoming] = useState<DriverNotification[]>([]);
  const [loadingIncoming, setLoadingIncoming] = useState(true);
  const [refreshingIncoming, setRefreshingIncoming] = useState(false);

  const [acceptingRequestId, setAcceptingRequestId] = useState<number | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const response = await requestDriverProxy<DriverProfile>("drivers/getMyProfile");
      setProfile(response);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Unable to load profile.");
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
    setError(null);

    try {
      const page = await requestDriverProxy<SpringPage<DriverNotification>>("notifications?page=0&size=25");
      const items = Array.isArray(page.content) ? page.content : [];
      const filtered = items.filter((item) => isIncomingRideType(item.type) && !item.read);
      setIncoming(filtered);
    } catch (incomingError) {
      setError(incomingError instanceof Error ? incomingError.message : "Unable to load incoming requests.");
    } finally {
      setLoadingIncoming(false);
      setRefreshingIncoming(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadIncoming();
  }, [loadProfile, loadIncoming]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadIncoming(true);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadIncoming]);

  const handleIncomingNotification = useCallback((event: DriverNotificationEvent) => {
    const normalized = toIncomingNotification(event);
    if (!normalized || normalized.read) {
      return;
    }

    setIncoming((current) => {
      if (current.some((item) => item.id === normalized.id)) {
        return current;
      }
      return [normalized, ...current];
    });
  }, []);

  const realtime = useDriverNotificationSubscription(true, handleIncomingNotification);

  const queuedRequestCount = useMemo(() => incoming.length, [incoming]);

  async function toggleAvailability(): Promise<void> {
    if (!profile) {
      return;
    }

    setTogglingAvailability(true);
    setError(null);
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
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function acceptRide(notification: DriverNotification): Promise<void> {
    const rideRequestId = getRideRequestId(notification);
    if (!rideRequestId) {
      setError("This request is missing a ride reference. Please refresh.");
      return;
    }

    setAcceptingRequestId(rideRequestId);
    setError(null);
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
      setMessage(`Ride request #${rideRequestId} accepted.`);
      router.push(`/ride/${ride.id}`);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? mapApiError({ error: acceptError.message }, "Unable to accept this ride request.")
          : "Unable to accept this ride request.",
      );
    } finally {
      setAcceptingRequestId(null);
    }
  }

  async function markRead(notification: DriverNotification): Promise<void> {
    setMarkingNotificationId(notification.id);
    setError(null);
    setMessage(null);

    try {
      await requestDriverProxy<DriverNotification>(`notifications/${notification.id}/read`, {
        method: "POST",
      });
      setIncoming((current) => current.filter((item) => item.id !== notification.id));
      setMessage(`Notification #${notification.id} marked as read.`);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Unable to mark notification as read.");
    } finally {
      setMarkingNotificationId(null);
    }
  }

  return (
    <main className="stack">
      <section className="hero">
        <p className="badge">Driver Home</p>
        <h1>Stay available and respond to rides quickly</h1>
        <p>Use this screen to manage your availability, incoming ride requests, and active ride transitions.</p>
      </section>

      <section className="card stack">
        <div className="split-row">
          <div className="stack compact">
            <strong>Status</strong>
            {loadingProfile ? (
              <p className="helper">Loading profile...</p>
            ) : (
              <p className="helper">
                Driver #{profile?.id ?? "--"} • Vehicle {profile?.vehicleId ?? "--"} •{" "}
                {profile?.available ? "Online" : "Offline"}
              </p>
            )}
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={loadingProfile || togglingAvailability || !profile}
            onClick={() => void toggleAvailability()}
          >
            {togglingAvailability
              ? "Updating..."
              : profile?.available
                ? "Go offline"
                : "Go online"}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
      </section>

      <section className="card stack">
        <div className="split-row">
          <div className="stack compact">
            <strong>Incoming ride requests</strong>
            <p className="helper">Unread incoming requests: {queuedRequestCount}</p>
            <p className={realtime.state === "error" ? "error-text" : "helper"}>
              {getDriverRealtimeStatusText(realtime.state, realtime.reconnectAttempts)}
            </p>
            {realtime.lastError ? <p className="helper">{realtime.lastError}</p> : null}
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={refreshingIncoming}
            onClick={() => void loadIncoming(true)}
          >
            {refreshingIncoming ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingIncoming ? <p className="helper">Loading incoming requests...</p> : null}
        {!loadingIncoming && incoming.length === 0 ? (
          <p className="helper">No incoming ride requests right now.</p>
        ) : null}

        {!loadingIncoming && incoming.length > 0 ? (
          <div className="list">
            {incoming.map((notification) => {
              const requestId = getRideRequestId(notification);
              const busy = requestId !== null && acceptingRequestId === requestId;
              return (
                <article className="list-item" key={notification.id}>
                  <div className="stack compact">
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <p className="helper">
                      Request #{requestId ?? "--"} • {toRelativeTimestamp(notification.createdTime)}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={busy || requestId === null}
                      onClick={() => void acceptRide(notification)}
                    >
                      {busy ? "Accepting..." : "Accept"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={markingNotificationId === notification.id}
                      onClick={() => void markRead(notification)}
                    >
                      {markingNotificationId === notification.id ? "Saving..." : "Dismiss"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="card stack">
        <strong>Shortcuts</strong>
        <div className="actions">
          <Link className="secondary-button" href="/rides">
            View ride history
          </Link>
          <Link className="secondary-button" href="/earnings">
            Open earnings
          </Link>
          <Link className="secondary-button" href="/notifications">
            View all notifications
          </Link>
        </div>
      </section>
    </main>
  );
}
