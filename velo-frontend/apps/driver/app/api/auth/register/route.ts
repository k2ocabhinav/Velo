import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  vehicleId: string;
  referredByCode?: string;
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
      { error: "Name, email, password, and vehicleId are required." },
      { status: 400 },
    );
  }

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || undefined;

  // Step 1: Create account via signup endpoint
  const signupResponse = await fetch(new URL("/api/backend/auth/signup", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      firstName,
      lastName,
      referredByCode: referredByCode || undefined,
    }),
  });

  if (!signupResponse.ok) {
    let errorMsg = "Unable to create account.";
    try {
      const errPayload = await signupResponse.json();
      errorMsg = errPayload?.error ?? errorMsg;
    } catch {}
    return NextResponse.json({ error: errorMsg }, { status: signupResponse.status });
  }

  let signupData: { userId?: string; id?: string };
  try {
    signupData = await signupResponse.json();
  } catch {
    return NextResponse.json({ error: "Invalid response from signup service." }, { status: 502 });
  }

  const userId = signupData.userId ?? signupData.id;
  if (!userId) {
    return NextResponse.json({ error: "Signup succeeded but user ID not returned." }, { status: 502 });
  }

  // Step 2: Onboard as driver
  const onboardResponse = await fetch(
    new URL(`/api/backend/auth/onBoardNewDriver/${userId}`, request.url),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId }),
    },
  );

  if (!onboardResponse.ok) {
    let errorMsg = "Account created but failed to onboard as driver.";
    try {
      const errPayload = await onboardResponse.json();
      errorMsg = errPayload?.error ?? errorMsg;
    } catch {}
    return NextResponse.json({ error: errorMsg }, { status: onboardResponse.status });
  }

  return NextResponse.json({ success: true });
}
