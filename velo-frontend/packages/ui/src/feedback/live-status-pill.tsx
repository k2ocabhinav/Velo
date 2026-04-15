import type { CSSProperties } from "react";
import { Spinner } from "./spinner";

export type LiveStatusState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

type LiveStatusTone = {
  background: string;
  border: string;
  text: string;
  dot: string;
};

const toneByState: Record<LiveStatusState, LiveStatusTone> = {
  idle: {
    background: "hsl(210 15% 95%)",
    border: "hsl(210 12% 82%)",
    text: "hsl(210 12% 30%)",
    dot: "hsl(210 10% 50%)",
  },
  connecting: {
    background: "hsl(220 100% 96%)",
    border: "hsl(220 100% 86%)",
    text: "hsl(220 78% 35%)",
    dot: "hsl(220 80% 52%)",
  },
  connected: {
    background: "hsl(142 71% 95%)",
    border: "hsl(142 60% 80%)",
    text: "hsl(142 72% 28%)",
    dot: "hsl(142 71% 40%)",
  },
  reconnecting: {
    background: "hsl(38 92% 95%)",
    border: "hsl(38 92% 80%)",
    text: "hsl(32 82% 32%)",
    dot: "hsl(38 92% 50%)",
  },
  error: {
    background: "hsl(0 84% 95%)",
    border: "hsl(0 84% 82%)",
    text: "hsl(0 78% 38%)",
    dot: "hsl(0 84% 60%)",
  },
};

const defaultLabelByState: Record<LiveStatusState, string> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  error: "Connection issue",
};

const containerStyleBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const dotStyleBase: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};

type LiveStatusPillProps = {
  state: LiveStatusState;
  label?: string;
  ariaLabel?: string;
};

export function LiveStatusPill({ state, label, ariaLabel }: LiveStatusPillProps) {
  const tone = toneByState[state];
  const text = label ?? defaultLabelByState[state];
  const showSpinner = state === "connecting" || state === "reconnecting";

  return (
    <span
      aria-live="polite"
      aria-label={ariaLabel ?? `Live status: ${text}`}
      style={{
        ...containerStyleBase,
        background: tone.background,
        borderColor: tone.border,
        color: tone.text,
      }}
    >
      {showSpinner ? <Spinner className="size-3" aria-hidden="true" /> : <span aria-hidden="true" style={{ ...dotStyleBase, background: tone.dot }} />}
      <span>{text}</span>
    </span>
  );
}
