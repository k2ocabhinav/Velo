import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWebSocketTicket } from "../src/ws-ticket";

describe("fetchWebSocketTicket", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches a fresh ticket through the same-origin BFF on each call", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ticket: "first-ticket", expiresInSeconds: 60 } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ticket: "second-ticket", expiresInSeconds: 60 } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWebSocketTicket()).resolves.toBe("first-ticket");
    await expect(fetchWebSocketTicket()).resolves.toBe("second-ticket");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/ws-ticket", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store"
    }));
  });

  it("reports authorization and malformed ticket responses", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "Authentication is required." }), { status: 401 })
    ));
    await expect(fetchWebSocketTicket()).rejects.toThrow("Authentication is required.");

    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    ));
    await expect(fetchWebSocketTicket()).rejects.toThrow("invalid WebSocket ticket");
  });
});
