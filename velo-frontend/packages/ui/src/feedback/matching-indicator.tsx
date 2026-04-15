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
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid hsl(220 100% 86%)",
        background: "hsl(220 100% 97%)",
        color: "hsl(220 78% 35%)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Spinner className="size-4" aria-hidden="true" />
      <span>{label}</span>
      {expiresAtMs ? <CountdownBadge expiresAtMs={expiresAtMs} /> : null}
    </div>
  );
}
