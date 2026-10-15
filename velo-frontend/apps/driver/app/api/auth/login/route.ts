import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { LoginPayload } from "../../../login/_lib/auth";
import { handleLoginFormPost, isFormSubmission, performLoginProxy } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  if (isFormSubmission(request)) {
    return handleLoginFormPost(request, performLoginProxy);
  }

  let body: LoginPayload;

  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  return performLoginProxy(body);
}
