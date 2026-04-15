import type { NextRequest } from "next/server";
import { proxyBackendRequest, type ProxyRouteContext } from "@velo/app-core/proxy-route";

function handle(request: NextRequest, context: ProxyRouteContext) {
  return proxyBackendRequest(request, context, {
    missingPathMessage: "Missing backend proxy path.",
    tokenCookieName: "velo_rider_token"
  });
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
