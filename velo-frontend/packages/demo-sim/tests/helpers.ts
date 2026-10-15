import type { SimApi } from "../src/api/http-client.ts";
import type { StompMessageHandler, StompSession } from "../src/api/stomp-session.ts";
import type {
  AuthIdentity,
  DriverLocationUpdate,
  DriverProfileDto,
  RideDto,
  RideRequestDto,
  RideRequestPayload,
  RideTrackingDto,
  RiderProfileDto,
  TenantBrandingDto,
  WebSocketTicketDto,
} from "../src/types.ts";
import type { Clock } from "../src/sim/clock.ts";

export class FakeClock implements Clock {
  private currentTime = 1_800_000_000_000;
  readonly sleeps: number[] = [];

  now(): number {
    return this.currentTime;
  }

  sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    this.sleeps.push(milliseconds);
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? new Error("Operation aborted"));
    }
    if (milliseconds > 60_000) {
      return new Promise<void>((_resolve, reject) => {
        const abort = () => reject(signal?.reason ?? new Error("Operation aborted"));
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
    this.currentTime += milliseconds;
    return Promise.resolve();
  }

  every(): () => void {
    return () => undefined;
  }
}

export class FakeApi implements SimApi {
  readonly calls: string[] = [];
  readonly locations: DriverLocationUpdate[] = [];
  readonly requests: RideRequestPayload[] = [];
  acceptError: Error | null = null;
  requestId = 41;
  rideId = 91;
  riderOtp = "4821";
  driverEmail = "driver1@sim.velobusiness.demo";
  driverVehicleId = "KA01SV1001";
  riderEmail = "rider1@sim.velobusiness.demo";

  async login(email: string): Promise<AuthIdentity> {
    this.calls.push("login");
    return { token: "access", refreshToken: "refresh", expiresInSeconds: 900, userId: 1, email, role: "RIDER", tenantId: 1 };
  }

  async getTenantBranding(): Promise<TenantBrandingDto> {
    return { tenantId: 1, brandName: "Velo" };
  }

  async getDriverProfile(): Promise<DriverProfileDto> {
    this.calls.push("driver profile");
    return { id: 1, user: { name: "Arjun Rao", email: this.driverEmail, roles: ["DRIVER"] }, rating: 4.8, available: false, vehicleId: this.driverVehicleId };
  }

  async getRiderProfile(): Promise<RiderProfileDto> {
    this.calls.push("rider profile");
    return { id: 1, user: { name: "Priya Nair", email: this.riderEmail, roles: ["RIDER"] }, rating: 5 };
  }

  async updateDriverLocation(location: DriverLocationUpdate): Promise<void> {
    this.calls.push("location");
    this.locations.push(location);
  }

  async setAvailability(available: boolean): Promise<void> {
    this.calls.push(available ? "available" : "unavailable");
  }

  async requestRide(payload: RideRequestPayload): Promise<RideRequestDto> {
    this.calls.push("request ride");
    this.requests.push(payload);
    return { id: this.requestId, rideRequestStatus: "PENDING", expiresAt: "2100-01-01T00:00:00" };
  }

  async getActiveRide(): Promise<RideTrackingDto | null> {
    this.calls.push("active ride");
    return { rideId: this.rideId, rideRequestId: this.requestId, otp: this.riderOtp, status: "CONFIRMED" };
  }

  async acceptRide(rideRequestId: number): Promise<RideDto> {
    this.calls.push(`accept ${rideRequestId}`);
    if (this.acceptError) {
      throw this.acceptError;
    }
    return { id: this.rideId, rideStatus: "CONFIRMED" };
  }

  async startRide(rideId: number, otp: string): Promise<RideDto> {
    this.calls.push(`start ${rideId}:${otp}`);
    return { id: rideId, rideStatus: "ONGOING" };
  }

  async endRide(rideId: number): Promise<RideDto> {
    this.calls.push(`end ${rideId}`);
    return { id: rideId, rideStatus: "ENDED" };
  }

  async cancelRide(rideId: number): Promise<void> {
    this.calls.push(`cancel ${rideId}`);
  }

  async rateRider(rideId: number, rating: number): Promise<void> {
    this.calls.push(`rate rider ${rideId}:${rating}`);
  }

  async rateDriver(rideId: number, rating: number): Promise<void> {
    this.calls.push(`rate driver ${rideId}:${rating}`);
  }

  async getWebSocketTicket(): Promise<WebSocketTicketDto> {
    this.calls.push("ticket");
    return { ticket: "ticket", expiresInSeconds: 60 };
  }

  async logout(): Promise<void> {
    this.calls.push("logout");
  }
}

export class FakeStompSession {
  private readonly handlers = new Map<string, Set<StompMessageHandler>>();
  connected = false;

  readonly session = {
    connect: async (): Promise<void> => { this.connected = true; },
    subscribe: (destination: string, handler: StompMessageHandler): (() => void) => {
      const handlers = this.handlers.get(destination) ?? new Set<StompMessageHandler>();
      handlers.add(handler);
      this.handlers.set(destination, handlers);
      return () => handlers.delete(handler);
    },
    close: async (): Promise<void> => { this.connected = false; },
  } as unknown as StompSession;

  publish(destination: string, body: string): void {
    for (const handler of this.handlers.get(destination) ?? []) {
      handler(body);
    }
  }
}
