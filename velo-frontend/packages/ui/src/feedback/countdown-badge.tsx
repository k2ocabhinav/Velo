"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function toTwoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatClock(remainingSeconds: number): string {
  const safe = Math.max(0, remainingSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${toTwoDigits(minutes)}:${toTwoDigits(seconds)}`;
}

function getRemainingSeconds(expiresAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

type CountdownBadgeProps = {
  expiresAtMs: number | null | undefined;
  prefix?: string;
  warnAtSeconds?: number;
  expiredLabel?: string;
  onExpire?: () => void;
};

export function CountdownBadge({
  expiresAtMs,
  prefix = "Expires in",
  warnAtSeconds = 15,
  expiredLabel = "Request expired",
  onExpire,
}: CountdownBadgeProps) {
  const [now, setNow] = useState(() => Date.now());
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!Number.isFinite(expiresAtMs)) {
      return null;
    }
    return getRemainingSeconds(Number(expiresAtMs), now);
  }, [expiresAtMs, now]);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds > 0) {
      return;
    }

    const key = Number(expiresAtMs);
    if (firedForRef.current === key) {
      return;
    }
    firedForRef.current = key;
    onExpire?.();
  }, [expiresAtMs, onExpire, remainingSeconds]);

  if (remainingSeconds === null) {
    return null;
  }

  const isExpired = remainingSeconds <= 0;
  const isWarning = remainingSeconds > 0 && remainingSeconds <= warnAtSeconds;

  return (
    <span
      aria-live="polite"
      className="status-badge countdown-badge"
      data-tone={isExpired ? "danger" : isWarning ? "attention" : "info"}
    >
      {isExpired ? expiredLabel : `${prefix} ${formatClock(remainingSeconds)}`}
    </span>
  );
}
