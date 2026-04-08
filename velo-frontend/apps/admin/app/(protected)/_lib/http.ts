"use client";

import { requestProxyData, toCurrency as formatCurrency } from "@velo/app-core/browser-proxy";

export interface ApiEnvelope<T> {
  data?: T;
  error?: unknown;
  statusCode?: number;
  timeStamp?: string;
}

export async function requestAdminProxy<T>(path: string, init?: RequestInit): Promise<T> {
  return requestProxyData<T>(path, init, {
    pathPrefix: "/api/proxy",
    defaultErrorMessage: "Request failed.",
  });
}

export function toCurrency(value: number | string | null | undefined): string {
  return formatCurrency(value, "—");
}
