import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = [
  "/",
  "/drivers",
  "/users",
  "/payouts",
  "/promo-codes",
  "/revenue",
  "/scheduled-rides"
];

function hasProtectedPrefix(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  if (!hasProtectedPrefix(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("velo_token")?.value;
  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
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
