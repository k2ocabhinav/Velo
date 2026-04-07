"use client";

export interface ApiEnvelope<T> {
  data?: T;
  error?: unknown;
  statusCode?: number;
  timeStamp?: string;
}

function getErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request failed.";
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) {
      return nested.message;
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return "Request failed.";
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

export async function requestAdminProxy<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/proxy/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

export function toCurrency(value: number | string | null | undefined): string {
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
