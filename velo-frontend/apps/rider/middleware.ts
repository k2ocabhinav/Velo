import type { NextRequest } from "next/server";
import { createCookieAuthMiddleware } from "@velo/app-core/auth-middleware";

const cookieAuthMiddleware = createCookieAuthMiddleware({
  publicPaths: ["/login", "/register"],
  protectedPaths: ["/", "/ride/active", "/rides", "/scheduled", "/wallet", "/promos", "/notifications"],
  redirectAuthenticatedPublicTo: "/",
  requiredRoleHint: "RIDER",
  tokenCookieName: "velo_rider_token",
  roleCookieName: "velo_rider_role_hint"
});

export function middleware(request: NextRequest) {
  return cookieAuthMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
