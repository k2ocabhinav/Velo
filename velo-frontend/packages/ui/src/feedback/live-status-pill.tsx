import { Spinner } from "./spinner";

export type LiveStatusState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const defaultLabelByState: Record<LiveStatusState, string> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  error: "Connection issue",
};

type LiveStatusPillProps = {
  state: LiveStatusState;
  label?: string;
  ariaLabel?: string;
};

export function LiveStatusPill({ state, label, ariaLabel }: LiveStatusPillProps) {
  const text = label ?? defaultLabelByState[state];
  const showSpinner = state === "connecting" || state === "reconnecting";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={ariaLabel ?? `Live status: ${text}`}
      className="live-status-pill"
      data-state={state}
    >
      {showSpinner ? <Spinner className="ui-spinner-sm" aria-hidden="true" /> : <span className="live-status-dot" aria-hidden="true" />}
      <span>{text}</span>
    </span>
  );
}
