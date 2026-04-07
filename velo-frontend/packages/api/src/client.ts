import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiResponse, PaginatedResponse, SpringPage } from "./types";

export interface VeloClientOptions {
  baseURL?: string;
  token?: string | null;
  getToken?: () => string | null | undefined;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

function getEnvValue(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env?.[name];
}

export function getDefaultApiBaseUrl(): string {
  return getEnvValue("VELO_API_BASE_URL") ?? getEnvValue("NEXT_PUBLIC_API_BASE_URL") ?? "http://localhost:8080";
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
  const cookie = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
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
  const match = Object.entries(headers).find(([entryKey]) => entryKey.toLowerCase() === normalizedKey);

  return match?.[1];
}

export function resolveBrowserToken(cookieName = "velo_token"): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
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

    const headers = config.headers as Record<string, string | undefined>;
    Object.assign(headers, authHeaders);

    return config;
  });

  return client;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return isRecord(value) && "data" in value && "error" in value && "statusCode" in value;
}

export function unwrapApiResponse<T>(value: T | ApiResponse<T>): T {
  return isApiResponse<T>(value) ? value.data : value;
}

function hasSpringPageShape<T>(value: unknown): value is SpringPage<T> {
  return isRecord(value) && Array.isArray(value.content) && typeof value.number === "number" && typeof value.size === "number";
}

export function unwrapSpringPage<T>(value: SpringPage<T> | PaginatedResponse<T> | ApiResponse<SpringPage<T>>): PaginatedResponse<T> {
  const payload = unwrapApiResponse(value);

  if (isRecord(payload) && "items" in payload && "meta" in payload) {
    return payload as PaginatedResponse<T>;
  }

  if (!hasSpringPageShape<T>(payload)) {
    throw new TypeError("Expected a Spring page payload with content, number, and size");
  }

  const pageNumber = payload.pageable?.pageNumber ?? payload.number;
  const pageSize = payload.pageable?.pageSize ?? payload.size;
  const total = payload.totalElements;
  const totalPages = payload.totalPages ?? (pageSize > 0 ? Math.ceil(total / pageSize) : 0);

  return {
    items: payload.content,
    meta: {
      page: pageNumber,
      size: pageSize,
      total,
      totalPages,
    },
  };
}

export async function requestData<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
): Promise<T> {
  const response = await client.request<T | ApiResponse<T>>(config);
  return unwrapApiResponse(response.data as T | ApiResponse<T>);
}

export async function requestPageData<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
): Promise<PaginatedResponse<T>> {
  const response = await client.request<SpringPage<T> | PaginatedResponse<T> | ApiResponse<SpringPage<T>>>(config);
  return unwrapSpringPage<T>(response.data);
}

export type RequestConfig = AxiosRequestConfig;
export type RequestResponse<T> = AxiosResponse<T>;
