import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@velo/app-core/env";

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  vehicleId: string;
  referredByCode?: string;
}

function extractUserId(payload: Record<string, unknown> | null | undefined): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const wrappedId = (data as Record<string, unknown>).userId ?? (data as Record<string, unknown>).id;
    if (wrappedId != null) {
      return wrappedId;
    }
  }

  return payload.userId ?? payload.id;
}

export async function POST(request: NextRequest) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const { name, email, password, vehicleId, referredByCode } = body;

  if (!name || !email || !password || !vehicleId) {
    return NextResponse.json(
      { error: "Name, email, password, and vehicle ID are required." },
      { status: 400 },
    );
  }

  const normalizedName = name.trim();
  const baseUrl = getApiBaseUrl();

  // Step 1: Create account via signup endpoint (direct backend call, no auth needed)
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
    let errorMsg = "Unable to create account.";
    try {
      const errPayload = (await signupResponse.json()) as Record<string, unknown>;
      if (typeof errPayload?.error === "string") errorMsg = errPayload.error;
      else if (typeof errPayload?.message === "string") errorMsg = errPayload.message;
    } catch {
      // response not JSON — use fallback message
    }
    return NextResponse.json({ error: errorMsg }, { status: signupResponse.status });
  }

  let signupData: Record<string, unknown>;
  try {
    const raw = (await signupResponse.json()) as Record<string, unknown>;
    // Backend wraps in ApiResponse — unwrap .data if present
    signupData = (raw?.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid response from signup service." }, { status: 502 });
  }

  let userId = signupData.userId ?? signupData.id;

  if (!userId) {
    // Current signup response does not always include userId; fallback to login to resolve it.
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

    try {
      const loginPayload = (await loginResponse.json()) as Record<string, unknown>;
      userId = extractUserId(loginPayload);
    } catch {
      return NextResponse.json(
        { error: "Account created but unable to finalize driver setup." },
        { status: 502 },
      );
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Signup succeeded but user ID could not be resolved for driver onboarding." },
      { status: 502 },
    );
  }

  // Step 2: Onboard as driver (direct backend call, no auth needed for this public endpoint)
  let onboardResponse: Response;
  try {
    onboardResponse = await fetch(`${baseUrl}/auth/onBoardNewDriver/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
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
    let errorMsg = "Account created but failed to onboard as driver.";
    try {
      const errPayload = (await onboardResponse.json()) as Record<string, unknown>;
      if (typeof errPayload?.error === "string") errorMsg = errPayload.error;
      else if (typeof errPayload?.message === "string") errorMsg = errPayload.message;
    } catch {
      // response not JSON — use fallback message
    }
    return NextResponse.json({ error: errorMsg }, { status: onboardResponse.status });
  }

  return NextResponse.json({ success: true });
}
