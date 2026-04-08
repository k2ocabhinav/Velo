import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "./env";

export interface ProxyRouteContext {
  params: Promise<{ path: string[] }>;
}

export interface ProxyRouteOptions {
  missingPathMessage?: string;
  tokenCookieName?: string;
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

  const token = request.cookies.get(options.tokenCookieName ?? DEFAULT_TOKEN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const method = request.method.toUpperCase();
  const bodyText = method === "GET" || method === "HEAD" ? "" : await request.text();
  const body = bodyText.length > 0 ? bodyText : undefined;

  let upstreamResponse: Response;
  try {
    const init: RequestInit = {
      method,
      headers,
      cache: "no-store"
    };

    if (body !== undefined) {
      init.body = body;
    }

    upstreamResponse = await fetch(buildUpstreamUrl(request, path), init);
  } catch {
    return NextResponse.json({ error: "Unable to reach backend service." }, { status: 502 });
  }

  const payload = await upstreamResponse.text();
  const responseHeaders = new Headers();
  const upstreamContentType = upstreamResponse.headers.get("content-type");

  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  } else {
    responseHeaders.set("content-type", "application/json");
  }

  return new NextResponse(payload, {
    status: upstreamResponse.status,
    headers: responseHeaders
  });
}
