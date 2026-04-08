import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sanitizeNextPath } from "./redirect";

export interface CookieAuthMiddlewareOptions {
  publicPaths: string[];
  protectedPaths: string[];
  loginPath?: string;
  redirectAuthenticatedPublicTo?: string;
  tokenCookieName?: string;
  roleCookieName?: string;
  requiredRoleHint?: string | string[];
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
  const roleCookieName = options.roleCookieName ?? "velo_role_hint";
  const requiredRoleHints = (Array.isArray(options.requiredRoleHint) ? options.requiredRoleHint : [options.requiredRoleHint])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => Boolean(value));

  function hasRoleMismatch(roleHint: string | undefined): boolean {
    if (requiredRoleHints.length === 0) {
      return false;
    }

    if (!roleHint || !roleHint.trim()) {
      // Role hint is intentionally non-authoritative; allow fallback when absent.
      return false;
    }

    return !requiredRoleHints.includes(roleHint.trim().toUpperCase());
  }

  return (request: NextRequest) => {
    const { pathname, search } = request.nextUrl;

    if (isBypassPath(pathname)) {
      return NextResponse.next();
    }

    const token = request.cookies.get(tokenCookieName)?.value;
    const roleHint = request.cookies.get(roleCookieName)?.value;
    const roleMismatch = hasRoleMismatch(roleHint);
    const isPublicPath = matchesPath(pathname, options.publicPaths);

    if (isPublicPath) {
      if (token && options.redirectAuthenticatedPublicTo && !roleMismatch) {
        return NextResponse.redirect(new URL(options.redirectAuthenticatedPublicTo, request.url));
      }

      return NextResponse.next();
    }

    if (!matchesPath(pathname, options.protectedPaths)) {
      return NextResponse.next();
    }

    if (token && !roleMismatch) {
      return NextResponse.next();
    }

    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set("next", sanitizeNextPath(`${pathname}${search}`));
    return NextResponse.redirect(loginUrl);
  };
}
