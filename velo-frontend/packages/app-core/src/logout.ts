export interface ClientLogoutOptions {
  logoutPath?: string;
  loginPath?: string;
  sessionStorageKeysToClear?: string[];
}

export async function performClientLogout(options: ClientLogoutOptions = {}): Promise<void> {
  const logoutPath = options.logoutPath ?? "/api/auth/logout";
  const loginPath = options.loginPath ?? "/login";
  const sessionStorageKeysToClear = options.sessionStorageKeysToClear ?? [];

  try {
    await fetch(logoutPath, {
      method: "POST",
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    // Best-effort sign out: continue with local cleanup and redirect.
  }

  if (typeof window !== "undefined") {
    for (const key of sessionStorageKeysToClear) {
      window.sessionStorage.removeItem(key);
    }

    window.location.assign(loginPath);
  }
}
