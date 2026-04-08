import {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_COOKIE_NAME,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  LOGIN_USER_ID_COOKIE_NAME,
  type AuthExtractionResult,
  type LoginPayload,
  type RegisterPayload,
  extractAuthValues,
  getApiBaseUrl,
  performLoginProxy as performSharedLoginProxy,
  performRegisterProxy as performSharedRegisterProxy,
  readResponsePayload,
  sanitizeNextPath
} from "@velo/app-core/auth";

export {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_COOKIE_NAME,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  LOGIN_USER_ID_COOKIE_NAME,
  extractAuthValues,
  getApiBaseUrl,
  readResponsePayload,
  sanitizeNextPath
};

export type { AuthExtractionResult, LoginPayload, RegisterPayload };

export async function performLoginProxy(
  body: LoginPayload,
  fetchImpl: typeof fetch = fetch
) {
  return performSharedLoginProxy(body, fetchImpl);
}

export async function performRegisterProxy(
  body: RegisterPayload,
  fetchImpl: typeof fetch = fetch
) {
  return performSharedRegisterProxy(body, fetchImpl);
}

