export const AUTH_ERROR_CODE = {
  invalidCredentials: "invalid_credentials",
  notAuthorized: "not_authorized",
  rateLimited: "rate_limited",
  invalidRequest: "invalid_request",
  emailInUse: "email_in_use",
  unavailable: "unavailable",
  loginFailed: "login_failed",
  registerFailed: "register_failed"
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE];

export type AuthFlow = "login" | "register";

export const GENERIC_AUTH_ERROR_MESSAGE = "Something went wrong. Please try again.";

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  [AUTH_ERROR_CODE.invalidCredentials]: "Couldn't sign in. Check your email and password.",
  [AUTH_ERROR_CODE.notAuthorized]: "This account isn't authorized for this workspace.",
  [AUTH_ERROR_CODE.rateLimited]: "Too many attempts. Wait a moment and try again.",
  [AUTH_ERROR_CODE.invalidRequest]: "Check your email and password and try again.",
  [AUTH_ERROR_CODE.unavailable]: "Sign-in is unavailable right now. Try again in a moment.",
  [AUTH_ERROR_CODE.loginFailed]: "Couldn't sign in. Try again in a moment."
};

const REGISTER_ERROR_MESSAGES: Record<string, string> = {
  [AUTH_ERROR_CODE.emailInUse]: "That email address is already registered.",
  [AUTH_ERROR_CODE.rateLimited]: "Too many attempts. Wait a moment and try again.",
  [AUTH_ERROR_CODE.invalidRequest]: "Check your details and try again.",
  [AUTH_ERROR_CODE.unavailable]: "Registration is unavailable right now. Try again in a moment.",
  [AUTH_ERROR_CODE.registerFailed]: "Couldn't create your account. Try again in a moment."
};

function resolveAuthErrorMessage(code: string | null | undefined, messages: Record<string, string>): string | null {
  const normalized = code?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return messages[normalized] ?? GENERIC_AUTH_ERROR_MESSAGE;
}

export function loginErrorMessage(code: string | null | undefined): string | null {
  return resolveAuthErrorMessage(code, LOGIN_ERROR_MESSAGES);
}

export function registerErrorMessage(code: string | null | undefined): string | null {
  return resolveAuthErrorMessage(code, REGISTER_ERROR_MESSAGES);
}

export function authErrorCodeFromStatus(status: number, flow: AuthFlow): AuthErrorCode {
  switch (status) {
    case 400:
      return AUTH_ERROR_CODE.invalidRequest;
    case 401:
      return AUTH_ERROR_CODE.invalidCredentials;
    case 403:
      return AUTH_ERROR_CODE.notAuthorized;
    case 409:
      return flow === "register" ? AUTH_ERROR_CODE.emailInUse : AUTH_ERROR_CODE.invalidRequest;
    case 429:
      return AUTH_ERROR_CODE.rateLimited;
    case 502:
    case 503:
    case 504:
      return AUTH_ERROR_CODE.unavailable;
    default:
      return flow === "register" ? AUTH_ERROR_CODE.registerFailed : AUTH_ERROR_CODE.loginFailed;
  }
}
