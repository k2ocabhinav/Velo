import { getErrorMessage, isRecordLike, readResponsePayload, unwrapData } from "./http-payload";
import { parseApiTimestamp } from "./formatters";

export interface ProxyRequestOptions {
  pathPrefix: string;
  defaultErrorMessage?: string;
  redirectOnUnauthorized?: boolean;
  loginPath?: string;
}

function getProxyPath(path: string, pathPrefix: string): string {
  return `${pathPrefix.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function redirectToLoginOnUnauthorized(loginPath = "/login"): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = `${window.location.pathname}${window.location.search}`;
  const target = `${loginPath}?next=${encodeURIComponent(nextPath || "/")}`;
  window.location.assign(target);
}

export async function requestProxyData<T>(
  path: string,
  init: RequestInit | undefined,
  options: ProxyRequestOptions
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(getProxyPath(path, options.pathPrefix), {
    ...init,
    headers,
    cache: "no-store"
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    if (response.status === 401 && options.redirectOnUnauthorized) {
      redirectToLoginOnUnauthorized(options.loginPath);
    }
    throw new Error(getErrorMessage(payload) ?? options.defaultErrorMessage ?? "Request failed.");
  }

  if (payload === null || payload === "") {
    return undefined as T;
  }

  return unwrapData<T>(payload);
}

export function unwrapPageItems<T>(payload: unknown): T[] {
  const unwrapped = unwrapData<unknown>(payload);
  if (!isRecordLike(unwrapped)) {
    return [];
  }

  if (Array.isArray(unwrapped.items)) {
    return unwrapped.items as T[];
  }

  if (Array.isArray(unwrapped.content)) {
    return unwrapped.content as T[];
  }

  return [];
}

export function toCurrency(
  value: number | string | null | undefined,
  fallback = "--",
  requestedCurrency?: string,
): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric)) {
    return fallback;
  }

  const currency = requestedCurrency ?? (typeof document === "undefined" ? undefined : document.documentElement.dataset.tenantCurrency) ?? "USD";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(numeric);
}

export function toRelativeTimestamp(value: string | null | undefined, fallback = "--"): string {
  if (!value) {
    return fallback;
  }

  const date = parseApiTimestamp(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

