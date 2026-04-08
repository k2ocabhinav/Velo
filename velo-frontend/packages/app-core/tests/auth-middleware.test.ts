import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createCookieAuthMiddleware } from "../src/auth-middleware";

function createRequest(url: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  return new NextRequest(url, { headers });
}

describe("createCookieAuthMiddleware", () => {
  const middleware = createCookieAuthMiddleware({
    publicPaths: ["/login"],
    protectedPaths: ["/"],
    redirectAuthenticatedPublicTo: "/",
    requiredRoleHint: "ADMIN",
  });

  it("allows protected access when token exists and role hint is missing", () => {
    const request = createRequest("http://localhost:3000/", "velo_token=test-token");
    const response = middleware(request);
    expect(response.status).toBe(200);
  });

  it("redirects protected access when role hint mismatches", () => {
    const request = createRequest(
      "http://localhost:3000/",
      "velo_token=test-token; velo_role_hint=DRIVER",
    );
    const response = middleware(request);
    expect(response.status).toBe(307);

    const redirect = new URL(response.headers.get("location") ?? "");
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("next")).toBe("/");
  });

  it("does not auto-redirect mismatched role from login page", () => {
    const request = createRequest(
      "http://localhost:3000/login",
      "velo_token=test-token; velo_role_hint=DRIVER",
    );
    const response = middleware(request);
    expect(response.status).toBe(200);
  });

  it("redirects authenticated users from login page when role hint matches", () => {
    const request = createRequest(
      "http://localhost:3000/login",
      "velo_token=test-token; velo_role_hint=ADMIN",
    );
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
  });
});
