import type { AxiosInstance } from "axios";
import { createVeloClient, requestData, requestPageData } from "./client";
import type {
  AdminActiveRideDto,
  AdminDispatchAuditDto,
  AdminOpsHealthDto,
  AdminPendingRideRequestDto,
  AdminStatsDto,
  AdminUserDto,
  AdminRideOfferDto,
  DashboardDto,
  PageRequestInput,
  PaginatedResponse,
  PendingDriverDto,
  PayoutRequestDto,
  RideDto,
  RideRequestDto,
  RevenueReportDto,
  ScheduledRideDto,
  TopDriverRevenueDto,
} from "./types";

export interface AdminApi {
  getDashboardStats(): Promise<DashboardDto>;
  getDailyStats(date: string): Promise<AdminStatsDto>;
  getRevenueStats(startDate: string, endDate: string): Promise<RevenueReportDto[]>;
  getTopDriversByRevenue(days?: number): Promise<TopDriverRevenueDto[]>;
  getPendingDrivers(params?: PageRequestInput): Promise<PaginatedResponse<PendingDriverDto>>;
  approveDriver(driverId: number): Promise<void>;
  rejectDriver(driverId: number, reason: string): Promise<void>;
  getUsers(params?: PageRequestInput): Promise<PaginatedResponse<AdminUserDto>>;
  activateUser(userId: number): Promise<void>;
  deactivateUser(userId: number): Promise<void>;
  getPendingPayouts(params?: PageRequestInput): Promise<PaginatedResponse<PayoutRequestDto>>;
  approvePayout(payoutId: number, adminNote?: string): Promise<PayoutRequestDto>;
  rejectPayout(payoutId: number, adminNote: string): Promise<PayoutRequestDto>;
  processPayout(payoutId: number): Promise<PayoutRequestDto>;
  getScheduledRides(params?: PageRequestInput): Promise<PaginatedResponse<ScheduledRideDto>>;
  getPendingRideRequests(params?: PageRequestInput): Promise<PaginatedResponse<AdminPendingRideRequestDto>>;
  getActiveRides(params?: PageRequestInput): Promise<PaginatedResponse<AdminActiveRideDto>>;
  getRideRequestOffers(rideRequestId: number): Promise<AdminRideOfferDto[]>;
  getDispatchAudit(params?: PageRequestInput): Promise<PaginatedResponse<AdminDispatchAuditDto>>;
  assignPendingRideRequest(rideRequestId: number, driverId: number, reason: string): Promise<RideDto>;
  reassignRide(rideId: number, driverId: number, reason: string): Promise<RideDto>;
  cancelPendingRideRequest(rideRequestId: number, reason: string): Promise<RideRequestDto>;
  cancelRide(rideId: number, reason: string): Promise<RideDto>;
  getOpsHealth(): Promise<AdminOpsHealthDto>;
}

function textBodyHeaders(): Record<string, string> {
  return { "Content-Type": "text/plain" };
}

export function createAdminApi(client: AxiosInstance = createVeloClient()): AdminApi {
  return {
    getDashboardStats: () =>
      requestData<DashboardDto>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/dashboard",
      }),
    getDailyStats: (date) =>
      requestData<AdminStatsDto>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/daily",
        params: { date },
      }),
    getRevenueStats: (startDate, endDate) =>
      requestData<RevenueReportDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/revenue",
        params: { startDate, endDate },
      }),
    getTopDriversByRevenue: (days = 30) =>
      requestData<TopDriverRevenueDto[]>(client, {
        method: "GET",
        url: "/api/v1/admin/stats/revenue/top-drivers",
        params: { days },
      }),
    getPendingDrivers: (params) =>
      requestPageData<PendingDriverDto>(client, {
        method: "GET",
        url: "/api/v1/admin/drivers/pending",
        params,
      }),
    approveDriver: (driverId) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/drivers/${driverId}/approve`,
      }).then(() => undefined),
    rejectDriver: (driverId, reason) =>
      requestData<void>(client, {
        method: "POST",
        url: `/api/v1/admin/drivers/${driverId}/reject`,
        data: reason,
        headers: textBodyHeaders(),
      }).then(() => undefined),
    getUsers: (params) =>
      requestPageData<AdminUserDto>(client, {
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
      requestPageData<PayoutRequestDto>(client, {
        method: "GET",
        url: "/api/v1/admin/payouts/pending",
        params,
      }),
    approvePayout: (payoutId, adminNote) => {
      return requestData<PayoutRequestDto>(client, {
        method: "POST",
        url: `/api/v1/admin/payouts/${payoutId}/approve`,
        ...(adminNote !== undefined
          ? {
              data: adminNote,
              headers: textBodyHeaders(),
            }
          : {}),
      });
    },
    rejectPayout: (payoutId, adminNote) =>
      requestData<PayoutRequestDto>(client, {
        method: "POST",
        url: `/api/v1/admin/payouts/${payoutId}/reject`,
        data: adminNote,
        headers: textBodyHeaders(),
      }),
    processPayout: (payoutId) =>
      requestData<PayoutRequestDto>(client, {
        method: "POST",
        url: `/api/v1/admin/payouts/${payoutId}/process`,
      }),
    getScheduledRides: (params) =>
      requestPageData<ScheduledRideDto>(client, {
        method: "GET",
        url: "/api/v1/admin/scheduled-rides",
        params,
      }),
    getPendingRideRequests: (params) =>
      requestPageData<AdminPendingRideRequestDto>(client, {
        method: "GET",
        url: "/api/v1/admin/dispatch/requests",
        params,
      }),
    getActiveRides: (params) =>
      requestPageData<AdminActiveRideDto>(client, {
        method: "GET",
        url: "/api/v1/admin/dispatch/active-rides",
        params,
      }),
    getRideRequestOffers: (rideRequestId) =>
      requestData<AdminRideOfferDto[]>(client, {
        method: "GET",
        url: `/api/v1/admin/dispatch/requests/${rideRequestId}/offers`,
      }),
    getDispatchAudit: (params) =>
      requestPageData<AdminDispatchAuditDto>(client, {
        method: "GET",
        url: "/api/v1/admin/dispatch/audit",
        params,
      }),
    assignPendingRideRequest: (rideRequestId, driverId, reason) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/api/v1/admin/dispatch/requests/${rideRequestId}/assign`,
        data: { driverId, reason },
      }),
    reassignRide: (rideId, driverId, reason) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/api/v1/admin/dispatch/rides/${rideId}/reassign`,
        data: { driverId, reason },
      }),
    cancelPendingRideRequest: (rideRequestId, reason) =>
      requestData<RideRequestDto>(client, {
        method: "POST",
        url: `/api/v1/admin/dispatch/requests/${rideRequestId}/cancel`,
        data: { reason },
      }),
    cancelRide: (rideId, reason) =>
      requestData<RideDto>(client, {
        method: "POST",
        url: `/api/v1/admin/dispatch/rides/${rideId}/cancel`,
        data: { reason },
      }),
    getOpsHealth: () =>
      requestData<AdminOpsHealthDto>(client, {
        method: "GET",
        url: "/api/v1/admin/ops-health",
      }),
  };
}
