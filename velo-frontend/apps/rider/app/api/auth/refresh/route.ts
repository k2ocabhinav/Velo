import type { NextRequest } from "next/server";
import { REFRESH_COOKIE_NAME, performRefreshProxy } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  return performRefreshProxy(request.cookies.get(REFRESH_COOKIE_NAME)?.value);
}
