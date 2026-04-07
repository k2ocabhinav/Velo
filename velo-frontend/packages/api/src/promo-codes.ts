import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type { PromoCodeCreateDto, PromoCodeDto, PromoCodeUpdateDto } from "./types";

export interface PromoCodesApi {
  listActivePromoCodes(): Promise<PromoCodeDto[]>;
  validatePromoCode(code: string): Promise<PromoCodeDto>;
  listPromoCodes(): Promise<PromoCodeDto[]>;
  createPromoCode(input: PromoCodeCreateDto): Promise<PromoCodeDto>;
  updatePromoCode(id: number, input: PromoCodeUpdateDto): Promise<PromoCodeDto>;
  deletePromoCode(id: number): Promise<void>;
  deactivatePromoCode(id: number): Promise<void>;
}

export function createPromoCodesApi(client: AxiosInstance = createVeloClient()): PromoCodesApi {
  return {
    listActivePromoCodes: () =>
      requestData<PromoCodeDto[]>(client, {
        method: "GET",
        url: "/promo-codes/active",
      }),
    validatePromoCode: (code) =>
      requestData<PromoCodeDto>(client, {
        method: "GET",
        url: `/promo-codes/${code}`,
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
    deletePromoCode: (id) =>
      requestData<void>(client, {
        method: "DELETE",
        url: `/api/v1/admin/promo-codes/${id}`,
      }).then(() => undefined),
    deactivatePromoCode: (id) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/promo-codes/${id}/deactivate`,
      }).then(() => undefined),
  };
}
