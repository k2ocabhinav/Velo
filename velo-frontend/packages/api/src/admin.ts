import type { AxiosInstance } from "axios";
import { createVeloClient, requestData } from "./client";
import type {
  AdminDashboardDto,
  AdminStatsDto,
  DriverApprovalDto,
  PaginatedResponse,
  PayoutDto,
  PromoCodeCreateDto,
  PromoCodeDto,
  PromoCodeUpdateDto,
  RevenueReportDto,
  ScheduledRideDto,
  UserAdminDto,
} from "./types";

export interface AdminListParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  query?: string;
}

export interface AdminApi {
  getDashboardStats(): Promise<AdminDashboardDto>;
  getDailyStats(): Promise<AdminStatsDto[]>;
  getRevenueStats(): Promise<RevenueReportDto[]>;
  getPendingDrivers(): Promise<DriverApprovalDto[]>;
  approveDriver(driverId: number): Promise<void>;
  rejectDriver(driverId: number): Promise<void>;
  getUsers(params?: AdminListParams): Promise<PaginatedResponse<UserAdminDto>>;
  activateUser(userId: number): Promise<void>;
  deactivateUser(userId: number): Promise<void>;
  getPendingPayouts(params?: AdminListParams): Promise<PaginatedResponse<PayoutDto>>;
  approvePayout(payoutId: number): Promise<void>;
  rejectPayout(payoutId: number): Promise<void>;
  processPayout(payoutId: number): Promise<void>;
  listPromoCodes(): Promise<PromoCodeDto[]>;
  createPromoCode(input: PromoCodeCreateDto): Promise<PromoCodeDto>;
  updatePromoCode(id: number, input: PromoCodeUpdateDto): Promise<PromoCodeDto>;
  deletePromoCode(id: number): Promise<void>;
  deactivatePromoCode(id: number): Promise<void>;
  getScheduledRides(params?: AdminListParams): Promise<ScheduledRideDto[]>;
}

export function createAdminApi(client: AxiosInstance = createVeloClient()): AdminApi {
  return {
    getDashboardStats: () =>
      requestData<AdminDashboardDto>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/dashboard",
      }),
    getDailyStats: () =>
      requestData<AdminStatsDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/daily",
      }),
    getRevenueStats: () =>
      requestData<RevenueReportDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/revenue",
      }),
    getPendingDrivers: () =>
      requestData<DriverApprovalDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/drivers/pending",
      }),
    approveDriver: (driverId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/drivers/${driverId}/approve`,
      }).then(() => undefined),
    rejectDriver: (driverId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/drivers/${driverId}/reject`,
      }).then(() => undefined),
    getUsers: (params) =>
      requestData<PaginatedResponse<UserAdminDto>>(client, {
        method: "GET",
        url: "/api/v1/admin/users",
        params,
      }),
    activateUser: (userId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/users/${userId}/activate`,
      }).then(() => undefined),
    deactivateUser: (userId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/users/${userId}/deactivate`,
      }).then(() => undefined),
    getPendingPayouts: (params) =>
      requestData<PaginatedResponse<PayoutDto>>(client, {
        method: "GET",
        url: "/api/v1/admin/payouts/pending",
        params,
      }),
    approvePayout: (payoutId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/payouts/${payoutId}/approve`,
      }).then(() => undefined),
    rejectPayout: (payoutId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/payouts/${payoutId}/reject`,
      }).then(() => undefined),
    processPayout: (payoutId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/payouts/${payoutId}/process`,
      }).then(() => undefined),
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
    getScheduledRides: (params) =>
      requestData<ScheduledRideDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/scheduled-rides",
        params,
      }),
  };
}
