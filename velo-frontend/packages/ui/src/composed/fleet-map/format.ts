export function formatFleetLastUpdate(
  value: string | null | undefined,
  stale = false,
  now = Date.now(),
): string {
  if (!value) return "Last seen time unavailable";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Last seen time unavailable";

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  const age = seconds < 60 ? `${seconds} s ago` : `${Math.floor(seconds / 60)} min ago`;
  return `${stale ? "Last seen" : "Updated"} ${age}`;
}
