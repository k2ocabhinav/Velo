"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@velo/ui";
import { requestRiderProxy } from "../../_lib/rider-client";

const REFRESH_INTERVAL_MS = 30_000;

export function NotificationsNavIndicator() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    try {
      const unread = await requestRiderProxy<number>("notifications/unread-count");
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const intervalId = window.setInterval(() => void loadUnreadCount(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadUnreadCount]);

  if (loading) {
    return <Skeleton className="notification-bell-skeleton" aria-label="Loading notifications" />;
  }

  const label = failed
    ? "Notifications, unread count unavailable"
    : `Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`;

  return (
    <Link
      className="notification-bell"
      href="/notifications"
      aria-label={label}
      data-failed={failed || undefined}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      {failed ? <span className="notification-count notification-count-error">!</span> : unreadCount > 0 ? (
        <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
      ) : null}
    </Link>
  );
}
