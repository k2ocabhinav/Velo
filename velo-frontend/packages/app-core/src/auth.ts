import { NextResponse } from "next/server";
import { getApiBaseUrl, getEnvValue } from "./env";
import { getErrorMessage, isRecordLike, readResponsePayload } from "./http-payload";
import { LOGIN_REDIRECT_FALLBACK, sanitizeNextPath } from "./redirect";

export { LOGIN_REDIRECT_FALLBACK, sanitizeNextPath };
export { getApiBaseUrl } from "./env";
export { readResponsePayload } from "./http-payload";

export type LoginPayload = Readonly<{
  email?: string;
  password?: string;
}>;

export type RegisterPayload = Readonly<{
  name?: string;
  email?: string;
  password?: string;
  referredByCode?: string;
}>;

export type AuthExtractionResult = Readonly<{
  token: string | null;
  userId: string | number | null;
}>;

export const LOGIN_COOKIE_NAME = "velo_token";
export const LOGIN_USER_ID_COOKIE_NAME = "velo_user_id";
export const LOGIN_REQUEST_TIMEOUT_MS = 10_000;
export const LOGIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export function extractAuthValues(payload: unknown): AuthExtractionResult {
  const root = isRecordLike(payload) ? payload : null;
  const data = root && isRecordLike(root.data) ? root.data : null;

  const token =
    typeof root?.token === "string"
      ? root.token
      : typeof data?.token === "string"
        ? data.token
        : null;

  const userId =
    typeof root?.userId === "number" || typeof root?.userId === "string"
      ? root.userId
      : typeof data?.userId === "number" || typeof data?.userId === "string"
        ? data.userId
        : null;

  return { token, userId };
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

function setLoginCookies(response: NextResponse, token: string, userId: string | number | null): void {
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

function createAuthFetchInit(body: Record<string, unknown>, signal: AbortSignal | undefined): RequestInit {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  };

  if (signal) {
    init.signal = signal;
  }

  return init;
}

export async function performLoginProxy(
  body: LoginPayload,
  fetchImpl: typeof fetch = fetch
): Promise<NextResponse> {
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const timeoutSignal =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(LOGIN_REQUEST_TIMEOUT_MS)
      : undefined;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(
      `${getApiBaseUrl()}/auth/login`,
      createAuthFetchInit(body as Record<string, unknown>, timeoutSignal)
    );
  } catch (error) {
    const status = isTimeoutLike(error) ? 504 : 502;
    const message = status === 504 ? "Login request timed out." : "Unable to contact authentication service.";
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

export async function performRegisterProxy(
  body: RegisterPayload,
  fetchImpl: typeof fetch = fetch
): Promise<NextResponse> {
  if (!body?.name || !body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }

  const timeoutSignal =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(LOGIN_REQUEST_TIMEOUT_MS)
      : undefined;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchImpl(
      `${getApiBaseUrl()}/auth/signup`,
      createAuthFetchInit(
        {
          name: body.name,
          email: body.email,
          password: body.password,
          referredByCode: body.referredByCode
        },
        timeoutSignal
      )
    );
  } catch (error) {
    const status = isTimeoutLike(error) ? 504 : 502;
    const message =
      status === 504
        ? "Registration request timed out."
        : "Unable to contact authentication service.";
    return NextResponse.json({ error: message }, { status });
  }

  const payload = await readResponsePayload(upstreamResponse);
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: getErrorMessage(payload) ?? "Unable to register." },
      { status: upstreamResponse.status }
    );
  }

  return NextResponse.json(payload ?? { ok: true }, { status: 201 });
}
