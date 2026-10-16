import {
  LOGIN_COOKIE_MAX_AGE_SECONDS,
  LOGIN_REDIRECT_FALLBACK,
  LOGIN_REQUEST_TIMEOUT_MS,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_PATH,
  type AuthExtractionResult,
  type LoginPayload,
  type RegisterPayload,
  extractAuthValues,
  getApiBaseUrl,
  handleLoginFormPost,
  handleRegisterFormPost,
  isFormSubmission,
  performLoginProxy as performSharedLoginProxy,
  performLogoutProxy as performSharedLogoutProxy,
  performRefreshProxy as performSharedRefreshProxy,
  performRegisterProxy as performSharedRegisterProxy,
  readFormString,
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
  handleLoginFormPost,
  handleRegisterFormPost,
  isFormSubmission,
  readFormString,
  readResponsePayload,
  sanitizeNextPath
};

export type { AuthExtractionResult, LoginPayload, RegisterPayload };

export const LOGIN_COOKIE_NAME = "velo_rider_token";
export const REFRESH_COOKIE_NAME = "velo_rider_refresh";
export const LOGIN_USER_ID_COOKIE_NAME = "velo_rider_user_id";
export const LOGIN_ROLE_COOKIE_NAME = "velo_rider_role_hint";

export async function performLoginProxy(
  body: LoginPayload,
  fetchImpl: typeof fetch = fetch,
  requestHost?: string
) {
  return performSharedLoginProxy(body, fetchImpl, {
    requiredRoleHint: "RIDER",
    tokenCookieName: LOGIN_COOKIE_NAME,
    refreshCookieName: REFRESH_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME,
    roleGuardMessage: "This account is not authorized for the rider workspace.",
    requestHost
  });
}

export async function performRegisterProxy(
  body: RegisterPayload,
  fetchImpl: typeof fetch = fetch,
  tenantSlug?: string
) {
  return performSharedRegisterProxy(body, fetchImpl, tenantSlug);
}

export function performRefreshProxy(refreshToken: string | null | undefined, fetchImpl: typeof fetch = fetch, requestHost?: string) {
  return performSharedRefreshProxy(refreshToken, {
    tokenCookieName: LOGIN_COOKIE_NAME,
    refreshCookieName: REFRESH_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME,
    requestHost
  }, fetchImpl);
}

export function performLogoutProxy(refreshToken?: string | null, requestHost?: string) {
  return performSharedLogoutProxy(refreshToken, {
    tokenCookieName: LOGIN_COOKIE_NAME,
    refreshCookieName: REFRESH_COOKIE_NAME,
    userIdCookieName: LOGIN_USER_ID_COOKIE_NAME,
    roleCookieName: LOGIN_ROLE_COOKIE_NAME,
    requestHost
  });
}
