import { getErrorMessage, isRecordLike } from "./http-payload";

function extractTicket(payload: unknown): string | null {
  if (!isRecordLike(payload)) {
    return null;
  }

  const data = isRecordLike(payload.data) ? payload.data : null;
  const ticket = typeof payload.ticket === "string" ? payload.ticket : data?.ticket;
  return typeof ticket === "string" && ticket.trim() ? ticket : null;
}

export async function fetchWebSocketTicket(fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl("/api/auth/ws-ticket", {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload) ?? "Unable to create WebSocket ticket.");
  }

  const ticket = extractTicket(payload);
  if (!ticket) {
    throw new Error("Authentication service returned an invalid WebSocket ticket.");
  }
  return ticket;
}
