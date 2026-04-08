export type RiderWsConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export function getRiderRealtimeStatusText(
  state: RiderWsConnectionState,
  reconnectAttempts: number,
): string {
  if (state === "connected") {
    return "Live updates connected.";
  }

  if (state === "connecting") {
    return "Connecting to live updates...";
  }

  if (state === "reconnecting") {
    return reconnectAttempts > 0
      ? `Reconnecting to live updates (attempt ${reconnectAttempts})...`
      : "Reconnecting to live updates...";
  }

  if (state === "error") {
    return "Live updates are degraded. The page will continue using API refreshes.";
  }

  return "Live updates are idle.";
}
