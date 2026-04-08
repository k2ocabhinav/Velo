"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mapApiError } from "../_lib/ride-forms";
import { requestRiderProxy, type SpringPage } from "../_lib/rider-client";
import {
  getRiderRealtimeStatusText,
  useRiderNotificationSubscription,
  type RiderNotificationEvent,
} from "../_lib/rider-ws";

type RiderNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdTime: string;
  referenceId?: number | null;
};

const REFRESH_INTERVAL_MS = 30_000;

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function sortNotifications(items: RiderNotification[]): RiderNotification[] {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.createdTime).getTime();
    const rightTime = new Date(right.createdTime).getTime();
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return right.id - left.id;
  });
}

function upsertNotification(
  current: RiderNotification[],
  event: RiderNotificationEvent,
): RiderNotification[] {
  if (typeof event.id !== "number") {
    return current;
  }

  const incoming: RiderNotification = {
    id: event.id,
    title: event.title ?? "Notification",
    message: event.message ?? "",
    type: event.type ?? "GENERAL",
    read: event.read === true,
    createdTime: event.createdTime ?? new Date().toISOString(),
    referenceId: event.referenceId ?? null,
  };

  const index = current.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    return sortNotifications([incoming, ...current]);
  }

  const next = [...current];
  next[index] = {
    ...next[index],
    ...incoming,
  };
  return sortNotifications(next);
}

export default function RiderNotificationsPage() {
  const [items, setItems] = useState<RiderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [readPendingId, setReadPendingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRealtimeNotification = useCallback((event: RiderNotificationEvent) => {
    setItems((current) => upsertNotification(current, event));
    setLastSyncAt(new Date().toISOString());
    setError(null);
  }, []);

  const realtime = useRiderNotificationSubscription(true, handleRealtimeNotification);

  const loadNotifications = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const page = await requestRiderProxy<SpringPage<RiderNotification>>("notifications?page=0&size=25");
      const content = Array.isArray(page.content) ? page.content : [];
      setItems(sortNotifications(content));
      setLastSyncAt(new Date().toISOString());
    } catch (loadError) {
      const nextMessage =
        loadError instanceof Error
          ? mapApiError({ error: loadError.message }, "Unable to load notifications.")
          : "Unable to load notifications.";
      setError(nextMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadNotifications(true);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const syncMessage = useMemo(() => {
    const base = getRiderRealtimeStatusText(realtime.state, realtime.reconnectAttempts);
    if (realtime.state === "error" && realtime.lastError) {
      return `${base} ${realtime.lastError}`;
    }

    if (realtime.state === "connected" && lastSyncAt) {
      return `${base} Last synced ${formatTimestamp(lastSyncAt)}.`;
    }

    return base;
  }, [lastSyncAt, realtime.lastError, realtime.reconnectAttempts, realtime.state]);

  async function markRead(id: number): Promise<void> {
    setReadPendingId(id);
    setError(null);
    setMessage(null);

    try {
      await requestRiderProxy<RiderNotification>(`notifications/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setLastSyncAt(new Date().toISOString());
      setMessage(`Marked notification #${id} as read.`);
      void loadNotifications(true);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? mapApiError({ error: actionError.message }, "Unable to mark notification as read.")
          : "Unable to mark notification as read.",
      );
    } finally {
      setReadPendingId(null);
    }
  }

  async function markAllRead(): Promise<void> {
    setMarkingAll(true);
    setError(null);
    setMessage(null);

    try {
      await requestRiderProxy<void>("notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setLastSyncAt(new Date().toISOString());
      setMessage("All notifications marked as read.");
      void loadNotifications(true);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? mapApiError({ error: actionError.message }, "Unable to mark all notifications as read.")
          : "Unable to mark all notifications as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="app-shell stack">
      <section className="hero">
        <p className="badge">Notifications</p>
        <h1>Stay on top of ride updates</h1>
        <p>Unread: {unreadCount}</p>
        <p className={realtime.state === "error" ? "error-text" : "helper"}>{syncMessage}</p>
      </section>

      <section className="card stack">
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>Your notifications</strong>
          <div className="actions">
            <button
              className="primary-button"
              type="button"
              disabled={loading || refreshing}
              onClick={() => void loadNotifications(true)}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={markingAll || unreadCount === 0 || readPendingId !== null}
              onClick={() => void markAllRead()}
            >
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          </div>
        </div>

        {loading ? <p className="helper">Loading notifications...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
        {error ? (
          <button className="secondary-button" type="button" disabled={refreshing} onClick={() => void loadNotifications(true)}>
            {refreshing ? "Retrying..." : "Retry now"}
          </button>
        ) : null}

        {!loading && !error && items.length === 0 ? <p className="helper">No notifications yet.</p> : null}

        {!loading && !error && items.length > 0 ? (
          <div className="list">
            {items.map((notification) => (
              <article className="list-item" key={notification.id}>
                <div className="stack" style={{ gap: 6 }}>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <p className="helper">
                    {notification.type} • {formatTimestamp(notification.createdTime)}
                  </p>
                </div>
                <div className="stack" style={{ justifyItems: "end", gap: 8 }}>
                  <span
                    className="badge"
                    style={
                      notification.read
                        ? undefined
                        : { background: "hsl(220 72% 50%)", color: "white", borderColor: "hsl(220 72% 50%)" }
                    }
                  >
                    {notification.read ? "Read" : "Unread"}
                  </span>
                  {!notification.read ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={readPendingId === notification.id || markingAll}
                      onClick={() => void markRead(notification.id)}
                    >
                      {readPendingId === notification.id ? "Saving..." : "Mark read"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
