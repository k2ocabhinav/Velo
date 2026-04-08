import type { NextRequest } from "next/server";
import { createCookieAuthMiddleware } from "@velo/app-core/auth-middleware";

const cookieAuthMiddleware = createCookieAuthMiddleware({
  publicPaths: ["/login"],
  protectedPaths: ["/", "/ride", "/rides", "/earnings", "/notifications"],
  redirectAuthenticatedPublicTo: "/",
  requiredRoleHint: "DRIVER"
});

export function middleware(request: NextRequest) {
  return cookieAuthMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
