import type { NextRequest } from "next/server";
import { createCookieAuthMiddleware } from "@velo/app-core/auth-middleware";

const cookieAuthMiddleware = createCookieAuthMiddleware({
  publicPaths: ["/login"],
  protectedPaths: ["/", "/dispatch", "/drivers", "/users", "/payouts", "/promo-codes", "/branding", "/revenue", "/scheduled-rides"],
  requiredRoleHint: "ADMIN",
  tokenCookieName: "velo_admin_token",
  roleCookieName: "velo_admin_role_hint"
});

export function middleware(request: NextRequest) {
  return cookieAuthMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/dispatch/:path*",
    "/drivers/:path*",
    "/users/:path*",
    "/payouts/:path*",
    "/promo-codes/:path*",
    "/branding/:path*",
    "/revenue/:path*",
    "/scheduled-rides/:path*",
    "/login"
  ]
};
