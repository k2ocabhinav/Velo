import type { NextRequest } from "next/server";
import { createCookieAuthMiddleware } from "@velo/app-core/auth-middleware";
import { attachTenantSlugHeader } from "@velo/app-core/tenant";

const cookieAuthMiddleware = createCookieAuthMiddleware({
  publicPaths: ["/login"],
  protectedPaths: ["/", "/dispatch", "/trip-sheet", "/recurring-trips", "/scheduled-rides", "/drivers", "/users", "/payouts", "/revenue", "/promo-codes", "/branding"],
  requiredRoleHint: "ADMIN",
  tokenCookieName: "velo_admin_token",
  roleCookieName: "velo_admin_role_hint"
});

export function middleware(request: NextRequest) {
  return attachTenantSlugHeader(request, cookieAuthMiddleware(request), process.env.VELO_DEFAULT_TENANT_SLUG ?? "default", process.env.VELO_TENANT_BASE_DOMAIN ?? "velo.app");
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
