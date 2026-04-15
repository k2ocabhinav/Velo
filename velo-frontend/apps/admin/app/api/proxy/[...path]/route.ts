import type { NextRequest } from "next/server";
import { proxyBackendRequest, type ProxyRouteContext } from "@velo/app-core/proxy-route";

const PROXY_OPTIONS = {
  missingPathMessage: "Proxy path is required.",
  tokenCookieName: "velo_admin_token"
};

function handle(request: NextRequest, context: ProxyRouteContext) {
  return proxyBackendRequest(request, context, PROXY_OPTIONS);
}

export async function GET(request: NextRequest, context: ProxyRouteContext) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: ProxyRouteContext) {
  return handle(request, context);
}

export async function PUT(request: NextRequest, context: ProxyRouteContext) {
  return handle(request, context);
}

export async function PATCH(request: NextRequest, context: ProxyRouteContext) {
  return handle(request, context);
}

export async function DELETE(request: NextRequest, context: ProxyRouteContext) {
  return handle(request, context);
}
