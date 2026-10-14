import { Spinner } from "./spinner";
import type { LiveStatusState } from "./live-status-pill";
import { cn } from "../lib/cn";

type ReconnectingIndicatorProps = {
  state: LiveStatusState;
  attempts?: number;
  message?: string;
  retryLabel?: string;
  retrying?: boolean;
  onRetry?: () => void;
  className?: string;
};

/** Shared live-connection notice for views that can refresh through the API. */
export function ReconnectingIndicator({
  attempts = 0,
  className,
  message = "Live updates paused. Background refresh continues.",
  onRetry,
  retryLabel = "Retry",
  retrying = false,
  state,
}: ReconnectingIndicatorProps) {
  if (state !== "reconnecting" && state !== "error") return null;

  const reconnecting = state === "reconnecting";
  const label = reconnecting
    ? `Reconnecting…${attempts > 0 ? ` Attempt ${attempts}.` : ""}`
    : message;

  return (
    <div
      className={cn("reconnecting-indicator", className)}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      {reconnecting ? <Spinner className="ui-spinner-sm" aria-hidden="true" /> : null}
      <span>{retrying ? `${label} Refreshing…` : label}</span>
      {onRetry ? (
        <button className="ui-button" data-variant="secondary" type="button" onClick={onRetry} disabled={retrying}>
          {retrying ? "Refreshing…" : retryLabel}
        </button>
      ) : null}
    </div>
  );
}
