import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performLoginProxy } from "../app/login/_lib/auth";

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

describe("driver performLoginProxy", () => {
  it("sets httpOnly session cookies compatible with local HTTP on success", async () => {
    const response = await performLoginProxy(
      { email: "bob.driver@example.com", password: "password123" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            refreshToken: "refresh-123",
            userId: 2,
            email: "bob.driver@example.com",
            role: "DRIVER",
          },
          error: "",
          statusCode: 200,
        }),
    );

    expect(response.status).toBe(200);

    const cookies = (response as unknown as {
      cookies?: { getAll: () => Array<{ name: string; value: string }> };
    }).cookies?.getAll() ?? [];

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_driver_token", value: "token-123" }),
        expect.objectContaining({ name: "velo_driver_refresh", value: "refresh-123", httpOnly: true, secure: false, sameSite: "lax", path: "/api" }),
        expect.objectContaining({ name: "velo_driver_user_id", value: "2" }),
        expect.objectContaining({ name: "velo_driver_role_hint", value: "DRIVER" }),
      ]),
    );

    const body = await response.json();
    expect(body.data.token).toBeUndefined();
    expect(body.data.refreshToken).toBeUndefined();
    expect(body.data.userId).toBe(2);
  });

  it("rejects users from a different workspace role", async () => {
    const response = await performLoginProxy(
      { email: "alice@example.com", password: "password123" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            refreshToken: "refresh-123",
            userId: 2,
            email: "alice@example.com",
            role: "RIDER",
          },
          error: "",
          statusCode: 200,
        }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This account is not authorized for the driver workspace.",
    });
  });

  it("maps network errors to 502", async () => {
    const response = await performLoginProxy(
      { email: "bob.driver@example.com", password: "password123" },
      async () => {
        throw new Error("ECONNRESET");
      },
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to contact authentication service.",
    });
  });

  it("maps timeout-like failures to 504", async () => {
    const timeoutError = new Error("timed out");
    timeoutError.name = "TimeoutError";

    const response = await performLoginProxy(
      { email: "bob.driver@example.com", password: "password123" },
      async () => {
        throw timeoutError;
      },
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "Login request timed out.",
    });
  });

  it("rejects successful responses without a token", async () => {
    const response = await performLoginProxy(
      { email: "bob.driver@example.com", password: "password123" },
      async () =>
        createJsonResponse({
          data: {
            userId: 2,
            email: "bob.driver@example.com",
            role: "DRIVER",
          },
          error: "",
          statusCode: 200,
        }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service returned an invalid session response.",
    });
  });
});
