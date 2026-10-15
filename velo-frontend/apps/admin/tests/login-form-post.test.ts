import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/auth/login/route";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VELO_AUTH_COOKIE_SECURE", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubUpstream(status: number, body: unknown) {
  const mock = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function formPost(fields: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:4100/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

describe("admin login route — pre-hydration form post", () => {
  it("redirects with a session cookie and never puts the password in the URL", async () => {
    stubUpstream(200, { data: { token: "tok", refreshToken: "ref", userId: 1, role: "ADMIN" } });

    const response = await POST(formPost({ email: "admin@velo.dev", password: "hunter2", next: "/users" }));

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/users");
    expect(location).not.toContain("hunter2");
    expect(location).not.toContain("password");
    expect(response.cookies.get("velo_admin_token")?.value).toBe("tok");
  });

  it("redirects a failed login with an error code and no reflected message", async () => {
    stubUpstream(401, { error: "Invalid email or password." });

    const response = await POST(formPost({ email: "admin@velo.dev", password: "hunter2" }));

    const location = response.headers.get("location") ?? "";
    expect(response.status).toBe(303);
    expect(new URL(location).pathname).toBe("/login");
    expect(location).toContain("error=invalid_credentials");
    expect(location).not.toContain("Invalid");
    expect(location).not.toContain("hunter2");
  });

  it("redirects an unauthorized role with not_authorized", async () => {
    stubUpstream(200, { data: { token: "tok", refreshToken: "ref", userId: 1, role: "RIDER" } });

    const response = await POST(formPost({ email: "rider@velo.dev", password: "hunter2" }));

    const location = response.headers.get("location") ?? "";
    expect(response.status).toBe(303);
    expect(new URL(location).pathname).toBe("/login");
    expect(location).toContain("error=not_authorized");
  });

  it("rejects a cross-site form post before reaching the backend", async () => {
    const fetchMock = stubUpstream(200, { data: { token: "tok", refreshToken: "ref", userId: 1, role: "ADMIN" } });

    const response = await POST(
      formPost({ email: "victim@velo.dev", password: "hunter2" }, { "sec-fetch-site": "cross-site" }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the hydrated JSON fetch path working", async () => {
    stubUpstream(200, { data: { token: "tok", refreshToken: "ref", userId: 1, role: "ADMIN" } });

    const request = new NextRequest("http://localhost:4100/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@velo.dev", password: "hunter2" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.cookies.get("velo_admin_token")?.value).toBe("tok");
  });
});
