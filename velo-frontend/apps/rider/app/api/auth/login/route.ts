import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { LoginPayload } from "../../../login/_lib/auth";
import { performLoginProxy } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  let body: LoginPayload;

  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  return performLoginProxy(body);
}
