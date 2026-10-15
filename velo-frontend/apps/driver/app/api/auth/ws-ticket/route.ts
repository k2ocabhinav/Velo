import type { NextRequest } from "next/server";
import { performWebSocketTicketProxy } from "@velo/app-core/auth";
import { LOGIN_COOKIE_NAME, REFRESH_COOKIE_NAME } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  return performWebSocketTicketProxy(
    request.cookies.get(LOGIN_COOKIE_NAME)?.value,
    fetch,
    request.cookies.get(REFRESH_COOKIE_NAME)?.value,
    {
      tokenCookieName: LOGIN_COOKIE_NAME,
      refreshCookieName: REFRESH_COOKIE_NAME,
      userIdCookieName: "velo_driver_user_id",
      roleCookieName: "velo_driver_role_hint",
      requestHost: request.headers.get("host") ?? undefined
    }
  );
}
