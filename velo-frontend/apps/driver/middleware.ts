import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sanitizeNextPath } from "./app/login/_lib/redirect";

const PUBLIC_PATHS = ["/login"];

const PROTECTED_PATHS = ["/", "/ride", "/rides", "/earnings", "/notifications"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isBypassPath(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return true;
  }

  return pathname === "/favicon.ico" || /\.[^/]+$/.test(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("velo_token")?.value;

  if (isPublicPath(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (!isProtectedPath(pathname) || token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", sanitizeNextPath(`${pathname}${search}`));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
