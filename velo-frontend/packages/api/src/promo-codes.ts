import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { PromoCodeDto } from "./types";

export interface PromoCodesApi {
  listActivePromoCodes(): Promise<PromoCodeDto[]>;
  listPromoCodes(): Promise<PromoCodeDto[]>;
  createPromoCode(input: PromoCodeDto): Promise<PromoCodeDto>;
  updatePromoCode(id: number, input: PromoCodeDto): Promise<PromoCodeDto>;
  deactivatePromoCode(id: number): Promise<PromoCodeDto>;
}

export function createPromoCodesApi(client: AxiosInstance = createVeloClient()): PromoCodesApi {
  return {
    listActivePromoCodes: () =>
      requestData<PromoCodeDto[]>(client, {
        method: "GET",
        url: "/promo-codes/active",
      }),
    listPromoCodes: () =>
      requestData<PromoCodeDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/promo-codes",
      }),
    createPromoCode: (input) =>
      requestData<PromoCodeDto>(client, {
        method: "POST",
        url: "/api/v1/admin/promo-codes",
        data: input,
      }),
    updatePromoCode: (id, input) =>
      requestData<PromoCodeDto>(client, {
        method: "PUT",
        url: `/api/v1/admin/promo-codes/${id}`,
        data: input,
      }),
    deactivatePromoCode: (id) =>
      requestData<PromoCodeDto>(client, {
        method: "POST",
        url: `/api/v1/admin/promo-codes/${id}/deactivate`,
      }),
  };
}
