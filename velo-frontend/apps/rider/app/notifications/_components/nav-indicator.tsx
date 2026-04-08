"use client";

import { useCallback, useEffect, useState } from "react";
import { requestRiderProxy } from "../../_lib/rider-client";

const REFRESH_INTERVAL_MS = 30_000;

type SyncState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString();
}

function getIndicatorText(state: SyncState, lastSyncAt: string | null, hasError: boolean): string {
  if (state === "error") {
    return hasError ? "Unread unavailable. Retrying..." : "Unread unavailable.";
  }

  if (state === "reconnecting") {
    return "Updating unread count...";
  }

  if (state === "connecting") {
    return "Checking unread...";
  }

  if (state === "connected") {
    return lastSyncAt ? `Updated ${formatTimestamp(lastSyncAt)}` : "Unread count is current.";
  }

  return "Unread status idle.";
}

export function NotificationsNavIndicator() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadUnreadCount = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
      setSyncState((current) => (current === "connected" ? "reconnecting" : "connecting"));
    } else {
      setLoading(true);
      setSyncState("connecting");
    }

    try {
      const unread = await requestRiderProxy<number>("notifications/unread-count");
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
      setHasError(false);
      setSyncState("connected");
      setLastSyncAt(new Date().toISOString());
    } catch {
      setHasError(true);
      setSyncState("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount(false);

    const intervalId = window.setInterval(() => {
      void loadUnreadCount(true);
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
  const indicatorText = getIndicatorText(syncState, lastSyncAt, hasError);
  return (
    <span className="stack compact" aria-live="polite" style={{ alignItems: "end" }}>
      <span
        className="badge"
        style={hasUnread ? { background: "hsl(220 72% 50%)", color: "white", borderColor: "hsl(220 72% 50%)" } : undefined}
      >
        {hasUnread ? `${unreadCount} unread` : "No unread"}
      </span>
      <span className={hasError ? "error-text" : "helper"} style={{ fontSize: "12px", textAlign: "right" }}>
        {indicatorText}
      </span>
      {refreshing ? <span className="helper" style={{ fontSize: "12px", textAlign: "right" }}>Refreshing...</span> : null}
    </span>
  );
}
