import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "velo_token";

function getApiBaseUrl(): string {
  const baseUrl = process.env.VELO_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  return baseUrl.replace(/\/$/, "");
}

function buildUpstreamUrl(request: NextRequest, path: string[]): string {
  const safePath = path.filter(Boolean).join("/");
  const upstream = new URL(`${getApiBaseUrl()}/${safePath}`);
  upstream.search = request.nextUrl.search;
  return upstream.toString();
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json({ error: "Proxy path is required." }, { status: 400 });
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
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
  const rawBody = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const body = rawBody && rawBody.length > 0 ? rawBody : undefined;

  const upstreamResponse = await fetch(buildUpstreamUrl(request, path), {
    method,
    headers,
    body,
    cache: "no-store",
  });

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
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}
