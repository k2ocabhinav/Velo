import { describe, expect, it } from "vitest";
import { performLoginProxy } from "../app/login/_lib/auth";

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("performLoginProxy", () => {
  it("sets secure session cookies on success", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () =>
        createJsonResponse({
          data: {
            token: "token-123",
            userId: 42,
            email: "admin@velo.dev",
            role: "ADMIN"
          },
          error: "",
          statusCode: 200
        })
    );

    expect(response.status).toBe(200);

    const cookies = (response as unknown as {
      cookies?: { getAll: () => Array<{ name: string; value: string }> };
    }).cookies?.getAll() ?? [];

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "velo_token", value: "token-123" }),
        expect.objectContaining({ name: "velo_user_id", value: "42" })
      ])
    );
  });

  it("returns a safe error for non-json upstream failures", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () =>
        new Response("gateway down", {
          status: 502,
          headers: {
            "content-type": "text/plain"
          }
        })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "Unable to sign in." });
  });

  it("maps network outages to 502", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () => {
        throw new Error("ECONNRESET");
      }
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to contact authentication service."
    });
  });

  it("maps timeout-like failures to 504", async () => {
    const timeoutError = new Error("timed out");
    timeoutError.name = "TimeoutError";

    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () => {
        throw timeoutError;
      }
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "Login request timed out."
    });
  });

  it("rejects successful responses without a token", async () => {
    const response = await performLoginProxy(
      { email: "admin@velo.dev", password: "secret" },
      async () =>
        createJsonResponse({
          data: {
            userId: 42,
            email: "admin@velo.dev",
            role: "ADMIN"
          },
          error: "",
          statusCode: 200
        })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service returned an invalid session response."
    });
  });
});
