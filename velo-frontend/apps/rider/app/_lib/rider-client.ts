"use client";

type RecordLike = Record<string, unknown>;

export type DecimalValue = number | string;

export interface SpringPage<T> {
  content?: T[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function unwrapData<T>(payload: unknown): T {
  if (isRecordLike(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function getErrorMessage(payload: unknown): string | null {
  if (!isRecordLike(payload)) {
    return null;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (isRecordLike(payload.error) && typeof payload.error.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return null;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("json") || contentType.includes("+json");

  if (isJson) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getProxyPath(path: string): string {
  return `/api/backend/${path.replace(/^\/+/, "")}`;
}

function redirectToLoginOnUnauthorized(): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = `${window.location.pathname}${window.location.search}`;
  const target = `/login?next=${encodeURIComponent(nextPath || "/")}`;
  window.location.assign(target);
}

export async function requestRiderProxy<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(getProxyPath(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    if (response.status === 401) {
      redirectToLoginOnUnauthorized();
    }
    throw new Error(getErrorMessage(payload) ?? "Request failed.");
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

export function toCurrency(value: DecimalValue | null | undefined): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}
