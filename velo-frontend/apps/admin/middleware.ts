import type { NextRequest } from "next/server";
import { createCookieAuthMiddleware } from "@velo/app-core/auth-middleware";

const cookieAuthMiddleware = createCookieAuthMiddleware({
  publicPaths: ["/login"],
  protectedPaths: ["/", "/drivers", "/users", "/payouts", "/promo-codes", "/revenue", "/scheduled-rides"],
  requiredRoleHint: "ADMIN"
});

export function middleware(request: NextRequest) {
  return cookieAuthMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/drivers/:path*",
    "/users/:path*",
    "/payouts/:path*",
    "/promo-codes/:path*",
    "/revenue/:path*",
    "/scheduled-rides/:path*",
    "/login"
  ]
};
