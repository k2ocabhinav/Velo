import type { AxiosInstance } from "axios";
import { createVeloClient, requestData, requestPageData } from "./client";
import type {
  DecimalValue,
  DriverEarningDto,
  EarningsSummaryDto,
  ISODate,
  OffsetPageRequestInput,
  PaginatedResponse,
  PayoutRequestDto,
} from "./types";

export interface EarningsSummaryParams {
  period?: "DAILY" | "WEEKLY" | "MONTHLY";
  date?: ISODate;
}

export interface EarningsApi {
  getEarningsHistory(params?: OffsetPageRequestInput): Promise<PaginatedResponse<DriverEarningDto>>;
  getEarningsSummary(params?: EarningsSummaryParams): Promise<EarningsSummaryDto>;
  getBalance(): Promise<DecimalValue>;
  requestPayout(amount: DecimalValue): Promise<PayoutRequestDto>;
  getPayoutHistory(params?: OffsetPageRequestInput): Promise<PaginatedResponse<PayoutRequestDto>>;
}

export function createEarningsApi(client: AxiosInstance = createVeloClient()): EarningsApi {
  return {
    getEarningsHistory: (params) =>
      requestPageData<DriverEarningDto>(client, {
        method: "GET",
        url: "/drivers/earnings",
        params,
      }),
    getEarningsSummary: (params) =>
      requestData<EarningsSummaryDto>(client, {
        method: "GET",
        url: "/drivers/earnings/summary",
        params,
      }),
    getBalance: () =>
      requestData<DecimalValue>(client, {
        method: "GET",
        url: "/drivers/earnings/balance",
      }),
    requestPayout: (amount) =>
      requestData<PayoutRequestDto>(client, {
        method: "POST",
        url: "/drivers/earnings/payout",
        params: { amount },
      }),
    getPayoutHistory: (params) =>
      requestPageData<PayoutRequestDto>(client, {
        method: "GET",
        url: "/drivers/earnings/payouts",
        params,
      }),
  };
}
