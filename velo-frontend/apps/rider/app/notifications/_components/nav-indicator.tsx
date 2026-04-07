"use client";

import { useCallback, useEffect, useState } from "react";
import { requestRiderProxy } from "../../_lib/rider-client";

const REFRESH_INTERVAL_MS = 30_000;

export function NotificationsNavIndicator() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    try {
      const unread = await requestRiderProxy<number>("notifications/unread-count");
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();

    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadUnreadCount]);

  if (hasError) {
    return <span className="helper">Unread unavailable</span>;
  }

  if (loading) {
    return <span className="helper">Checking unread…</span>;
  }

  const hasUnread = (unreadCount ?? 0) > 0;
  return (
    <span
      className="badge"
      aria-live="polite"
      style={hasUnread ? { background: "hsl(220 72% 50%)", color: "white", borderColor: "hsl(220 72% 50%)" } : undefined}
    >
      {hasUnread ? `${unreadCount} unread` : "No unread"}
    </span>
  );
}
