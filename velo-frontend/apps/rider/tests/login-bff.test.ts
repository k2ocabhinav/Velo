import { describe, expect, it } from "vitest";
import { performLoginProxy } from "../app/login/_lib/auth";

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("rider performLoginProxy", () => {
  it("sets auth cookies for rider workspace", async () => {
    const response = await performLoginProxy(
      { email: "alice@example.com", password: "password123" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            refreshToken: "refresh-123",
            userId: 5,
            email: "alice@example.com",
            role: "RIDER",
          },
          error: "",
          statusCode: 200,
        }),
    );

    expect(response.status).toBe(200);
    const cookies = response.cookies.getAll();
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_rider_token", value: "token-123" }),
        expect.objectContaining({ name: "velo_rider_refresh", value: "refresh-123", httpOnly: true, secure: true, sameSite: "lax", path: "/api" }),
        expect.objectContaining({ name: "velo_rider_user_id", value: "5" }),
        expect.objectContaining({ name: "velo_rider_role_hint", value: "RIDER" }),
      ]),
    );
  });

  it("rejects users from a different workspace role", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            refreshToken: "refresh-123",
            userId: 1,
            email: "admin@velo.dev",
            role: "ADMIN",
          },
          error: "",
          statusCode: 200,
        }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "This account is not authorized for the rider workspace.",
    });
  });
});
