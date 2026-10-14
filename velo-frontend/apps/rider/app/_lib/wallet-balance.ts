import type { DecimalValue } from "./rider-client";

let latestEstimatedBalance: string | null = null;

export function rememberWalletBalance(value: DecimalValue | null | undefined): void {
  if (value === null || value === undefined || value === "") return;
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) latestEstimatedBalance = String(value);
}

export function getRememberedWalletBalance(): string | null {
  return latestEstimatedBalance;
}

export function clearRememberedWalletBalance(): void {
  latestEstimatedBalance = null;
}
