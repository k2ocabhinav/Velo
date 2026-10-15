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
  return new NextRequest("http://localhost:4101/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

describe("driver login route — pre-hydration form post", () => {
  it("redirects with a session cookie and never puts the password in the URL", async () => {
    stubUpstream(200, { data: { token: "tok", refreshToken: "ref", userId: 2, role: "DRIVER" } });

    const response = await POST(formPost({ email: "driver@example.com", password: "hunter2", next: "/earnings" }));

    expect(response.status).toBe(303);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/earnings");
    expect(location).not.toContain("hunter2");
    expect(response.cookies.get("velo_driver_token")?.value).toBe("tok");
  });

  it("redirects a failed login with an error code and no reflected message", async () => {
    stubUpstream(401, { error: "Invalid email or password." });

    const response = await POST(formPost({ email: "driver@example.com", password: "hunter2" }));

    const location = response.headers.get("location") ?? "";
    expect(response.status).toBe(303);
    expect(new URL(location).pathname).toBe("/login");
    expect(location).toContain("error=invalid_credentials");
    expect(location).not.toContain("Invalid");
    expect(location).not.toContain("hunter2");
  });

  it("rejects a cross-site form post before reaching the backend", async () => {
    const fetchMock = stubUpstream(200, { data: { token: "tok", refreshToken: "ref", userId: 2, role: "DRIVER" } });

    const response = await POST(
      formPost({ email: "victim@example.com", password: "hunter2" }, { "sec-fetch-site": "cross-site" }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
