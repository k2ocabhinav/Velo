"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@velo/ui/feedback";
import { requestDriverProxy } from "../../_lib/driver-client";

const REFRESH_INTERVAL_MS = 30_000;

export function DriverNotificationsNavIndicator() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadUnreadCount = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }
    setError(false);

    try {
      const unread = await requestDriverProxy<number>("notifications/unread-count");
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();

    const intervalId = window.setInterval(() => {
      void loadUnreadCount(true);
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadUnreadCount]);

  return (
    <div className="driver-notification-control">
      <Link
        className="driver-notification-link"
        href="/notifications"
        aria-label={loading ? "Notifications, checking unread count" : `Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {loading ? <Skeleton className="driver-notification-skeleton" /> : null}
        {unreadCount > 0 ? <span className="driver-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </Link>
      {error ? (
        <div className="driver-notification-error" role="alert">
          <span>Unread count unavailable</span>
          <button type="button" onClick={() => void loadUnreadCount()} aria-label="Retry unread notifications">Retry</button>
        </div>
      ) : null}
    </div>
  );
}
