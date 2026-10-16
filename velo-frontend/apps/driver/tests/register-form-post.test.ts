import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/register/route";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function formPost(fields: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:4101/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

describe("driver register route — pre-hydration form post", () => {
  it("signs up, authenticates, onboards and redirects to login without leaking the password", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/signup")) {
        return new Response(JSON.stringify({ data: { userId: 9 } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/auth/login")) {
        return new Response(JSON.stringify({ data: { token: "onboard-token", refreshToken: "refresh", userId: 9 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      formPost({
        name: "Dana",
        email: "dana@example.com",
        password: "hunter2",
        vehicleId: "KA-01-1234",
      }),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/login");
    expect(location).not.toContain("hunter2");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/onBoardNewDriver\/9$/),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer onboard-token" }),
      }),
    );
  });

  it("recovers a duplicate signup after authenticating and retries onboarding", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/signup")) {
        return new Response(JSON.stringify({ error: "Email already registered." }), { status: 409 });
      }
      if (url.includes("/auth/login")) {
        return new Response(JSON.stringify({ data: { token: "retry-token", userId: 9 } }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      formPost({ name: "Dana", email: "dana@example.com", password: "hunter2", vehicleId: "KA-01-1234" }),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/login");
    expect(location).not.toContain("hunter2");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/onBoardNewDriver\/9$/),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer retry-token" }) }),
    );
  });

  it("does not resume duplicate registration with an invalid password", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/auth/signup")
      ? new Response(JSON.stringify({ error: "Email already registered." }), { status: 409 })
      : new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      formPost({ name: "Dana", email: "dana@example.com", password: "wrong", vehicleId: "KA-01-1234" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=invalid_credentials");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a cross-site form post before reaching the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      formPost(
        { name: "Dana", email: "dana@example.com", password: "hunter2", vehicleId: "KA-01-1234" },
        { "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
