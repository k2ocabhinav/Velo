import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { DriverEarningDto, EarningsSummaryDto, PayoutDto } from "./types";

export interface EarningsApi {
  getEarningsHistory(): Promise<DriverEarningDto[]>;
  getEarningsSummary(): Promise<EarningsSummaryDto>;
  getBalance(): Promise<{ balance: number; currency: string }>;
  getPayoutHistory(): Promise<PayoutDto[]>;
}

export function createEarningsApi(client: AxiosInstance = createVeloClient()): EarningsApi {
  return {
    getEarningsHistory: () =>
      requestData<DriverEarningDto[]>(client, {
        method: "GET",
        url: "/drivers/earnings",
      }),
    getEarningsSummary: () =>
      requestData<EarningsSummaryDto>(client, {
        method: "GET",
        url: "/drivers/earnings/summary",
      }),
    getBalance: () =>
      requestData<{ balance: number; currency: string }>(client, {
        method: "GET",
        url: "/drivers/earnings/balance",
      }),
    getPayoutHistory: () =>
      requestData<PayoutDto[]>(client, {
        method: "GET",
        url: "/drivers/earnings/payouts",
      }),
  };
}
