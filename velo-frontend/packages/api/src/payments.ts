import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { PaymentMethodDto } from "./types";

export interface PaymentMethodsApi {
  listPaymentMethods(): Promise<PaymentMethodDto[]>;
  createPaymentMethod(input: PaymentMethodDto): Promise<PaymentMethodDto>;
  deletePaymentMethod(id: number): Promise<void>;
  setDefaultPaymentMethod(id: number): Promise<PaymentMethodDto>;
}

export function createPaymentsApi(client: AxiosInstance = createVeloClient()): PaymentMethodsApi {
  return {
    listPaymentMethods: () =>
      requestData<PaymentMethodDto[]>(client, {
        method: "GET",
        url: "/payment-methods",
      }),
    createPaymentMethod: (input) =>
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
}
