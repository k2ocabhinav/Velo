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

export type PendingDriver = {
  driverId: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  rating: number;
  vehicleId: string;
  appliedAt: string;
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

  async getPendingDrivers(page = 0, size = 10): Promise<ApiPage<PendingDriver>> {
    const payload = await requestAdminProxy<unknown>(
      `api/v1/admin/drivers/pending?page=${page}&size=${size}`
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
  }
};
