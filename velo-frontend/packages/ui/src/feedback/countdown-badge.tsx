"use client";

import { useEffect, useMemo, useState } from "react";

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
};

export function CountdownBadge({
  expiresAtMs,
  prefix = "Expires in",
  warnAtSeconds = 15,
}: CountdownBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

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

  if (remainingSeconds === null) {
    return null;
  }

  const isExpired = remainingSeconds <= 0;
  const isWarning = remainingSeconds > 0 && remainingSeconds <= warnAtSeconds;

  const palette = isExpired
    ? {
        background: "hsl(0 84% 95%)",
        border: "hsl(0 84% 82%)",
        text: "hsl(0 78% 38%)",
      }
    : isWarning
      ? {
          background: "hsl(38 92% 95%)",
          border: "hsl(38 92% 80%)",
          text: "hsl(32 82% 32%)",
        }
      : {
          background: "hsl(220 100% 96%)",
          border: "hsl(220 100% 86%)",
          text: "hsl(220 78% 35%)",
        };

  return (
    <span
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 26,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {isExpired ? "Request expired" : `${prefix} ${formatClock(remainingSeconds)}`}
    </span>
  );
}
