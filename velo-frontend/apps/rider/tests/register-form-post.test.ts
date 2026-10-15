import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/register/route";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VELO_AUTH_COOKIE_SECURE", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function formPost(fields: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:4102/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

describe("rider register route — pre-hydration form post", () => {
  it("redirects to login without leaking the password on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { userId: 5 } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const response = await POST(
      formPost({ name: "Rae", email: "rae@example.com", password: "hunter2", next: "/wallet" }),
    );

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/login");
    expect(location).not.toContain("hunter2");
  });

  it("redirects a failed registration with an error code and no reflected message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Email already registered." }), {
          status: 409,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const response = await POST(formPost({ name: "Rae", email: "rae@example.com", password: "hunter2" }));

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
      formPost({ name: "Rae", email: "rae@example.com", password: "hunter2" }, { "sec-fetch-site": "cross-site" }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
