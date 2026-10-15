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
  it("signs up, onboards and redirects to login without leaking the password", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/signup")) {
        return new Response(JSON.stringify({ data: { userId: 9 } }), {
          status: 201,
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
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("redirects a failed signup with an error code and no reflected message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Email already registered." }), {
          status: 409,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const response = await POST(
      formPost({ name: "Dana", email: "dana@example.com", password: "hunter2", vehicleId: "KA-01-1234" }),
    );

    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/register");
    expect(location).toContain("error=email_in_use");
    expect(location).not.toContain("already+registered");
    expect(location).not.toContain("hunter2");
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
