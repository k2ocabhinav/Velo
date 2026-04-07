import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import type { ApiResponse } from "./types";

export interface VeloClientOptions {
  baseURL?: string;
  token?: string | null;
  getToken?: () => string | null | undefined;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

export function getDefaultApiBaseUrl(): string {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
}

function normalizeToken(token: string | null | undefined): string | undefined {
  if (!token) {
    return undefined;
  }

  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const prefix = `${name}=`;
  const found = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(prefix));

  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

function getHeaderValue(
  headers: Headers | Record<string, string | undefined> | undefined,
  key: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(key) ?? headers.get(key.toLowerCase()) ?? undefined;
  }

  const normalizedKey = key.toLowerCase();
  const entries = Object.entries(headers);
  const match = entries.find(([entryKey]) => entryKey.toLowerCase() === normalizedKey);
  return match?.[1];
}

export function resolveBrowserToken(cookieName = "velo_token"): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storedToken = window.localStorage.getItem(cookieName);
  if (storedToken) {
    return storedToken;
  }

  return readCookie(window.document.cookie, cookieName);
}

export function resolveServerToken(
  headers?: Headers | Record<string, string | undefined>,
  cookieName = "velo_token",
): string | undefined {
  const authorization = getHeaderValue(headers, "authorization");
  if (authorization) {
    return authorization;
  }

  return readCookie(getHeaderValue(headers, "cookie"), cookieName);
}

export function buildAuthHeaders(token?: string | null): Record<string, string> {
  const normalizedToken = normalizeToken(token);
  return normalizedToken ? { Authorization: normalizedToken } : {};
}

export function createVeloClient(options: VeloClientOptions = {}): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL ?? getDefaultApiBaseUrl(),
    withCredentials: options.withCredentials ?? true,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = options.token ?? options.getToken?.();
    const authHeaders = buildAuthHeaders(token);

    Object.assign(config.headers, authHeaders);

    return config;
  });

  return client;
}

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "data" in value &&
      "error" in value &&
      "statusCode" in value,
  );
}

export async function requestData<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
): Promise<T> {
  const response = await client.request<ApiResponse<T>>(config);
  const payload = response.data;

  return isApiResponse<T>(payload) ? payload.data : (payload as unknown as T);
}
