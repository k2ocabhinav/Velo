"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { requestRiderProxy, type SpringPage } from "../_lib/rider-client";

type RiderNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdTime: string;
  referenceId?: number | null;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function RiderNotificationsPage() {
  const [items, setItems] = useState<RiderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const page = await requestRiderProxy<SpringPage<RiderNotification>>("notifications?page=0&size=25");
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

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function markRead(id: number): Promise<void> {
    setProcessingId(id);
    setError(null);
    setMessage(null);

    try {
      await requestRiderProxy<RiderNotification>(`notifications/${id}/read`, { method: "POST" });
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
      await requestRiderProxy<void>("notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setMessage("All notifications marked as read.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to mark all notifications as read.");
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
      </section>

      <section className="card stack">
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>Your notifications</strong>
          <div className="actions">
            <button className="primary-button" type="button" disabled={loading} onClick={() => void loadNotifications()}>
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
