import { NextRequest, NextResponse } from "next/server";

type LoginPayload = {
  email?: string;
  password?: string;
};

function getApiBaseUrl() {
  const baseUrl = process.env.VELO_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  return baseUrl.replace(/\/$/, "");
}

function extractAuthValues(payload: unknown) {
  const record = payload as Record<string, unknown> | null;
  const data = record && typeof record.data === "object" && record.data !== null ? (record.data as Record<string, unknown>) : null;

  const token = typeof record?.token === "string" ? record.token : typeof data?.token === "string" ? data.token : null;
  const userId = typeof record?.userId === "number" || typeof record?.userId === "string"
    ? record.userId
    : typeof data?.userId === "number" || typeof data?.userId === "string"
      ? data.userId
      : null;

  return { token, userId };
}

export async function POST(request: NextRequest) {
  let body: LoginPayload;

  try {
    body = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const upstreamResponse = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = await upstreamResponse.json().catch(() => null);
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      payload ?? { error: "Unable to sign in." },
      { status: upstreamResponse.status }
    );
  }

  const { token, userId } = extractAuthValues(payload);
  const response = NextResponse.json(payload ?? { ok: true }, { status: 200 });

  if (token) {
    response.cookies.set("velo_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24
    });
  }

  if (userId !== null) {
    response.cookies.set("velo_user_id", String(userId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24
    });
  }

  return response;
}
