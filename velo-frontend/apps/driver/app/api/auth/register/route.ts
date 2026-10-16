import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@velo/app-core/env";
import { extractAuthValues, handleRegisterFormPost, isFormSubmission, readFormString } from "@velo/app-core/auth";

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  vehicleId: string;
  referredByCode?: string;
}

function readApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message;
      }
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }
  return fallback;
}

async function readApiErrorPayload(response: Response, fallback: string): Promise<string> {
  try {
    return readApiError(await response.json(), fallback);
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  if (isFormSubmission(request)) {
    return handleRegisterFormPost(request, (form) =>
      registerDriver({
        name: readFormString(form, "name"),
        email: readFormString(form, "email"),
        password: readFormString(form, "password"),
        vehicleId: readFormString(form, "vehicleId"),
        referredByCode: readFormString(form, "referredByCode") || undefined,
      })
    );
  }

  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  return registerDriver(body);
}

async function registerDriver(body: RegisterBody): Promise<NextResponse> {
  const { name, email, password, vehicleId, referredByCode } = body;

  if (!name || !email || !password || !vehicleId) {
    return NextResponse.json(
      { error: "Name, email, password, and vehicle ID are required." },
      { status: 400 },
    );
  }

  const normalizedName = name.trim();
  const baseUrl = getApiBaseUrl();

  // Step 1: Create the account via the signup endpoint (no auth required).
  let signupResponse: Response;
  try {
    signupResponse = await fetch(`${baseUrl}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: normalizedName,
        email,
        password,
        referredByCode: referredByCode || undefined,
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Unable to contact authentication service." }, { status: 502 });
  }

  if (!signupResponse.ok) {
    const errorMessage = await readApiErrorPayload(signupResponse, "Unable to create account.");
    return NextResponse.json({ error: errorMessage }, { status: signupResponse.status });
  }

  // Step 2: Sign in to obtain an access token. Driver onboarding is a self-service
  // request that the backend authorizes with a bearer token, so the account must be
  // authenticated before it can be promoted to a driver.
  let loginResponse: Response;
  try {
    loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Account created but unable to finalize driver setup." },
      { status: 502 },
    );
  }

  if (!loginResponse.ok) {
    return NextResponse.json(
      { error: "Account created but unable to finalize driver setup." },
      { status: 502 },
    );
  }

  let loginPayload: unknown;
  try {
    loginPayload = await loginResponse.json();
  } catch {
    return NextResponse.json(
      { error: "Account created but unable to finalize driver setup." },
      { status: 502 },
    );
  }

  const { token, userId } = extractAuthValues(loginPayload);
  if (!token || userId === null) {
    return NextResponse.json(
      { error: "Signup succeeded but the driver session could not be established." },
      { status: 502 },
    );
  }

  // Step 3: Onboard as a driver using the freshly issued token.
  let onboardResponse: Response;
  try {
    onboardResponse = await fetch(`${baseUrl}/auth/onBoardNewDriver/${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vehicleId }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Account created but unable to contact driver onboarding service." },
      { status: 502 },
    );
  }

  if (!onboardResponse.ok) {
    const errorMessage = await readApiErrorPayload(onboardResponse, "Account created but failed to onboard as driver.");
    return NextResponse.json({ error: errorMessage }, { status: onboardResponse.status });
  }

  return NextResponse.json({ success: true });
}
