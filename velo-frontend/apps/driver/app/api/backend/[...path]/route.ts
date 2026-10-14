import type { NextRequest } from "next/server";
import { proxyBackendRequest, type ProxyRouteContext } from "@velo/app-core/proxy-route";

function handle(request: NextRequest, context: ProxyRouteContext) {
  return proxyBackendRequest(request, context, {
    missingPathMessage: "Missing backend proxy path.",
    tokenCookieName: "velo_driver_token",
    refreshCookieName: "velo_driver_refresh",
    userIdCookieName: "velo_driver_user_id",
    roleCookieName: "velo_driver_role_hint"
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
