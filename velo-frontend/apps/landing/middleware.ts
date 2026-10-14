import { NextResponse, type NextRequest } from "next/server";
import { resolveTenantSlug, TENANT_SLUG_HEADER } from "@velo/app-core/tenant";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    TENANT_SLUG_HEADER,
    resolveTenantSlug({
      hostname: request.nextUrl.hostname,
      defaultTenantSlug: process.env.VELO_DEFAULT_TENANT_SLUG ?? "default",
      tenantBaseDomain: process.env.VELO_TENANT_BASE_DOMAIN ?? "velo.app",
    }),
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
