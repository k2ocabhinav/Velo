import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  LOGIN_ROLE_COOKIE_NAME,
  clearLoginCookies,
  performLoginProxy,
  performLogoutProxy,
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
