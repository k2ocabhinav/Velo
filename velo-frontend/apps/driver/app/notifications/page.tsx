"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@velo/ui/primitives";
import { DateTime, EmptyState, ErrorState, PageHeader, Section } from "@velo/ui/composed";
import { ReconnectingIndicator, Skeleton } from "@velo/ui/feedback";
import {
  requestDriverProxy,
  type DriverNotification,
  type SpringPage,
} from "../_lib/driver-client";
import {
  useDriverNotificationSubscription,
  type DriverNotificationEvent,
} from "../_lib/driver-ws";

function normalizeNotification(event: DriverNotificationEvent): DriverNotification | null {
  if (typeof event.id !== "number" || typeof event.title !== "string" || typeof event.message !== "string") return null;
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

function renderTripReferences(message: string) {
  const pattern = /\b(?:ride|trip)\s*#(\d+)\b/gi;
  const result = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    if (match.index > cursor) result.push(message.slice(cursor, match.index));
    result.push(<code className="driver-reference" key={`${match.index}-${match[1]}`}>Trip {match[1]}</code>);
    cursor = match.index + match[0].length;
  }
  if (cursor < message.length) result.push(message.slice(cursor));
  return result.length > 0 ? result : message;
}

export default function DriverNotificationsPage() {
  const [items, setItems] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await requestDriverProxy<SpringPage<DriverNotification>>("notifications?page=0&size=25");
      setItems(Array.isArray(page.content) ? page.content : []);
    } catch (loadErrorValue) {
      setLoadError(loadErrorValue instanceof Error ? loadErrorValue.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const onWsNotification = useCallback((event: DriverNotificationEvent) => {
    const normalized = normalizeNotification(event);
    if (!normalized) return;
    setItems((current) => current.some((item) => item.id === normalized.id) ? current : [normalized, ...current]);
  }, []);

  const realtime = useDriverNotificationSubscription(true, onWsNotification);
  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function markRead(id: number): Promise<void> {
    setProcessingId(id);
    setActionError(null);
    setRetryAction(null);
    setMessage(null);
    try {
      await requestDriverProxy<DriverNotification>(`notifications/${id}/read`, { method: "POST" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
      setMessage("Notification marked as read.");
    } catch (actionErrorValue) {
      setActionError(actionErrorValue instanceof Error ? actionErrorValue.message : "Unable to mark notification as read.");
      setRetryAction(() => () => { void markRead(id); });
    } finally {
      setProcessingId(null);
    }
  }

  async function markAllRead(): Promise<void> {
    setMarkingAll(true);
    setActionError(null);
    setRetryAction(null);
    setMessage(null);
    try {
      await requestDriverProxy<void>("notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setMessage("All notifications marked as read.");
    } catch (actionErrorValue) {
      setActionError(actionErrorValue instanceof Error ? actionErrorValue.message : "Unable to mark all notifications as read.");
      setRetryAction(() => () => { void markAllRead(); });
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="stack">
      <PageHeader title="Stay up to date" description="Review trip and payout updates in one place." />

      {loadError ? <ErrorState title="Couldn't load notifications" description={loadError} onRetry={() => void loadNotifications()} /> : null}
      {actionError ? (
        <ErrorState
          title="Couldn't update notifications"
          description={actionError}
          onRetry={retryAction ?? (() => void loadNotifications())}
          retryLabel="Retry"
        />
      ) : null}
      {message ? <p role="status" className="helper">{message}</p> : null}

      <Section
        title={`${unreadCount} unread`}
        actions={(
          <div className="driver-actions">
            <Button variant="secondary" disabled={loading} onClick={() => void loadNotifications()}>Refresh</Button>
            <Button disabled={markingAll || unreadCount === 0} onClick={() => void markAllRead()}>
              {markingAll ? "Marking…" : "Mark all read"}
            </Button>
          </div>
        )}
      >
        <ReconnectingIndicator
          state={realtime.state}
          attempts={realtime.reconnectAttempts}
          message="Live notifications paused. New items refresh automatically."
          onRetry={() => void loadNotifications()}
          retryLabel="Refresh notifications"
          retrying={loading}
        />
        {loading ? (
          <div className="driver-notification-list" role="status" aria-label="Loading notifications" aria-busy="true">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
          </div>
        ) : null}
        {!loading && !loadError && items.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="Trip and payout updates will appear here."
            action={<Link href="/" className="ui-button" data-variant="secondary">Back to home</Link>}
          />
        ) : null}
        {!loading && !loadError && items.length > 0 ? (
          <div className="driver-notification-list">
            {items.map((notification) => (
              <article className="driver-notification-row" key={notification.id}>
                <div className="driver-notification-copy">
                  <div className="driver-row-meta">
                    <h3>{renderTripReferences(notification.title)}</h3>
                    <span className="badge" data-tone={notification.read ? "neutral" : "attention"}>
                      {notification.read ? "Read" : "Unread"}
                    </span>
                  </div>
                  <p>{renderTripReferences(notification.message)}</p>
                  <DateTime value={notification.createdTime} />
                </div>
                {!notification.read ? (
                  <Button
                    variant="secondary"
                    disabled={processingId === notification.id}
                    onClick={() => void markRead(notification.id)}
                  >
                    {processingId === notification.id ? "Saving…" : "Mark read"}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </Section>
    </main>
  );
}
