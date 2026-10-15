import type { NextRequest } from "next/server";
import { REFRESH_COOKIE_NAME, performLogoutProxy } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  return performLogoutProxy(request.cookies.get(REFRESH_COOKIE_NAME)?.value, request.headers.get("host") ?? undefined);
}
