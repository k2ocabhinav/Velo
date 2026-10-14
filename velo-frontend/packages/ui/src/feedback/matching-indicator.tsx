import { Spinner } from "./spinner";
import { CountdownBadge } from "./countdown-badge";

type MatchingIndicatorProps = {
  label: string;
  expiresAtMs?: number | null;
};

export function MatchingIndicator({ label, expiresAtMs }: MatchingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="matching-indicator"
    >
      <Spinner className="ui-spinner-md" aria-hidden="true" />
      <span>{label}</span>
      {expiresAtMs ? <CountdownBadge expiresAtMs={expiresAtMs} /> : null}
    </div>
  );
}
