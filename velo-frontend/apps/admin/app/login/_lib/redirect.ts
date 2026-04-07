export const LOGIN_REDIRECT_FALLBACK = "/";

const LOGIN_ORIGIN = "http://velo.local";

export function sanitizeNextPath(value: string | null | undefined): string {
  const candidate = value?.trim();

  if (!candidate) {
    return LOGIN_REDIRECT_FALLBACK;
  }

  try {
    const parsed = new URL(candidate, LOGIN_ORIGIN);

    if (parsed.origin !== LOGIN_ORIGIN) {
      return LOGIN_REDIRECT_FALLBACK;
    }

    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (!normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
      return LOGIN_REDIRECT_FALLBACK;
    }

    return normalizedPath;
  } catch {
    return LOGIN_REDIRECT_FALLBACK;
  }
}
