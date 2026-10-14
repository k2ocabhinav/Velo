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
  refreshToken: string | null;
  userId: string | number | null;
  expiresInSeconds: number | null;
}>;

export type AuthCookieNames = Readonly<{
  tokenCookieName?: string | undefined;
  refreshCookieName?: string | undefined;
  userIdCookieName?: string | undefined;
  roleCookieName?: string | undefined;
}>;

export type LoginProxyOptions = Readonly<{
  requiredRoleHint?: string | null | undefined;
  roleCookieName?: string | undefined;
  roleGuardMessage?: string | undefined;
  refreshCookieName?: string | undefined;
  tokenCookieName?: string | undefined;
  userIdCookieName?: string | undefined;
}>;

export const LOGIN_COOKIE_NAME = "velo_token";
export const REFRESH_COOKIE_NAME = "velo_refresh_token";
export const LOGIN_USER_ID_COOKIE_NAME = "velo_user_id";
export const LOGIN_ROLE_COOKIE_NAME = "velo_role_hint";
export const LOGIN_REQUEST_TIMEOUT_MS = 10_000;
export const LOGIN_COOKIE_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const REFRESH_COOKIE_PATH = "/api";

export function extractAuthValues(payload: unknown): AuthExtractionResult {
  const root = isRecordLike(payload) ? payload : null;
  const data = root && isRecordLike(root.data) ? root.data : null;

  const token =
    typeof root?.token === "string"
      ? root.token
      : typeof data?.token === "string"
        ? data.token
        : null;

  const refreshToken =
    typeof root?.refreshToken === "string"
      ? root.refreshToken
      : typeof data?.refreshToken === "string"
        ? data.refreshToken
        : null;

  const userId =
    typeof root?.userId === "number" || typeof root?.userId === "string"
      ? root.userId
      : typeof data?.userId === "number" || typeof data?.userId === "string"
        ? data.userId
        : null;

  const expiresInSecondsValue = root?.expiresInSeconds ?? data?.expiresInSeconds;
  const expiresInSeconds = typeof expiresInSecondsValue === "number" && Number.isFinite(expiresInSecondsValue)
    ? expiresInSecondsValue
    : null;

  return { token, refreshToken, userId, expiresInSeconds };
}

function normalizeRoleHint(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("ROLE_")) {
    return normalized.slice(5) || null;
  }

  return normalized;
}

function collectRoleHintValue(target: Set<string>, value: unknown): void {
  if (typeof value === "string") {
    const normalized = normalizeRoleHint(value);
    if (normalized) {
      target.add(normalized);
    }
    return;
  }

  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    if (typeof entry === "string") {
      const normalized = normalizeRoleHint(entry);
      if (normalized) {
        target.add(normalized);
      }
      continue;
    }

    if (!isRecordLike(entry)) {
      continue;
    }

    if (typeof entry.authority === "string") {
      const normalized = normalizeRoleHint(entry.authority);
      if (normalized) {
        target.add(normalized);
      }
    }
  }
}

export function extractRoleHints(payload: unknown): string[] {
  const hints = new Set<string>();
  if (!isRecordLike(payload)) {
    return [];
  }

  collectRoleHintValue(hints, payload.role);
  collectRoleHintValue(hints, payload.roles);
  collectRoleHintValue(hints, payload.authorities);

  const data = isRecordLike(payload.data) ? payload.data : null;
  if (data) {
    collectRoleHintValue(hints, data.role);
    collectRoleHintValue(hints, data.roles);
    collectRoleHintValue(hints, data.authorities);
  }

  return Array.from(hints);
}

function buildCookieOptions(maxAge: number, path = "/") {
  const secureOverride = getEnvValue("VELO_AUTH_COOKIE_SECURE")?.trim().toLowerCase();
  const isProduction = getEnvValue("NODE_ENV") === "production";
  const secure = isProduction || secureOverride === "true";

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path,
    maxAge
  };
}

function buildLoginCookieOptions(maxAge = LOGIN_COOKIE_MAX_AGE_SECONDS) {
  return buildCookieOptions(maxAge);
}

function buildRefreshCookieOptions() {
  return buildCookieOptions(REFRESH_COOKIE_MAX_AGE_SECONDS, REFRESH_COOKIE_PATH);
}

function buildClearedCookieOptions() {
  return {
    ...buildCookieOptions(0),
    expires: new Date(0)
  };
}

function setLoginCookies(
  response: NextResponse,
  token: string,
  refreshToken: string,
  userId: string | number | null,
  roleHint: string | null,
  expiresInSeconds: number | null,
  cookieNameOverrides: AuthCookieNames = {}
): void {
  const tokenCookieName = cookieNameOverrides.tokenCookieName ?? LOGIN_COOKIE_NAME;
  const refreshCookieName = cookieNameOverrides.refreshCookieName ?? REFRESH_COOKIE_NAME;
  const userIdCookieName = cookieNameOverrides.userIdCookieName ?? LOGIN_USER_ID_COOKIE_NAME;
  const roleCookieName = cookieNameOverrides.roleCookieName ?? LOGIN_ROLE_COOKIE_NAME;

  response.cookies.set(tokenCookieName, token, buildLoginCookieOptions(expiresInSeconds ?? LOGIN_COOKIE_MAX_AGE_SECONDS));
  response.cookies.set(refreshCookieName, refreshToken, buildRefreshCookieOptions());

  if (userId !== null) {
    response.cookies.set(userIdCookieName, String(userId), buildLoginCookieOptions());
  }

  if (roleHint) {
    response.cookies.set(roleCookieName, roleHint, buildLoginCookieOptions());
    return;
  }

  response.cookies.set(roleCookieName, "", buildClearedCookieOptions());
}

export function clearLoginCookies(
  response: NextResponse,
  cookieNameOverrides: AuthCookieNames = {}
): void {
  const tokenCookieName = cookieNameOverrides.tokenCookieName ?? LOGIN_COOKIE_NAME;
  const refreshCookieName = cookieNameOverrides.refreshCookieName ?? REFRESH_COOKIE_NAME;
  const userIdCookieName = cookieNameOverrides.userIdCookieName ?? LOGIN_USER_ID_COOKIE_NAME;
  const roleCookieName = cookieNameOverrides.roleCookieName ?? LOGIN_ROLE_COOKIE_NAME;
  const cleared = buildClearedCookieOptions();
  response.cookies.set(tokenCookieName, "", cleared);
  response.cookies.set(refreshCookieName, "", {
    ...buildRefreshCookieOptions(),
    maxAge: 0,
    expires: new Date(0)
  });
  response.cookies.set(userIdCookieName, "", cleared);
  response.cookies.set(roleCookieName, "", cleared);
}

function selectRoleHint(roleHints: string[], requiredRoleHint: string | null): string | null {
  if (requiredRoleHint && roleHints.includes(requiredRoleHint)) {
    return requiredRoleHint;
  }

  if (roleHints.length === 0) {
    return null;
  }

  return [...roleHints].sort()[0] ?? null;
}

function removeAuthToken(payload: unknown): unknown {
  if (!isRecordLike(payload)) {
    return payload;
  }

  const safePayload = { ...payload };
  delete safePayload.token;
  delete safePayload.refreshToken;
  if (isRecordLike(safePayload.data)) {
    const safeData = { ...safePayload.data };
    delete safeData.token;
    delete safeData.refreshToken;
    safePayload.data = safeData;
  }
  return safePayload;
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
  fetchImpl: typeof fetch = fetch,
  options: LoginProxyOptions = {}
): Promise<NextResponse> {
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, {
      status: 400,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
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
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const payload = await readResponsePayload(upstreamResponse);

  if (!upstreamResponse.ok) {
    const response = NextResponse.json(
      { error: getErrorMessage(payload) ?? "Unable to sign in." },
      { status: upstreamResponse.status, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
    const retryAfter = upstreamResponse.headers.get("retry-after");
    if (retryAfter) response.headers.set("Retry-After", retryAfter);
    return response;
  }

  const { token, refreshToken, userId, expiresInSeconds } = extractAuthValues(payload);

  if (!token || !refreshToken) {
    return NextResponse.json(
      { error: "Authentication service returned an invalid session response." },
      { status: 502 }
    );
  }

  const requiredRoleHint = normalizeRoleHint(options.requiredRoleHint);
  const roleHints = extractRoleHints(payload);
  if (requiredRoleHint && roleHints.length > 0 && !roleHints.includes(requiredRoleHint)) {
    return NextResponse.json(
      {
        error:
          options.roleGuardMessage ??
          "This account is not authorized for this workspace."
      },
      { status: 403 }
    );
  }

  const selectedRoleHint = selectRoleHint(roleHints, requiredRoleHint);
  const response = NextResponse.json(removeAuthToken(payload) ?? { ok: true }, { status: 200 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  setLoginCookies(response, token, refreshToken, userId, selectedRoleHint, expiresInSeconds, {
    tokenCookieName: options.tokenCookieName,
    refreshCookieName: options.refreshCookieName,
    userIdCookieName: options.userIdCookieName,
    roleCookieName: options.roleCookieName
  });
  return response;
}

export type RefreshSessionResult = Readonly<{
  ok: boolean;
  status: number;
  payload: unknown;
  error: string | null;
  token: string | null;
  refreshToken: string | null;
  userId: string | number | null;
  expiresInSeconds: number | null;
}>;

const refreshFlights = new Map<string, Promise<RefreshSessionResult>>();

export function refreshSessionTokens(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<RefreshSessionResult> {
  const currentFlight = refreshFlights.get(refreshToken);
  if (currentFlight) {
    return currentFlight;
  }

  const flight = (async (): Promise<RefreshSessionResult> => {
    try {
      const response = await fetchImpl(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store"
      });
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          payload,
          error: getErrorMessage(payload) ?? "Unable to refresh session.",
          token: null,
          refreshToken: null,
          userId: null,
          expiresInSeconds: null
        };
      }

      const values = extractAuthValues(payload);
      if (!values.token || !values.refreshToken) {
        return {
          ok: false,
          status: 502,
          payload: null,
          error: "Authentication service returned an invalid session response.",
          token: null,
          refreshToken: null,
          userId: null,
          expiresInSeconds: null
        };
      }

      return { ...values, ok: true, status: 200, payload, error: null };
    } catch {
      return {
        ok: false,
        status: 502,
        payload: null,
        error: "Unable to contact authentication service.",
        token: null,
        refreshToken: null,
        userId: null,
        expiresInSeconds: null
      };
    }
  })();

  refreshFlights.set(refreshToken, flight);
  void flight.then((result) => {
    const cleanup = () => {
      if (refreshFlights.get(refreshToken) === flight) {
        refreshFlights.delete(refreshToken);
      }
    };
    if (result.ok) {
      setTimeout(cleanup, 3_000);
    } else {
      cleanup();
    }
  });
  return flight;
}

export function setRotatedSessionCookies(
  response: NextResponse,
  session: RefreshSessionResult,
  cookieNames: AuthCookieNames = {},
  roleHint?: string | null
): void {
  if (!session.ok || !session.token || !session.refreshToken) {
    return;
  }
  const roleHints = extractRoleHints(session.payload);
  setLoginCookies(
    response,
    session.token,
    session.refreshToken,
    session.userId,
    roleHint ?? selectRoleHint(roleHints, null),
    session.expiresInSeconds,
    cookieNames
  );
}

export async function performRefreshProxy(
  refreshToken: string | null | undefined,
  cookieNames: AuthCookieNames = {},
  fetchImpl: typeof fetch = fetch
): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  if (!refreshToken?.trim()) {
    const response = NextResponse.json({ error: "Authentication is required." }, { status: 401, headers });
    clearLoginCookies(response, cookieNames);
    return response;
  }

  const session = await refreshSessionTokens(refreshToken, fetchImpl);
  if (!session.ok) {
    const response = NextResponse.json({ error: session.error }, { status: session.status, headers });
    if (session.status === 401 || session.status === 403) {
      clearLoginCookies(response, cookieNames);
    }
    return response;
  }

  const response = NextResponse.json(removeAuthToken(session.payload) ?? { ok: true }, { status: 200, headers });
  setRotatedSessionCookies(response, session, cookieNames);
  return response;
}

export async function performWebSocketTicketProxy(
  accessToken: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
  refreshToken?: string | null,
  cookieNames: AuthCookieNames = {}
): Promise<NextResponse> {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  if (!accessToken?.trim() && !refreshToken?.trim()) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401, headers });
  }

  try {
    let currentToken = accessToken?.trim() ?? "";
    let session: RefreshSessionResult | null = null;
    let upstreamResponse = await fetchWebSocketTicket(currentToken, fetchImpl);
    if (upstreamResponse.status === 401 && refreshToken?.trim()) {
      session = await refreshSessionTokens(refreshToken, fetchImpl);
      if (session.ok && session.token) {
        currentToken = session.token;
        upstreamResponse = await fetchWebSocketTicket(currentToken, fetchImpl);
      }
    }

    const payload = await readResponsePayload(upstreamResponse);
    const response = NextResponse.json(
      upstreamResponse.ok ? payload ?? {} : { error: getErrorMessage(payload) ?? "Unable to create WebSocket ticket." },
      { status: upstreamResponse.status, headers }
    );
    const retryAfter = upstreamResponse.headers.get("retry-after");
    if (retryAfter) response.headers.set("Retry-After", retryAfter);
    if (session?.ok) {
      setRotatedSessionCookies(response, session, cookieNames);
    } else if (session && !session.ok && (session.status === 401 || session.status === 403)) {
      clearLoginCookies(response, cookieNames);
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to contact authentication service." },
      { status: 502, headers }
    );
  }
}

async function fetchWebSocketTicket(accessToken: string, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(`${getApiBaseUrl()}/auth/ws-ticket`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
}

export async function performLogoutProxy(
  refreshToken: string | null | undefined = undefined,
  options: AuthCookieNames = {},
  fetchImpl: typeof fetch = fetch
): Promise<NextResponse> {
  if (refreshToken?.trim()) {
    try {
      await fetchImpl(`${getApiBaseUrl()}/auth/logout`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store"
      });
    } catch {
      // Clear the browser session even if the backend is temporarily unavailable.
    }
  }
  const response = NextResponse.json({ ok: true }, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
  clearLoginCookies(response, {
    tokenCookieName: options.tokenCookieName,
    refreshCookieName: options.refreshCookieName,
    userIdCookieName: options.userIdCookieName,
    roleCookieName: options.roleCookieName
  });
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
