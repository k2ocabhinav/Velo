import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantSlugFromRequest } from "@velo/app-core/tenant";
import type { RegisterPayload } from "../../../login/_lib/auth";
import {
  handleRegisterFormPost,
  isFormSubmission,
  performRegisterProxy,
  readFormString,
} from "../../../login/_lib/auth";

export async function POST(request: NextRequest) {
  const tenantSlug = resolveTenantSlugFromRequest(request.headers);

  if (isFormSubmission(request)) {
    return handleRegisterFormPost(request, (form) =>
      performRegisterProxy({
        name: readFormString(form, "name"),
        email: readFormString(form, "email"),
        password: readFormString(form, "password"),
        referredByCode: readFormString(form, "referredByCode") || undefined,
      }, fetch, tenantSlug)
    );
  }

  let body: RegisterPayload;

  try {
    body = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  return performRegisterProxy(body, fetch, tenantSlug);
}
