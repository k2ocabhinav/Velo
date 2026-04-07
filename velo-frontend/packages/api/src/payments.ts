import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { PaymentMethodDto, PayoutDto, WalletDto, WalletTransactionDto } from "./types";

export interface PaymentMethodsApi {
  getPaymentMethods(): Promise<PaymentMethodDto[]>;
  addPaymentMethod(input: { type: string; token: string }): Promise<PaymentMethodDto>;
  deletePaymentMethod(id: number): Promise<void>;
  setDefaultPaymentMethod(id: number): Promise<PaymentMethodDto>;
}

export interface WalletApi {
  getWallet(): Promise<WalletDto>;
  getWalletTransactions(): Promise<WalletTransactionDto[]>;
  requestPayout(input: { amount: number; currency?: string }): Promise<PayoutDto>;
}

export function createPaymentsApi(client: AxiosInstance = createVeloClient()) {
  const paymentMethods: PaymentMethodsApi = {
    getPaymentMethods: () =>
      requestData<PaymentMethodDto[]>(client, {
        method: "GET",
        url: "/payment-methods",
      }),
    addPaymentMethod: (input) =>
      requestData<PaymentMethodDto>(client, {
        method: "POST",
        url: "/payment-methods",
        data: input,
      }),
    deletePaymentMethod: (id) =>
      requestData<void>(client, {
        method: "DELETE",
        url: `/payment-methods/${id}`,
      }).then(() => undefined),
    setDefaultPaymentMethod: (id) =>
      requestData<PaymentMethodDto>(client, {
        method: "PUT",
        url: `/payment-methods/${id}/default`,
      }),
  };

  const wallet: WalletApi = {
    getWallet: () =>
      requestData<WalletDto>(client, {
        method: "GET",
        url: "/wallet",
      }),
    getWalletTransactions: () =>
      requestData<WalletTransactionDto[]>(client, {
        method: "GET",
        url: "/wallet/transactions",
      }),
    requestPayout: (input) =>
      requestData<PayoutDto>(client, {
        method: "POST",
        url: "/drivers/earnings/payout",
        data: input,
      }),
  };

  return {
    paymentMethods,
    wallet,
  };
}
