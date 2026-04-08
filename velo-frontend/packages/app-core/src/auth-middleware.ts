import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sanitizeNextPath } from "./redirect";

export interface CookieAuthMiddlewareOptions {
  publicPaths: string[];
  protectedPaths: string[];
  loginPath?: string;
  redirectAuthenticatedPublicTo?: string;
  tokenCookieName?: string;
}

function matchesPath(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isBypassPath(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return true;
  }

  return pathname === "/favicon.ico" || /\.[^/]+$/.test(pathname);
}

export function createCookieAuthMiddleware(options: CookieAuthMiddlewareOptions) {
  const loginPath = options.loginPath ?? "/login";
  const tokenCookieName = options.tokenCookieName ?? "velo_token";

  return (request: NextRequest) => {
    const { pathname, search } = request.nextUrl;

    if (isBypassPath(pathname)) {
      return NextResponse.next();
    }

    const token = request.cookies.get(tokenCookieName)?.value;
    const isPublicPath = matchesPath(pathname, options.publicPaths);

    if (isPublicPath) {
      if (token && options.redirectAuthenticatedPublicTo) {
        return NextResponse.redirect(new URL(options.redirectAuthenticatedPublicTo, request.url));
      }

      return NextResponse.next();
    }

    if (!matchesPath(pathname, options.protectedPaths) || token) {
      return NextResponse.next();
    }

    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set("next", sanitizeNextPath(`${pathname}${search}`));
    return NextResponse.redirect(loginUrl);
  };
}

