"use client";

import {
  requestProxyData,
  toCurrency as formatCurrency,
  unwrapPageItems
} from "@velo/app-core/browser-proxy";

export type DecimalValue = number | string;

export interface SpringPage<T> {
  content?: T[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

export async function requestRiderProxy<T>(path: string, init?: RequestInit): Promise<T> {
  return requestProxyData<T>(path, init, {
    pathPrefix: "/api/backend",
    defaultErrorMessage: "Request failed.",
    redirectOnUnauthorized: true,
    loginPath: "/login"
  });
}

export { unwrapPageItems };

export function toCurrency(value: DecimalValue | null | undefined): string {
  return formatCurrency(value, "—");
}

