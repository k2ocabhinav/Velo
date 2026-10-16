import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  LOGIN_ROLE_COOKIE_NAME,
  clearLoginCookies,
  performLoginProxy,
  performLogoutProxy,
  performRefreshProxy,
  performRegisterProxy,
  performWebSocketTicketProxy,
} from "../src/auth";
import { TENANT_SLUG_HEADER } from "../src/tenant";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VELO_AUTH_COOKIE_SECURE", "false");
});

afterEach(() => vi.unstubAllEnvs());

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("performLoginProxy", () => {
  it("rejects workspace login when required role hint mismatches", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            refreshToken: "refresh-123",
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
            refreshToken: "refresh-123",
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
      async () => createJsonResponse({ data: { token: "token-123", refreshToken: "refresh-123", userId: 42, role: "RIDER" } }),
    );

    expect(response.cookies.get("velo_token")?.httpOnly).toBe(true);
    expect(response.cookies.get("velo_token")?.secure).toBe(true);
  });

  it("disables Secure only for explicitly enabled local demo hosts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VELO_INSECURE_LOCAL_COOKIES", "1");

    const localResponse = await performLoginProxy(
      { email: "user@velo.dev", password: "secret" },
      async () => createJsonResponse({ data: { token: "token-local", refreshToken: "refresh-local", userId: 42 } }),
      { requestHost: "default.localhost:6701" },
    );
    const remoteResponse = await performLoginProxy(
      { email: "user@velo.dev", password: "secret" },
      async () => createJsonResponse({ data: { token: "token-remote", refreshToken: "refresh-remote", userId: 42 } }),
      { requestHost: "demo.example.com" },
    );

    expect(localResponse.cookies.get("velo_token")?.secure).toBe(false);
    expect(remoteResponse.cookies.get("velo_token")?.secure).toBe(true);
  });

  it("allows secure cookies to be enabled for local HTTPS", async () => {
    vi.stubEnv("VELO_AUTH_COOKIE_SECURE", "true");

    const response = await performLoginProxy(
      { email: "user@velo.dev", password: "secret" },
      async () => createJsonResponse({ data: { token: "token-123", refreshToken: "refresh-123", userId: 42 } }),
    );

    expect(response.cookies.get("velo_token")?.secure).toBe(true);
  });
});

describe("performRegisterProxy", () => {
  it("forwards the BFF-resolved tenant slug as the signup tenant header", async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({ data: { userId: 1 } }, 201));

    await performRegisterProxy(
      { name: "Rae", email: "rae@example.com", password: "hunter2" },
      fetchMock as unknown as typeof fetch,
      "saffron-routes",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/signup$/);
    expect((init.headers as Record<string, string>)[TENANT_SLUG_HEADER]).toBe("saffron-routes");
  });

  it("omits the tenant header when no slug is supplied", async () => {
    const fetchMock = vi.fn(async () => createJsonResponse({ data: { userId: 1 } }, 201));

    await performRegisterProxy(
      { name: "Rae", email: "rae@example.com", password: "hunter2" },
      fetchMock as unknown as typeof fetch,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)[TENANT_SLUG_HEADER]).toBeUndefined();
  });
});

describe("logout cookie cleanup", () => {
  it("clears session cookies from logout proxy response", async () => {
    const response = await performLogoutProxy();
    const cookies = response.cookies.getAll();

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_token", value: "" }),
        expect.objectContaining({ name: "velo_refresh_token", value: "" }),
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
        expect.objectContaining({ name: "velo_refresh_token", value: "" }),
        expect.objectContaining({ name: "velo_user_id", value: "" }),
        expect.objectContaining({ name: LOGIN_ROLE_COOKIE_NAME, value: "" }),
      ]),
    );
  });

  it("revokes the backend refresh family before clearing cookies", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse({ data: { message: "Logged out" } }));
    const response = await performLogoutProxy("refresh-current", {
      tokenCookieName: "velo_test_token",
      refreshCookieName: "velo_test_refresh"
    }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/logout$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-current" }),
        cache: "no-store"
      })
    );
    expect(response.cookies.get("velo_test_refresh")).toEqual(
      expect.objectContaining({ value: "", path: "/api", httpOnly: true, secure: false, sameSite: "lax" })
    );
  });
});

describe("refresh BFF", () => {
  it("rotates cookies and never returns either token to browser JavaScript", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse({
      data: {
        token: "access-next",
        refreshToken: "refresh-next",
        userId: 8,
        role: "RIDER",
        expiresInSeconds: 900
      }
    }));
    const response = await performRefreshProxy("refresh-current", {
      tokenCookieName: "velo_rider_token",
      refreshCookieName: "velo_rider_refresh",
      userIdCookieName: "velo_rider_user_id",
      roleCookieName: "velo_rider_role_hint"
    }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-current" }),
        cache: "no-store"
      })
    );
    expect(response.cookies.get("velo_rider_token")?.value).toBe("access-next");
    expect(response.cookies.get("velo_rider_refresh")).toEqual(
      expect.objectContaining({ value: "refresh-next", path: "/api", httpOnly: true, secure: false, sameSite: "lax" })
    );
    const body = await response.json();
    expect(body.data.token).toBeUndefined();
    expect(body.data.refreshToken).toBeUndefined();
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
