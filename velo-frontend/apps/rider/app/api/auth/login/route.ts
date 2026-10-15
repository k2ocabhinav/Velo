import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { LoginPayload } from "../../../login/_lib/auth";
import { handleLoginFormPost, isFormSubmission, performLoginProxy } from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  if (isFormSubmission(request)) {
    return handleLoginFormPost(request, (formBody) => performLoginProxy(formBody, fetch, request.headers.get("host") ?? undefined));
  }

  let body: LoginPayload;

  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  return performLoginProxy(body, fetch, request.headers.get("host") ?? undefined);
}
