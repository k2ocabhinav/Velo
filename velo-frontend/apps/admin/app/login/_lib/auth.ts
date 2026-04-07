import { NextResponse } from "next/server";
import {
  LOGIN_REDIRECT_FALLBACK,
  sanitizeNextPath,
} from "./redirect";

export { LOGIN_REDIRECT_FALLBACK, sanitizeNextPath };

export type LoginPayload = Readonly<{
  email?: string;
  password?: string;
}>;

export type AuthExtractionResult = Readonly<{
  token: string | null;
  userId: string | number | null;
}>;

export const LOGIN_COOKIE_NAME = "velo_token";
export const LOGIN_USER_ID_COOKIE_NAME = "velo_user_id";
export const LOGIN_REQUEST_TIMEOUT_MS = 10_000;
export const LOGIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

function getEnvValue(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.[name];
}

export function getApiBaseUrl(): string {
  const baseUrl =
    getEnvValue("VELO_API_BASE_URL") ??
    getEnvValue("NEXT_PUBLIC_API_BASE_URL") ??
    "http://localhost:8080";

  return baseUrl.replace(/\/$/, "");
}

export function extractAuthValues(payload: unknown): AuthExtractionResult {
  const record = payload as Record<string, unknown> | null;
  const data =
    record && typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : null;

  const token =
    typeof record?.token === "string"
      ? record.token
      : typeof data?.token === "string"
        ? data.token
        : null;

  const userId =
    typeof record?.userId === "number" || typeof record?.userId === "string"
      ? record.userId
      : typeof data?.userId === "number" || typeof data?.userId === "string"
        ? data.userId
        : null;

  return { token, userId };
}

export async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json") || contentType.includes("+json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return null;
}

function buildLoginCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getEnvValue("NODE_ENV") === "production",
    path: "/",
    maxAge: LOGIN_COOKIE_MAX_AGE_SECONDS
  };
}

function setLoginCookies(
  response: NextResponse,
  token: string,
  userId: string | number | null,
): void {
  response.cookies.set(LOGIN_COOKIE_NAME, token, buildLoginCookieOptions());

  if (userId !== null) {
    response.cookies.set(LOGIN_USER_ID_COOKIE_NAME, String(userId), buildLoginCookieOptions());
  }
}

function isTimeoutLike(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError" || error.name === "TimeoutError";
  }

  if (error instanceof Error) {
    return /timeout/i.test(error.message) || error.name === "AbortError" || error.name === "TimeoutError";
  }

  return false;
}

export async function performLoginProxy(
  body: LoginPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<NextResponse> {
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const timeoutSignal =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(LOGIN_REQUEST_TIMEOUT_MS)
      : undefined;

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchImpl(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: timeoutSignal
    });
  } catch (error) {
    const status = isTimeoutLike(error) ? 504 : 502;
    const message =
      status === 504
        ? "Login request timed out."
        : "Unable to contact authentication service.";

    return NextResponse.json({ error: message }, { status });
  }

  const payload = await readResponsePayload(upstreamResponse);

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: getErrorMessage(payload) ?? "Unable to sign in." },
      { status: upstreamResponse.status }
    );
  }

  const { token, userId } = extractAuthValues(payload);

  if (!token) {
    return NextResponse.json(
      { error: "Authentication service returned an invalid session response." },
      { status: 502 }
    );
  }

  const response = NextResponse.json(payload ?? { ok: true }, { status: 200 });
  setLoginCookies(response, token, userId);

  return response;
}
