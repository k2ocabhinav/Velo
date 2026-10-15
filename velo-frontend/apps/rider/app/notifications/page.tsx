"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getTenantLabelWords } from "@velo/app-core/tenant";
import {
  Button,
  DateTime,
  EmptyState,
  ErrorState,
  PageHeader,
  ReconnectingIndicator,
  Section,
  Skeleton,
} from "@velo/ui";
import { useTenantBrandingOrDefault } from "@velo/ui/theme";
import { mapApiError } from "../_lib/ride-forms";
import { requestRiderProxy, type SpringPage } from "../_lib/rider-client";
import {
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

function sortNotifications(items: RiderNotification[]): RiderNotification[] {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.createdTime).getTime();
    const rightTime = new Date(right.createdTime).getTime();
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
    return right.id - left.id;
  });
}

function upsertNotification(current: RiderNotification[], event: RiderNotificationEvent): RiderNotification[] {
  if (typeof event.id !== "number") return current;
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
  if (index === -1) return sortNotifications([incoming, ...current]);
  const next = [...current];
  next[index] = { ...next[index], ...incoming };
  return sortNotifications(next);
}

export default function RiderNotificationsPage() {
  const words = getTenantLabelWords(useTenantBrandingOrDefault());
  const [items, setItems] = useState<RiderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [readPendingId, setReadPendingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRealtimeNotification = useCallback((event: RiderNotificationEvent) => {
    setItems((current) => upsertNotification(current, event));
    setLastSyncAt(new Date().toISOString());
    setError(null);
  }, []);

  const realtime = useRiderNotificationSubscription(true, handleRealtimeNotification);

  const loadNotifications = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const page = await requestRiderProxy<SpringPage<RiderNotification>>("notifications?page=0&size=25");
      setItems(sortNotifications(Array.isArray(page.content) ? page.content : []));
      setLastSyncAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? mapApiError({ error: loadError.message }, "Couldn't load notifications.") : "Couldn't load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);
  useEffect(() => {
    const intervalId = window.setInterval(() => void loadNotifications(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function markRead(id: number): Promise<void> {
    setReadPendingId(id);
    setActionError(null);
    setMessage(null);
    try {
      await requestRiderProxy<RiderNotification>(`notifications/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      setLastSyncAt(new Date().toISOString());
      setMessage("Notification marked as read.");
      void loadNotifications(true);
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? mapApiError({ error: actionFailure.message }, "Couldn't mark this notification as read.") : "Couldn't mark this notification as read.");
    } finally {
      setReadPendingId(null);
    }
  }

  async function markAllRead(): Promise<void> {
    setMarkingAll(true);
    setActionError(null);
    setMessage(null);
    try {
      await requestRiderProxy<void>("notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setLastSyncAt(new Date().toISOString());
      setMessage("All notifications marked as read.");
      void loadNotifications(true);
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? mapApiError({ error: actionFailure.message }, "Couldn't mark notifications as read.") : "Couldn't mark notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="app-shell rider-page stack">
      <PageHeader title="Notifications" description={`${words.trip} updates and account activity, all in one place.`} />
      <Section title="Recent activity" actions={
        <div className="notification-actions">
          <span className="helper">{unreadCount} unread</span>
          <Button variant="secondary" disabled={loading || refreshing} onClick={() => void loadNotifications(true)}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button variant="secondary" disabled={markingAll || unreadCount === 0 || readPendingId !== null} onClick={() => void markAllRead()}>
            {markingAll ? "Saving…" : "Mark all read"}
          </Button>
        </div>
      }>
        {message ? <p className="booking-feedback" role="status">{message}</p> : null}
        {actionError ? <p className="error-text" role="alert">{actionError}</p> : null}
        {error ? (
          <ErrorState
            title={error}
            description="Try again to load your latest activity."
            retryLabel={refreshing ? "Refreshing…" : "Retry"}
            onRetry={() => void loadNotifications(true)}
          />
        ) : null}
        {!error ? (
          <ReconnectingIndicator
            state={realtime.state}
            attempts={realtime.reconnectAttempts}
            message="Live updates paused. New notifications refresh automatically."
            retrying={refreshing}
            onRetry={() => void loadNotifications(true)}
          />
        ) : null}
        {loading ? <div className="stack" aria-label="Loading notifications">{[0, 1, 2].map((row) => <Skeleton className="notification-skeleton-row" key={row} />)}</div> : null}
        {!loading && !error && items.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description={`Updates about your ${words.tripsWord} will appear here.`}
            action={<Link className="ui-button" data-variant="primary" href="/">{`Book a ${words.tripWord}`}</Link>}
          />
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <div className="notification-list">
            {items.map((notification) => (
              <article className="notification-row" key={notification.id} data-read={notification.read || undefined}>
                <span className={notification.read ? "notification-read-dot is-read" : "notification-read-dot"} aria-hidden="true" />
                <div className="notification-row-copy">
                  <div className="notification-row-heading">
                    <strong>{notification.title}</strong>
                    <span className={notification.read ? "badge" : "badge notification-unread-badge"}>{notification.read ? "Read" : "Unread"}</span>
                  </div>
                  <p>{notification.message}</p>
                  <DateTime className="helper" value={notification.createdTime} />
                </div>
                {!notification.read ? (
                  <Button variant="ghost" size="sm" disabled={readPendingId === notification.id || markingAll} onClick={() => void markRead(notification.id)}>
                    {readPendingId === notification.id ? "Saving…" : "Mark read"}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
        {lastSyncAt && realtime.state !== "error" && realtime.state !== "reconnecting" ? <p className="helper notification-sync-note">Updated <DateTime value={lastSyncAt} /></p> : null}
      </Section>
    </main>
  );
}
