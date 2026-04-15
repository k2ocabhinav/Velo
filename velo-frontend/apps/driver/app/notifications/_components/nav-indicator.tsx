"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LiveStatusPill } from "@velo/ui/feedback";
import { requestDriverProxy } from "../../_lib/driver-client";

const REFRESH_INTERVAL_MS = 30_000;

type SyncState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

function toClockLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString();
}

export function DriverNotificationsNavIndicator() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadUnreadCount = useCallback(async (background = false) => {
    if (background) {
      setSyncState((current) => (current === "connected" ? "reconnecting" : "connecting"));
    } else {
      setLoading(true);
      setSyncState("connecting");
    }

    try {
      const unread = await requestDriverProxy<number>("notifications/unread-count");
      setUnreadCount(Number.isFinite(unread) ? unread : 0);
      setSyncState("connected");
      setLastSyncAt(new Date().toISOString());
    } catch {
      setSyncState("error");
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

  const hasUnread = unreadCount > 0;
  const badgeToneStyle = hasUnread
    ? { background: "hsl(220 72% 50%)", color: "white", borderColor: "hsl(220 72% 50%)" }
    : undefined;

  const pillLabel = useMemo(() => {
    if (syncState !== "connected") {
      return undefined;
    }
    const label = toClockLabel(lastSyncAt);
    return label ? `Live ${label}` : "Live";
  }, [lastSyncAt, syncState]);

  if (loading && syncState !== "error") {
    return <LiveStatusPill state="connecting" label="Checking" ariaLabel="Checking unread notifications" />;
  }

  return (
    <span className="lane-status-row" aria-live="polite">
      <span className="badge" style={badgeToneStyle}>
        {hasUnread ? `${unreadCount} unread` : "No unread"}
      </span>
      <LiveStatusPill state={syncState} label={pillLabel} />
    </span>
  );
}
