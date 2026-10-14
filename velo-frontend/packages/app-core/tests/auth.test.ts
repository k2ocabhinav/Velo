import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  LOGIN_ROLE_COOKIE_NAME,
  clearLoginCookies,
  performLoginProxy,
  performLogoutProxy,
  performWebSocketTicketProxy,
} from "../src/auth";

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("performLoginProxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects workspace login when required role hint mismatches", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            userId: 42,
            role: "DRIVER",
          },
        }),
      {
        requiredRoleHint: "ADMIN",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This account is not authorized for this workspace.",
    });
  });

  it("keeps login successful when role hint is absent (non-authoritative fallback)", async () => {
    const response = await performLoginProxy(
      { email: "user@velo.dev", password: "secret" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            userId: 42,
          },
        }),
      {
        requiredRoleHint: "ADMIN",
      },
    );

    expect(response.status).toBe(200);
    const roleCookie = response.cookies.get(LOGIN_ROLE_COOKIE_NAME);
    expect(roleCookie?.value).toBe("");
    await expect(response.json()).resolves.toEqual({
      data: { userId: 42 },
    });
  });

  it("keeps authentication cookies secure in production even when explicitly disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VELO_AUTH_COOKIE_SECURE", "false");

    const response = await performLoginProxy(
      { email: "user@velo.dev", password: "secret" },
      async () => createJsonResponse({ data: { token: "token-123", userId: 42, role: "RIDER" } }),
    );

    expect(response.cookies.get("velo_token")?.httpOnly).toBe(true);
    expect(response.cookies.get("velo_token")?.secure).toBe(true);
  });
});

describe("logout cookie cleanup", () => {
  it("clears session cookies from logout proxy response", () => {
    const response = performLogoutProxy();
    const cookies = response.cookies.getAll();

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_token", value: "" }),
        expect.objectContaining({ name: "velo_user_id", value: "" }),
        expect.objectContaining({ name: LOGIN_ROLE_COOKIE_NAME, value: "" }),
      ]),
    );
  });

  it("supports clearing auth cookies on existing response objects", () => {
    const response = NextResponse.json({ ok: true });
    clearLoginCookies(response);
    const cookies = response.cookies.getAll();

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_token", value: "" }),
        expect.objectContaining({ name: "velo_user_id", value: "" }),
        expect.objectContaining({ name: LOGIN_ROLE_COOKIE_NAME, value: "" }),
      ]),
    );
  });
});

describe("WebSocket ticket BFF", () => {
  it("uses the httpOnly session token and returns a non-cacheable ticket", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({ data: { ticket: "ws-ticket", expiresInSeconds: 60 } })
    );
    const response = await performWebSocketTicketProxy("access-cookie-token", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/ws-ticket$/),
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({ Authorization: "Bearer access-cookie-token" })
      })
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { ticket: "ws-ticket", expiresInSeconds: 60 }
    });
  });

  it("does not call the backend without a session cookie", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const response = await performWebSocketTicketProxy(null, fetchMock);

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
