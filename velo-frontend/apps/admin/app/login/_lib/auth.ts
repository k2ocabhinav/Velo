import {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_PATH,
  type AuthExtractionResult,
  type LoginPayload,
  extractAuthValues,
  getApiBaseUrl,
  performLoginProxy as performSharedLoginProxy,
  performLogoutProxy as performSharedLogoutProxy,
  performRefreshProxy as performSharedRefreshProxy,
  readResponsePayload,
  sanitizeNextPath
} from "@velo/app-core/auth";

export {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_PATH,
  extractAuthValues,
  getApiBaseUrl,
  readResponsePayload,
  sanitizeNextPath
};

export type { AuthExtractionResult, LoginPayload };

export const LOGIN_COOKIE_NAME = "velo_admin_token";
export const REFRESH_COOKIE_NAME = "velo_admin_refresh";
export const LOGIN_USER_ID_COOKIE_NAME = "velo_admin_user_id";
export const LOGIN_ROLE_COOKIE_NAME = "velo_admin_role_hint";

export async function performLoginProxy(
  body: LoginPayload,
  fetchImpl: typeof fetch = fetch
) {
  return performSharedLoginProxy(body, fetchImpl, {
    requiredRoleHint: "ADMIN",
    tokenCookieName: LOGIN_COOKIE_NAME,
    refreshCookieName: REFRESH_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME,
    roleGuardMessage: "This account is not authorized for the admin workspace."
  });
}

export function performRefreshProxy(refreshToken: string | null | undefined, fetchImpl: typeof fetch = fetch) {
  return performSharedRefreshProxy(refreshToken, {
    tokenCookieName: LOGIN_COOKIE_NAME,
    refreshCookieName: REFRESH_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME
  }, fetchImpl);
}

export function performLogoutProxy(refreshToken?: string | null) {
  return performSharedLogoutProxy(refreshToken, {
    tokenCookieName: LOGIN_COOKIE_NAME,
    refreshCookieName: REFRESH_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME
  });
}
