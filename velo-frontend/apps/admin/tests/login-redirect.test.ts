import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { sanitizeNextPath } from "../app/login/_lib/auth";

describe("login redirect safety", () => {
  it("keeps internal paths and rejects external urls", () => {
    expect(sanitizeNextPath("/drivers?tab=pending")).toBe("/drivers?tab=pending");
    expect(sanitizeNextPath("https://evil.example/login")).toBe("/");
    expect(sanitizeNextPath("//evil.example/login")).toBe("/");
    expect(sanitizeNextPath("   ")).toBe("/");
  });

  it("redirects unauthenticated users with a safe next path", () => {
    const request = new NextRequest("http://localhost:3000/drivers?tab=pending");
    const response = middleware(request);

    expect(response.status).toBe(307);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();

    const redirect = new URL(location ?? "");
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("next")).toBe("/drivers?tab=pending");
  });
});
