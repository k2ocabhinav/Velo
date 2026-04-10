import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { createAdminApi } from "../../src/admin";
import { createAuthApi } from "../../src/auth";
import { createDriversApi } from "../../src/drivers";
import { createEarningsApi } from "../../src/earnings";
import { createNotificationsApi } from "../../src/notifications";
import { createPaymentsApi } from "../../src/payments";
import { createPromoCodesApi } from "../../src/promo-codes";
import { createRidesApi } from "../../src/rides";
import type { ApiResponse, SpringPage } from "../../src/types";

function createRecordingClient<T>(responseData: T | ApiResponse<T>) {
  const requests: AxiosRequestConfig[] = [];

  const client = {
    request: async (config: AxiosRequestConfig): Promise<AxiosResponse<T | ApiResponse<T>>> => {
      requests.push(config);

      return {
        data: responseData,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    },
  } as unknown as AxiosInstance;

  return { client, requests };
}

describe("admin endpoints", () => {
  it("sends the required query params for analytics endpoints", async () => {
    const { client, requests } = createRecordingClient({
      totalUsers: 10,
      totalDrivers: 3,
      totalRides: 50,
      totalRevenue: 1234.56,
      activeRides: 2,
      pendingApprovals: 1,
      ridesByStatus: {},
      revenueByDay: {},
    });

    const api = createAdminApi(client);
    await api.getDailyStats("2026-04-07");
    await api.getRevenueStats("2026-04-01", "2026-04-07");

    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/stats/daily",
      params: { date: "2026-04-07" },
    });
    expect(requests[1]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/stats/revenue",
      params: { startDate: "2026-04-01", endDate: "2026-04-07" },
    });
  });

  it("unwraps spring pages for admin lists", async () => {
    const { client, requests } = createRecordingClient({
      content: [
        {
          id: 1,
          firstName: "Asha",
          lastName: "Patel",
          email: "asha@example.com",
          active: true,
          roles: ["RIDER"],
        },
      ],
      number: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    } satisfies SpringPage<unknown>);

    const api = createAdminApi(client);
    const page = await api.getUsers({ page: 2, size: 25 });

    expect(page.items).toHaveLength(1);
    expect(page.meta).toEqual({ page: 0, size: 10, total: 1, totalPages: 1 });
    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/users",
      params: { page: 2, size: 25 },
    });
  });

  it("sends plain text bodies for moderation endpoints", async () => {
    const { client, requests } = createRecordingClient({
      id: 42,
      amount: 18,
      status: "APPROVED",
      requestedAt: "2026-04-07T10:15:00",
    });

    const api = createAdminApi(client);
    await api.rejectDriver(9, "duplicate account");

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/admin/drivers/9/reject",
      data: "duplicate account",
      headers: { "Content-Type": "text/plain" },
    });
    expect("wallet" in (api as Record<string, unknown>)).toBe(false);
  });

  it("maps dispatch control and ops health endpoints", async () => {
    const pages = createRecordingClient({
      content: [],
      number: 0,
      size: 10,
      totalElements: 0,
      totalPages: 1,
    } satisfies SpringPage<unknown>);
    const offers = createRecordingClient([]);
    const rideMutation = createRecordingClient({
      id: 501,
      rideStatus: "CONFIRMED",
      paymentMethod: "WALLET",
      pickupLocation: { type: "Point", coordinates: [77.5946, 12.9716] },
      dropOffLocation: { type: "Point", coordinates: [77.6245, 12.9352] },
    });
    const requestMutation = createRecordingClient({
      id: 311,
      rideRequestStatus: "CANCELLED",
      paymentMethod: "WALLET",
      pickupLocation: { type: "Point", coordinates: [77.5946, 12.9716] },
      dropOffLocation: { type: "Point", coordinates: [77.6245, 12.9352] },
    });
    const health = createRecordingClient({
      redisAvailable: true,
      cacheHits: 12,
      cacheMisses: 3,
      cacheErrors: 0,
      totalRides: 20,
      totalDrivers: 4,
      totalRiders: 8,
      pendingRideRequests: 2,
      dispatchQueueDepth: 4,
      expiredOfferCount: 1,
    });

    const pageApi = createAdminApi(pages.client);
    await pageApi.getPendingRideRequests({ page: 1, size: 20 });
    await pageApi.getActiveRides({ page: 0, size: 5 });
    await pageApi.getDispatchAudit({ page: 2, size: 15 });

    expect(pages.requests[0]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/dispatch/requests",
      params: { page: 1, size: 20 },
    });
    expect(pages.requests[1]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/dispatch/active-rides",
      params: { page: 0, size: 5 },
    });
    expect(pages.requests[2]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/dispatch/audit",
      params: { page: 2, size: 15 },
    });

    const offersApi = createAdminApi(offers.client);
    await offersApi.getRideRequestOffers(311);
    expect(offers.requests[0]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/dispatch/requests/311/offers",
    });

    const rideApi = createAdminApi(rideMutation.client);
    await rideApi.assignPendingRideRequest(311, 4, "Manual assignment for SLA.");
    await rideApi.reassignRide(501, 2, "Load balancing override.");
    await rideApi.cancelRide(501, "Safety escalation.");
    expect(rideMutation.requests[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/admin/dispatch/requests/311/assign",
      data: { driverId: 4, reason: "Manual assignment for SLA." },
    });
    expect(rideMutation.requests[1]).toMatchObject({
      method: "POST",
      url: "/api/v1/admin/dispatch/rides/501/reassign",
      data: { driverId: 2, reason: "Load balancing override." },
    });
    expect(rideMutation.requests[2]).toMatchObject({
      method: "POST",
      url: "/api/v1/admin/dispatch/rides/501/cancel",
      data: { reason: "Safety escalation." },
    });

    const requestApi = createAdminApi(requestMutation.client);
    await requestApi.cancelPendingRideRequest(311, "Rider requested cancellation.");
    expect(requestMutation.requests[0]).toMatchObject({
      method: "POST",
      url: "/api/v1/admin/dispatch/requests/311/cancel",
      data: { reason: "Rider requested cancellation." },
    });

    const healthApi = createAdminApi(health.client);
    await healthApi.getOpsHealth();
    expect(health.requests[0]).toMatchObject({
      method: "GET",
      url: "/api/v1/admin/ops-health",
    });
  });
});

describe("auth and driver endpoints", () => {
  it("does not expose unsupported profile lookup methods", () => {
    const api = createAuthApi();
    expect(api).not.toHaveProperty("getProfile");
  });

  it("maps register to the signup endpoint contract", async () => {
    const { client, requests } = createRecordingClient({
      name: "Alex Rider",
      email: "alex@example.com",
      roles: ["RIDER"],
    });

    const api = createAuthApi(client);
    await api.register({
      name: "Alex Rider",
      email: "alex@example.com",
      password: "secret123",
      referredByCode: "VELO123",
    });

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/auth/signup",
      data: {
        name: "Alex Rider",
        email: "alex@example.com",
        password: "secret123",
        referredByCode: "VELO123",
      },
    });
  });

  it("maps auth requests to the current controller contract", async () => {
    const { client, requests } = createRecordingClient({
      token: "jwt",
      userId: 1,
      email: "user@example.com",
      role: "RIDER",
    });

    const api = createAuthApi(client);
    await api.signup({
      name: "Alex",
      email: "alex@example.com",
      password: "secret123",
    });

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/auth/signup",
      data: {
        name: "Alex",
        email: "alex@example.com",
        password: "secret123",
      },
    });
  });

  it("uses the driver availability and paging contract", async () => {
    const availability = createRecordingClient({
      id: 7,
      user: {
        name: "Driver One",
        email: "driver@example.com",
        roles: ["DRIVER"],
      },
      rating: 4.9,
      available: true,
      vehicleId: "VH-1",
    });

    const rides = createRecordingClient({
      content: [
        {
          id: 44,
          pickupLocation: { coordinates: [1, 2], type: "Point" },
          dropOffLocation: { coordinates: [3, 4], type: "Point" },
          paymentMethod: "CARD",
          rideStatus: "COMPLETED",
        },
      ],
      number: 0,
      size: 5,
      totalElements: 1,
      totalPages: 1,
    } satisfies SpringPage<unknown>);

    const driverApi = createDriversApi(availability.client);
    const ridesApi = createDriversApi(rides.client);
    await driverApi.setAvailability(true);
    await ridesApi.getMyRides({ pageOffset: 3, pageSize: 5 });

    expect(availability.requests[0]).toMatchObject({
      method: "PUT",
      url: "/drivers/availability",
      data: { available: true },
    });
    expect(rides.requests[0]).toMatchObject({
      method: "GET",
      url: "/drivers/getMyRides",
      params: { pageOffset: 3, pageSize: 5 },
    });
  });

  it("publishes driver location through the additive location endpoint", async () => {
    const { client, requests } = createRecordingClient({
      lat: 12.9716,
      lng: 77.5946,
      heading: 120,
      speedKph: 28,
      accuracyM: 9,
      capturedAt: "2026-04-09T11:20:00Z",
      updatedAt: "2026-04-09T11:20:01Z",
    });

    const api = createDriversApi(client);
    await api.updateLocation({
      lat: 12.9716,
      lng: 77.5946,
      heading: 120,
      speedKph: 28,
      accuracyM: 9,
      capturedAt: "2026-04-09T11:20:00Z",
    });

    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "/drivers/location",
      data: {
        lat: 12.9716,
        lng: 77.5946,
        heading: 120,
        speedKph: 28,
        accuracyM: 9,
        capturedAt: "2026-04-09T11:20:00Z",
      },
    });
  });

  it("supports rider rating through path variables for driver flows", async () => {
    const { client, requests } = createRecordingClient({
      id: 12,
      user: {
        name: "Rider One",
        email: "rider@example.com",
        roles: ["RIDER"],
      },
      rating: 4.8,
    });

    const api = createDriversApi(client);
    await api.rateRiderByRide(99, 5);

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/drivers/rateRider/99/5",
    });
  });
});

describe("rider and supporting domains", () => {
  it("uses booking contracts for fare estimate and immediate ride request", async () => {
    const fareEstimate = createRecordingClient({
      estimatedFare: 25,
      baseFare: 20,
      surgeMultiplier: 1,
      discountAmount: 0,
      distanceKm: 8,
      durationMinutes: 18,
      applicablePromos: [],
    });
    const requestRide = createRecordingClient({
      id: 77,
      pickupLocation: { coordinates: [1, 2], type: "Point" },
      dropOffLocation: { coordinates: [3, 4], type: "Point" },
      paymentMethod: "CARD",
      rideRequestStatus: "REQUESTED",
    });

    const estimateApi = createRidesApi(fareEstimate.client);
    const requestApi = createRidesApi(requestRide.client);

    const payload = {
      pickupLocation: { coordinates: [12.9, 77.5], type: "Point" as const },
      dropOffLocation: { coordinates: [12.95, 77.6], type: "Point" as const },
      paymentMethod: "CARD",
      promoCode: "SAVE10",
    };

    await estimateApi.getFareEstimate(payload);
    await requestApi.requestRide(payload);

    expect(fareEstimate.requests[0]).toMatchObject({
      method: "POST",
      url: "/riders/fare-estimate",
      data: payload,
    });
    expect(requestRide.requests[0]).toMatchObject({
      method: "POST",
      url: "/riders/requestRide",
      data: payload,
    });
  });

  it("supports rider rating through the path parameter variant", async () => {
    const { client, requests } = createRecordingClient({
      id: 19,
      user: {
        name: "Driver One",
        email: "driver@example.com",
        roles: ["DRIVER"],
      },
      rating: 4.9,
      available: true,
      vehicleId: "VH-1",
    });

    const api = createRidesApi(client);
    await api.rateDriverByRide(101, 4);

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/riders/rateDriver/101/4",
    });
  });

  it("reschedules rides through the required query parameter", async () => {
    const { client, requests } = createRecordingClient({
      id: 11,
      pickupLocation: { coordinates: [1, 2], type: "Point" },
      dropOffLocation: { coordinates: [3, 4], type: "Point" },
      paymentMethod: "CARD",
      fare: 19.5,
      scheduledTime: "2026-04-07T12:00:00",
      status: "SCHEDULED",
    });

    const api = createRidesApi(client);
    await api.rescheduleScheduledRide(11, "2026-04-08T09:00:00");

    expect(requests[0]).toMatchObject({
      method: "PUT",
      url: "/riders/scheduled-rides/11/reschedule",
      params: { newTime: "2026-04-08T09:00:00" },
    });
  });

  it("fetches rider active ride tracking through additive endpoint", async () => {
    const { client, requests } = createRecordingClient({
      rideId: 99,
      status: "ONGOING",
      canCancel: false,
      updatedAt: "2026-04-09T11:20:00Z",
    });

    const api = createRidesApi(client);
    await api.getActiveRide();

    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/riders/active-ride",
    });
  });

  it("keeps payment methods flat and excludes wallet endpoints", async () => {
    const { client, requests } = createRecordingClient([
      {
        id: 1,
        type: "CARD",
        lastFourDigits: "4242",
        expiryDate: "12/30",
        isDefault: true,
      },
    ]);

    const api = createPaymentsApi(client);
    const methods = await api.listPaymentMethods();

    expect(methods).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/payment-methods",
    });
    expect(api).not.toHaveProperty("wallet");
  });

  it("returns paginated notifications and numeric unread counts", async () => {
    const { client, requests } = createRecordingClient({
      content: [
        {
          id: 1,
          title: "Trip update",
          message: "Your driver is arriving",
          type: "RIDE",
          referenceId: 88,
          read: false,
          createdTime: "2026-04-07T08:00:00",
        },
      ],
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    } satisfies SpringPage<unknown>);

    const api = createNotificationsApi(client);
    const page = await api.listNotifications({ page: 0, size: 20 });

    expect(page.items).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/notifications",
      params: { page: 0, size: 20 },
    });
  });

  it("keeps promo codes limited to supported endpoints", () => {
    const api = createPromoCodesApi();
    expect(api).not.toHaveProperty("validatePromoCode");
    expect(api).not.toHaveProperty("deletePromoCode");
  });

  it("uses driver earnings query parameters and payout requests", async () => {
    const { client, requests } = createRecordingClient({
      content: [
        {
          id: 1,
          rideId: 99,
          grossFare: 50,
          platformCommission: 5,
          netEarning: 45,
          createdTime: "2026-04-07T07:30:00",
        },
      ],
      number: 1,
      size: 10,
      totalElements: 1,
      totalPages: 1,
    } satisfies SpringPage<unknown>);

    const api = createEarningsApi(client);
    await api.getEarningsHistory({ pageOffset: 1, pageSize: 10 });
    await api.requestPayout(25);

    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/drivers/earnings",
      params: { pageOffset: 1, pageSize: 10 },
    });
    expect(requests[1]).toMatchObject({
      method: "POST",
      url: "/drivers/earnings/payout",
      params: { amount: 25 },
    });
  });

  it("uses driver ride action endpoint contracts", async () => {
    const { client, requests } = createRecordingClient({
      id: 55,
      pickupLocation: { coordinates: [1, 2], type: "Point" },
      dropOffLocation: { coordinates: [3, 4], type: "Point" },
      paymentMethod: "WALLET",
      rideStatus: "CONFIRMED",
    });

    const api = createDriversApi(client);
    await api.acceptRide(11);
    await api.startRide(55, { otp: "1234" });
    await api.endRide(55);
    await api.cancelRide(55);

    expect(requests[0]).toMatchObject({
      method: "POST",
      url: "/drivers/acceptRide/11",
    });
    expect(requests[1]).toMatchObject({
      method: "POST",
      url: "/drivers/startRide/55",
      data: { otp: "1234" },
    });
    expect(requests[2]).toMatchObject({
      method: "POST",
      url: "/drivers/endRide/55",
    });
    expect(requests[3]).toMatchObject({
      method: "POST",
      url: "/drivers/cancelRide/55",
    });
  });

  it("uses notification unread and mark-read contracts", async () => {
    const { client, requests } = createRecordingClient({
      id: 9,
      title: "New ride request",
      message: "A rider is waiting nearby.",
      type: "RIDE_REQUESTED",
      read: false,
      createdTime: "2026-04-08T12:00:00",
    });

    const api = createNotificationsApi(client);
    await api.getUnreadCount();
    await api.markRead(9);
    await api.markAllRead();

    expect(requests[0]).toMatchObject({
      method: "GET",
      url: "/notifications/unread-count",
    });
    expect(requests[1]).toMatchObject({
      method: "POST",
      url: "/notifications/9/read",
    });
    expect(requests[2]).toMatchObject({
      method: "POST",
      url: "/notifications/read-all",
    });
  });
});
