import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "./env";
import {
  clearLoginCookies,
  refreshSessionTokens,
  setRotatedSessionCookies,
  type AuthCookieNames,
  type RefreshSessionResult
} from "./auth";

export interface ProxyRouteContext {
  params: Promise<{ path: string[] }>;
}

export interface ProxyRouteOptions {
  missingPathMessage?: string;
  tokenCookieName?: string;
  refreshCookieName?: string;
  userIdCookieName?: string;
  roleCookieName?: string;
}

const DEFAULT_TOKEN_COOKIE_NAME = "velo_token";

function buildUpstreamUrl(request: NextRequest, pathSegments: string[]): string {
  const upstream = new URL(`${getApiBaseUrl()}/${pathSegments.join("/")}`);
  upstream.search = request.nextUrl.search;
  return upstream.toString();
}

export async function proxyBackendRequest(
  request: NextRequest,
  context: ProxyRouteContext,
  options: ProxyRouteOptions = {}
): Promise<NextResponse> {
  const { path } = await context.params;

  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json(
      { error: options.missingPathMessage ?? "Missing backend proxy path." },
      { status: 400 }
    );
  }

  let token = request.cookies.get(options.tokenCookieName ?? DEFAULT_TOKEN_COOKIE_NAME)?.value;
  const refreshToken = options.refreshCookieName
    ? request.cookies.get(options.refreshCookieName)?.value
    : undefined;
  if (!token && !refreshToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type");
  const method = request.method.toUpperCase();
  const bodyText = method === "GET" || method === "HEAD" ? "" : await request.text();
  const body = bodyText.length > 0 ? bodyText : undefined;

  const cookieNames: AuthCookieNames = {
    tokenCookieName: options.tokenCookieName,
    refreshCookieName: options.refreshCookieName,
    userIdCookieName: options.userIdCookieName,
    roleCookieName: options.roleCookieName,
    requestHost: request.headers.get("host") ?? undefined
  };
  let rotatedSession: RefreshSessionResult | null = null;
  if (!token && refreshToken) {
    rotatedSession = await refreshSessionTokens(refreshToken);
    if (!rotatedSession.ok || !rotatedSession.token) {
      const response = NextResponse.json({ error: rotatedSession.error ?? "Unauthorized." }, {
        status: rotatedSession.status,
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
      if (rotatedSession.status === 401 || rotatedSession.status === 403) {
        clearLoginCookies(response, cookieNames);
      }
      return response;
    }
    token = rotatedSession.token;
  }

  const sendUpstream = async (currentToken: string) => {
    const headers = new Headers({
      Accept: "application/json",
      Authorization: currentToken.startsWith("Bearer ") ? currentToken : `Bearer ${currentToken}`
    });
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
    const init: RequestInit = { method, headers, cache: "no-store" };
    if (body !== undefined) {
      init.body = body;
    }
    return fetch(buildUpstreamUrl(request, path), init);
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await sendUpstream(token!);
    if (upstreamResponse.status === 401 && refreshToken && !rotatedSession) {
      rotatedSession = await refreshSessionTokens(refreshToken);
      if (rotatedSession.ok && rotatedSession.token) {
        upstreamResponse = await sendUpstream(rotatedSession.token);
      }
    }
  } catch {
    const response = NextResponse.json({ error: "Unable to reach backend service." }, { status: 502 });
    if (rotatedSession?.ok) {
      setRotatedSessionCookies(response, rotatedSession, cookieNames);
    }
    return response;
  }

  const payload = await upstreamResponse.text();
  const responseHeaders = new Headers();
  responseHeaders.set("Cache-Control", "no-store, max-age=0");
  const upstreamContentType = upstreamResponse.headers.get("content-type");

  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  } else {
    responseHeaders.set("content-type", "application/json");
  }
  const retryAfter = upstreamResponse.headers.get("retry-after");
  if (retryAfter) {
    responseHeaders.set("Retry-After", retryAfter);
  }

  const response = new NextResponse(payload, {
    status: upstreamResponse.status,
    headers: responseHeaders
  });
  if (rotatedSession?.ok) {
    setRotatedSessionCookies(response, rotatedSession, cookieNames);
  } else if (rotatedSession && !rotatedSession.ok && (rotatedSession.status === 401 || rotatedSession.status === 403)) {
    clearLoginCookies(response, cookieNames);
  }
  return response;
}
