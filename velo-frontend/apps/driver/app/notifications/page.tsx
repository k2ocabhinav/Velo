"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  requestDriverProxy,
  toRelativeTimestamp,
  type DriverNotification,
  type SpringPage,
} from "../_lib/driver-client";
import {
  getDriverRealtimeStatusText,
  useDriverNotificationSubscription,
  type DriverNotificationEvent,
} from "../_lib/driver-ws";

function normalizeNotification(event: DriverNotificationEvent): DriverNotification | null {
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

export default function DriverNotificationsPage() {
  const [items, setItems] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const page = await requestDriverProxy<SpringPage<DriverNotification>>("notifications?page=0&size=25");
      setItems(Array.isArray(page.content) ? page.content : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const onWsNotification = useCallback((event: DriverNotificationEvent) => {
    const normalized = normalizeNotification(event);
    if (!normalized) {
      return;
    }

    setItems((current) => {
      if (current.some((item) => item.id === normalized.id)) {
        return current;
      }
      return [normalized, ...current];
    });
  }, []);

  const realtime = useDriverNotificationSubscription(true, onWsNotification);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function markRead(id: number): Promise<void> {
    setProcessingId(id);
    setError(null);
    setMessage(null);

    try {
      await requestDriverProxy<DriverNotification>(`notifications/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setMessage(`Marked notification #${id} as read.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to mark notification as read.");
    } finally {
      setProcessingId(null);
    }
  }

  async function markAllRead(): Promise<void> {
    setMarkingAll(true);
    setError(null);
    setMessage(null);

    try {
      await requestDriverProxy<void>("notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setMessage("All notifications marked as read.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="stack">
      <section className="hero">
        <p className="badge">Notifications</p>
        <h1>Track ride and payout updates</h1>
        <p>Unread: {unreadCount}</p>
        <p className={realtime.state === "error" ? "error-text" : "helper"}>
          {getDriverRealtimeStatusText(realtime.state, realtime.reconnectAttempts)}
        </p>
        {realtime.lastError ? <p className="helper">{realtime.lastError}</p> : null}
      </section>

      <section className="card stack">
        <div className="split-row">
          <strong>Your notifications</strong>
          <div className="actions">
            <button className="secondary-button" type="button" disabled={loading} onClick={() => void loadNotifications()}>
              Refresh
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={markingAll || unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          </div>
        </div>

        {loading ? <p className="helper">Loading notifications...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="helper">{message}</p> : null}
        {!loading && !error && items.length === 0 ? <p className="helper">No notifications yet.</p> : null}

        {!loading && !error && items.length > 0 ? (
          <div className="list">
            {items.map((notification) => (
              <article className="list-item" key={notification.id}>
                <div className="stack compact">
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <p className="helper">
                    {notification.type} • {toRelativeTimestamp(notification.createdTime)}
                  </p>
                </div>
                <div className="stack compact" style={{ justifyItems: "end" }}>
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
                      className="secondary-button"
                      type="button"
                      disabled={processingId === notification.id}
                      onClick={() => void markRead(notification.id)}
                    >
                      {processingId === notification.id ? "Saving..." : "Mark read"}
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
