import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "../app/login/_lib/auth";
import { middleware } from "../middleware";

describe("driver login redirect safety", () => {
  it("keeps internal paths and blocks external redirects", () => {
    expect(sanitizeNextPath("/ride/12?tab=status")).toBe("/ride/12?tab=status");
    expect(sanitizeNextPath("https://evil.example/phish")).toBe("/");
    expect(sanitizeNextPath("//evil.example/phish")).toBe("/");
    expect(sanitizeNextPath("   ")).toBe("/");
  });

  it("redirects unauthenticated protected paths to login with safe next", () => {
    const request = new NextRequest("http://localhost:3002/ride/12?tab=status");
    const response = middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirect = new URL(location ?? "");
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("next")).toBe("/ride/12?tab=status");
  });
});
