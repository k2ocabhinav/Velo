"use client";

import { requestAdminProxy } from "./http";

export type ApiPage<T> = {
  content: T[];
  number: number;
  totalPages: number;
  totalElements: number;
  size: number;
};

export type DashboardStats = {
  totalUsers: number;
  totalDrivers: number;
  totalRides: number;
  totalRevenue: number | string;
  activeRides: number;
  pendingApprovals: number;
  ridesByStatus: Record<string, number>;
  revenueByDay: Record<string, number | string>;
};

export type DailyStats = {
  date: string;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRevenue: number | string;
  platformCommission: number | string;
  totalUsers: number;
  newUsers: number;
  activeDrivers: number;
  pendingDriverApprovals: number;
};

export type RevenueRow = {
  date: string;
  grossRevenue: number | string;
  platformCommission: number | string;
  driverEarnings: number | string;
  rideCount: number;
};

export type TopDriverRevenue = {
  driverId: number;
  driverName: string;
  trips: number;
  gross: number | string;
  commission: number | string;
  net: number | string;
};

export type PendingDriver = {
  driverId: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  rating: number;
  vehicleId: string;
  onboardingStatus?: string | null;
  appliedAt: string;
};

export type DriverStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";

export type BrandingSettings = {
  tenantId: number;
  brandName: string;
  primaryColor: string;
  logoUrl?: string | null;
  riderLabel: string;
  driverLabel: string;
  tripLabel: string;
  dispatchMode: "RIDE_HAILING" | "DELIVERY_MERCHANT" | "FLEET_MANAGED";
  riderPortalEnabled: boolean;
};

export type ScheduledRide = {
  id: number;
  paymentMethod: string;
  fare: number | string;
  scheduledTime: string;
  status: string;
};

export type PayoutItem = {
  id: number;
  amount: number | string;
  status: string;
  requestedAt: string;
};

export type AdminRecentAddress = {
  label: string;
  lat: number;
  lon: number;
  type: string;
};

export type PromoCode = {
  id: number;
  code: string;
  discountType: string;
  discountValue: number | string;
  maxUses?: number | null;
  currentUses?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  minRideFare?: number | string | null;
  active: boolean;
  description?: string | null;
};

export type UserAccount = {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  active?: boolean;
  roles?: string[];
};

export type PromoCodeMutation = {
  code?: string;
  discountType?: string;
  discountValue?: number;
  maxUses?: number;
  startDate?: string;
  endDate?: string;
  minRideFare?: number;
  active?: boolean;
  description?: string;
};

export type AdminPendingRideRequest = {
  rideRequestId: number;
  riderId?: number | null;
  riderName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  pickupAddress?: string | null;
  dropOffAddress?: string | null;
  externalReference?: string | null;
  status?: string | null;
  fare?: number | string | null;
  requestedTime?: string | null;
  offeredDriverCount?: number | null;
};

export type AdminActiveRide = {
  rideId: number;
  riderId?: number | null;
  riderName?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  status?: string | null;
  fare?: number | string | null;
  createdTime?: string | null;
  startedAt?: string | null;
};

export type AdminRideOffer = {
  offerId: number;
  driverId?: number | null;
  driverName?: string | null;
  status?: string | null;
  offeredAt?: string | null;
  expiresAt?: string | null;
  resolvedAt?: string | null;
  resolutionReason?: string | null;
};

export type AdminDispatchAudit = {
  id: number;
  actionType?: string | null;
  actorUserId?: number | null;
  rideRequestId?: number | null;
  rideId?: number | null;
  previousDriverId?: number | null;
  nextDriverId?: number | null;
  reason?: string | null;
  createdAt?: string | null;
};

export type AdminOpsHealth = {
  redisAvailable: boolean;
  cacheHits: number;
  cacheMisses: number;
  cacheErrors: number;
  totalRides: number;
  totalDrivers: number;
  totalRiders: number;
  pendingRideRequests: number;
  dispatchQueueDepth: number;
  expiredOfferCount: number;
  updatedAt?: string | null;
};

export type CreateDispatchRequestInput = {
  pickupLat: number;
  pickupLng: number;
  dropOffLat: number;
  dropOffLng: number;
  paymentMethod: "WALLET" | "CASH";
  customerName?: string;
  customerPhone?: string;
  pickupAddress?: string;
  dropOffAddress?: string;
  externalReference?: string;
};

export type CreateRiderInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type PageMeta = {
  page?: number;
  size?: number;
  total?: number;
  totalPages?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return fallback;
}

function unwrapData(payload: unknown): unknown {
  if (isRecord(payload) && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function toPage<T>(payload: unknown): ApiPage<T> {
  const value = unwrapData(payload);

  if (Array.isArray(value)) {
    return {
      content: value as T[],
      number: 0,
      totalPages: 1,
      totalElements: value.length,
      size: value.length,
    };
  }

  if (!isRecord(value)) {
    return {
      content: [],
      number: 0,
      totalPages: 1,
      totalElements: 0,
      size: 0,
    };
  }

  if (Array.isArray(value.content)) {
    const size = toInt(value.size, value.content.length);
    return {
      content: value.content as T[],
      number: toInt(value.number, 0),
      totalPages: Math.max(toInt(value.totalPages, 1), 1),
      totalElements: toInt(value.totalElements, value.content.length),
      size,
    };
  }

  if (Array.isArray(value.items)) {
    const meta = isRecord(value.meta) ? (value.meta as PageMeta) : {};
    const page = toInt(meta.page, 0);
    const size = toInt(meta.size, value.items.length);
    const total = toInt(meta.total, value.items.length);
    const totalPages = Math.max(toInt(meta.totalPages, size > 0 ? Math.ceil(total / size) : 1), 1);
    return {
      content: value.items as T[],
      number: page,
      totalPages,
      totalElements: total,
      size,
    };
  }

  return {
    content: [],
    number: 0,
    totalPages: 1,
    totalElements: 0,
    size: 0,
  };
}

function toList<T>(payload: unknown): T[] {
  const value = unwrapData(payload);

  if (Array.isArray(value)) {
    return value as T[];
  }

  if (isRecord(value) && Array.isArray(value.content)) {
    return value.content as T[];
  }

  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items as T[];
  }

  return [];
}

export function buildAdminCreateRiderPayload(payload: CreateRiderInput): {
  name: string;
  email: string;
  password: string;
} {
  const name = `${payload.firstName ?? ""} ${payload.lastName ?? ""}`.trim();
  return {
    name: name || payload.email,
    email: payload.email,
    password: payload.password,
  };
}

export const adminClient = {
  async getDashboardStats(): Promise<DashboardStats> {
    return requestAdminProxy<DashboardStats>("api/v1/admin/stats/dashboard");
  },

  async getDailyStats(date: string): Promise<DailyStats> {
    return requestAdminProxy<DailyStats>(
      `api/v1/admin/stats/daily?date=${encodeURIComponent(date)}`
    );
  },

  async getRevenue(startDate: string, endDate: string): Promise<RevenueRow[]> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/stats/revenue?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    );
    return toList<RevenueRow>(payload);
  },

  async getTopDriversByRevenue(days = 30): Promise<TopDriverRevenue[]> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/stats/revenue/top-drivers?days=${days}`
    );
    return toList<TopDriverRevenue>(payload);
  },

  async getPendingDrivers(page = 0, size = 10): Promise<ApiPage<PendingDriver>> {
    return adminClient.getDriversByStatus("PENDING", page, size);
  },

  async getDriversByStatus(status: DriverStatus, page = 0, size = 10): Promise<ApiPage<PendingDriver>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/drivers?status=${encodeURIComponent(status)}&page=${page}&size=${size}`
    );
    return toPage<PendingDriver>(payload);
  },

  async approveDriver(driverId: number): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/drivers/${driverId}/approve`, {
      method: "POST"
    });
  },

  async rejectDriver(driverId: number, reason: string): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/drivers/${driverId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: reason
    });
  },

  async suspendDriver(driverId: number): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/drivers/${driverId}/suspend`, {
      method: "POST"
    });
  },

  async revokeDriver(driverId: number): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/drivers/${driverId}/revoke`, {
      method: "POST"
    });
  },

  async getScheduledRides(page = 0, size = 10): Promise<ApiPage<ScheduledRide>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/scheduled-rides?page=${page}&size=${size}`
    );
    return toPage<ScheduledRide>(payload);
  },

  async getPendingPayouts(page = 0, size = 10): Promise<ApiPage<PayoutItem>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/payouts/pending?page=${page}&size=${size}`
    );
    return toPage<PayoutItem>(payload);
  },

  async approvePayout(id: number, note: string): Promise<PayoutItem> {
    return requestAdminProxy<PayoutItem>(`api/v1/admin/payouts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: note
    });
  },

  async rejectPayout(id: number, note: string): Promise<PayoutItem> {
    return requestAdminProxy<PayoutItem>(`api/v1/admin/payouts/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: note
    });
  },

  async processPayout(id: number): Promise<PayoutItem> {
    return requestAdminProxy<PayoutItem>(`api/v1/admin/payouts/${id}/process`, {
      method: "POST"
    });
  },

  async getUsers(page = 0, size = 10): Promise<ApiPage<UserAccount>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/users?page=${page}&size=${size}`
    );
    return toPage<UserAccount>(payload);
  },

  async activateUser(userId: number): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/users/${userId}/activate`, {
      method: "POST"
    });
  },

  async deactivateUser(userId: number): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/users/${userId}/deactivate`, {
      method: "POST"
    });
  },

  async createUser(payload: CreateRiderInput): Promise<UserAccount> {
    return requestAdminProxy<UserAccount>("auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAdminCreateRiderPayload(payload))
    });
  },

  async deleteRider(userId: number): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/users/${userId}/deactivate`, {
      method: "POST"
    });
  },

  async onboardDriver(userId: number, vehicleId: string): Promise<void> {
    await requestAdminProxy<void>(`auth/onBoardNewDriver/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId })
    });
  },

  async getPromoCodes(): Promise<PromoCode[]> {
    const payload = await requestAdminProxy<unknown>("api/v1/admin/promo-codes");
    return toList<PromoCode>(payload);
  },

  async deactivatePromoCode(id: number): Promise<PromoCode> {
    return requestAdminProxy<PromoCode>(`api/v1/admin/promo-codes/${id}/deactivate`, {
      method: "POST"
    });
  },

  async createPromoCode(payload: PromoCodeMutation): Promise<PromoCode> {
    return requestAdminProxy<PromoCode>("api/v1/admin/promo-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  async updatePromoCode(id: number, payload: PromoCodeMutation): Promise<PromoCode> {
    return requestAdminProxy<PromoCode>(`api/v1/admin/promo-codes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },

  async getPendingRideRequests(page = 0, size = 10): Promise<ApiPage<AdminPendingRideRequest>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/dispatch/requests?page=${page}&size=${size}`
    );
    return toPage<AdminPendingRideRequest>(payload);
  },

  async createDispatchRequest(payload: CreateDispatchRequestInput): Promise<void> {
    await requestAdminProxy<void>("api/v1/admin/dispatch/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupLocation: { coordinates: [payload.pickupLng, payload.pickupLat] },
        dropOffLocation: { coordinates: [payload.dropOffLng, payload.dropOffLat] },
        paymentMethod: payload.paymentMethod,
        customerName: payload.customerName ?? null,
        customerPhone: payload.customerPhone ?? null,
        pickupAddress: payload.pickupAddress ?? null,
        dropOffAddress: payload.dropOffAddress ?? null,
        externalReference: payload.externalReference ?? null,
      })
    });
  },

  async getActiveRides(page = 0, size = 10): Promise<ApiPage<AdminActiveRide>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/dispatch/active-rides?page=${page}&size=${size}`
    );
    return toPage<AdminActiveRide>(payload);
  },

  async getRecentDispatchAddresses(): Promise<AdminRecentAddress[]> {
    const payload = await requestAdminProxy<unknown>("api/v1/admin/dispatch/recent-addresses");
    return toList<AdminRecentAddress>(payload);
  },

  async getRideRequestOffers(rideRequestId: number): Promise<AdminRideOffer[]> {
    const payload = await requestAdminProxy<unknown>(`api/v1/admin/dispatch/requests/${rideRequestId}/offers`);
    return toList<AdminRideOffer>(payload);
  },

  async getDispatchAudit(page = 0, size = 10): Promise<ApiPage<AdminDispatchAudit>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/dispatch/audit?page=${page}&size=${size}`
    );
    return toPage<AdminDispatchAudit>(payload);
  },

  async assignPendingRideRequest(rideRequestId: number, driverId: number, reason: string): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/dispatch/requests/${rideRequestId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, reason })
    });
  },

  async reassignRide(rideId: number, driverId: number, reason: string): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/dispatch/rides/${rideId}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, reason })
    });
  },

  async cancelPendingRideRequest(rideRequestId: number, reason: string): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/dispatch/requests/${rideRequestId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
  },

  async cancelRide(rideId: number, reason: string): Promise<void> {
    await requestAdminProxy<void>(`api/v1/admin/dispatch/rides/${rideId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
  },

  async getOpsHealth(): Promise<AdminOpsHealth> {
    return requestAdminProxy<AdminOpsHealth>("api/v1/admin/ops-health");
  },

  async getBranding(): Promise<BrandingSettings> {
    return requestAdminProxy<BrandingSettings>("api/v1/admin/branding");
  },

  async updateBranding(payload: Omit<BrandingSettings, "tenantId" | "riderPortalEnabled">): Promise<BrandingSettings> {
    return requestAdminProxy<BrandingSettings>("api/v1/admin/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }
};
