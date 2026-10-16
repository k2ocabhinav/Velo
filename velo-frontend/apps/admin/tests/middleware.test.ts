import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../middleware";

function request(path: string, cookieHeader?: string): NextRequest {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  return new NextRequest(`http://admin.velo.test${path}`, { headers });
}

const adminCookie = "velo_admin_token=token; velo_admin_role_hint=ADMIN";

describe("admin middleware route protection", () => {
  it.each(["/trip-sheet", "/recurring-trips"])(
    "redirects an unauthenticated visitor from %s to login",
    (path) => {
      const response = middleware(request(path));
      expect(response.status).toBe(307);
      const redirect = new URL(response.headers.get("location") ?? "");
      expect(redirect.pathname).toBe("/login");
      expect(redirect.searchParams.get("next")).toBe(path);
    },
  );

  it.each(["/trip-sheet", "/recurring-trips"])("allows an authenticated admin to reach %s", (path) => {
    const response = middleware(request(path, adminCookie));
    expect(response.status).toBe(200);
  });

  it("still redirects an authenticated non-admin away from a protected route", () => {
    const response = middleware(request("/trip-sheet", "velo_admin_token=token; velo_admin_role_hint=DRIVER"));
    expect(response.status).toBe(307);
  });
});
