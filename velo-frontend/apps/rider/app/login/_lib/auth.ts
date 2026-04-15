import {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  type AuthExtractionResult,
  type LoginPayload,
  type RegisterPayload,
  extractAuthValues,
  getApiBaseUrl,
  performLoginProxy as performSharedLoginProxy,
  performLogoutProxy as performSharedLogoutProxy,
  performRegisterProxy as performSharedRegisterProxy,
  readResponsePayload,
  sanitizeNextPath
} from "@velo/app-core/auth";

export {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  extractAuthValues,
  getApiBaseUrl,
  readResponsePayload,
  sanitizeNextPath
};

export type { AuthExtractionResult, LoginPayload, RegisterPayload };

export const LOGIN_COOKIE_NAME = "velo_rider_token";
export const LOGIN_USER_ID_COOKIE_NAME = "velo_rider_user_id";
export const LOGIN_ROLE_COOKIE_NAME = "velo_rider_role_hint";

export async function performLoginProxy(
  body: LoginPayload,
  fetchImpl: typeof fetch = fetch
) {
  return performSharedLoginProxy(body, fetchImpl, {
    requiredRoleHint: "RIDER",
    tokenCookieName: LOGIN_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME,
    roleGuardMessage: "This account is not authorized for the rider workspace."
  });
}

export async function performRegisterProxy(
  body: RegisterPayload,
  fetchImpl: typeof fetch = fetch
) {
  return performSharedRegisterProxy(body, fetchImpl);
}

export function performLogoutProxy() {
  return performSharedLogoutProxy({
    tokenCookieName: LOGIN_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME
  });
}
