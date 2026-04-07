import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { RegisterPayload } from "../../../login/_lib/auth";
import { performRegisterProxy } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  let body: RegisterPayload;

  try {
    body = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  return performRegisterProxy(body);
}
