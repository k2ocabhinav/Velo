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
} from "../types.ts";

export interface SimApi {
  login(email: string, password: string): Promise<AuthIdentity>;
  getTenantBranding(slug: string): Promise<TenantBrandingDto>;
  getDriverProfile(): Promise<DriverProfileDto>;
  getRiderProfile(): Promise<RiderProfileDto>;
  updateDriverLocation(location: DriverLocationUpdate): Promise<void>;
  setAvailability(available: boolean): Promise<void>;
  requestRide(payload: RideRequestPayload): Promise<RideRequestDto>;
  getActiveRide(): Promise<RideTrackingDto | null>;
  acceptRide(rideRequestId: number): Promise<RideDto>;
  startRide(rideId: number, otp: string): Promise<RideDto>;
  endRide(rideId: number): Promise<RideDto>;
  cancelRide(rideId: number): Promise<void>;
  cancelRiderRide(rideId: number): Promise<void>;
  rateRider(rideId: number, rating: number): Promise<void>;
  rateDriver(rideId: number, rating: number): Promise<void>;
  getWebSocketTicket(signal?: AbortSignal): Promise<WebSocketTicketDto>;
  logout(): Promise<void>;
}

export interface HttpClientOptions {
  apiBaseUrl: string;
  fetcher?: typeof fetch;
  now?: () => number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class VeloHttpClient implements SimApi {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private identity: AuthIdentity | null = null;
  private accessExpiresAt = 0;
  private refreshInFlight: Promise<void> | null = null;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.apiBaseUrl.replace(/\/+$/, "");
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  async login(email: string, password: string): Promise<AuthIdentity> {
    const identity = await this.request<AuthIdentity>("/auth/login", {
      method: "POST",
      body: { email, password },
      authenticated: false,
    });
    validateIdentity(identity);
    this.setIdentity(identity);
    return identity;
  }

  getTenantBranding(slug: string): Promise<TenantBrandingDto> {
    return this.request<TenantBrandingDto>(`/api/v1/public/tenant/branding?tenant=${encodeURIComponent(slug)}`, {
      method: "GET",
      authenticated: false,
    });
  }

  getDriverProfile(): Promise<DriverProfileDto> {
    return this.request("/drivers/getMyProfile", { method: "GET" });
  }

  getRiderProfile(): Promise<RiderProfileDto> {
    return this.request("/riders/getMyProfile", { method: "GET" });
  }

  async updateDriverLocation(location: DriverLocationUpdate): Promise<void> {
    await this.request("/drivers/location", { method: "PUT", body: location });
  }

  async setAvailability(available: boolean): Promise<void> {
    await this.request("/drivers/availability", { method: "PUT", body: { available } });
  }

  requestRide(payload: RideRequestPayload): Promise<RideRequestDto> {
    return this.request("/riders/requestRide", { method: "POST", body: payload });
  }

  getActiveRide(): Promise<RideTrackingDto | null> {
    return this.request("/riders/active-ride", { method: "GET" });
  }

  acceptRide(rideRequestId: number): Promise<RideDto> {
    return this.request(`/drivers/acceptRide/${rideRequestId}`, { method: "POST" });
  }

  startRide(rideId: number, otp: string): Promise<RideDto> {
    return this.request(`/drivers/startRide/${rideId}`, { method: "POST", body: { otp } });
  }

  endRide(rideId: number): Promise<RideDto> {
    return this.request(`/drivers/endRide/${rideId}`, { method: "POST" });
  }

  async cancelRide(rideId: number): Promise<void> {
    await this.request(`/drivers/cancelRide/${rideId}`, { method: "POST" });
  }

  async cancelRiderRide(rideId: number): Promise<void> {
    await this.request(`/riders/cancelRide/${rideId}`, { method: "POST" });
  }

  async rateRider(rideId: number, rating: number): Promise<void> {
    await this.request("/drivers/rateRider", { method: "POST", body: { rideId, rating } });
  }

  async rateDriver(rideId: number, rating: number): Promise<void> {
    await this.request("/riders/rateDriver", { method: "POST", body: { rideId, rating } });
  }

  getWebSocketTicket(signal?: AbortSignal): Promise<WebSocketTicketDto> {
    return this.request("/auth/ws-ticket", { method: "POST", signal });
  }

  async logout(): Promise<void> {
    if (!this.identity) {
      return;
    }
    const refreshToken = this.identity.refreshToken;
    try {
      await this.request("/auth/logout", { method: "POST", body: { refreshToken }, authenticated: false });
    } finally {
      this.identity = null;
      this.accessExpiresAt = 0;
    }
  }

  private async request<T>(
    path: string,
    options: { method: "GET" | "POST" | "PUT"; body?: unknown; authenticated?: boolean; signal?: AbortSignal },
  ): Promise<T> {
    const authenticated = options.authenticated ?? true;
    if (authenticated) {
      await this.ensureFreshAccessToken();
    }
    const headers = new Headers({ Accept: "application/json" });
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (authenticated && this.identity) {
      headers.set("Authorization", `Bearer ${this.identity.token}`);
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(12_000)])
        : AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        throw new ApiError(response.status, `API returned invalid JSON (${response.status})`);
      }
    }
    if (!response.ok) {
      throw new ApiError(response.status, `API request failed (${response.status})`);
    }
    return unwrapApiResponse<T>(payload);
  }

  private async ensureFreshAccessToken(): Promise<void> {
    if (!this.identity) {
      throw new Error("API session is not authenticated");
    }
    if (this.accessExpiresAt - this.now() > 60_000) {
      return;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshIdentity().finally(() => {
        this.refreshInFlight = null;
      });
    }
    await this.refreshInFlight;
  }

  private async refreshIdentity(): Promise<void> {
    const previous = this.identity;
    if (!previous) {
      throw new Error("Cannot refresh an unauthenticated API session");
    }
    const rotated = await this.request<AuthIdentity>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: previous.refreshToken },
      authenticated: false,
    });
    validateIdentity(rotated);
    if (rotated.userId !== previous.userId || rotated.tenantId !== previous.tenantId
      || rotated.role !== previous.role || rotated.email.toLowerCase() !== previous.email.toLowerCase()) {
      throw new TypeError("Refresh response changed the authenticated simulator identity");
    }
    this.setIdentity(rotated);
  }

  private setIdentity(identity: AuthIdentity): void {
    this.identity = identity;
    this.accessExpiresAt = this.now() + identity.expiresInSeconds * 1000;
  }
}

function unwrapApiResponse<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload && "error" in payload && "statusCode" in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validateIdentity(identity: AuthIdentity): void {
  if (!identity || typeof identity.token !== "string" || !identity.token
    || typeof identity.refreshToken !== "string" || !identity.refreshToken
    || typeof identity.email !== "string" || !identity.email
    || typeof identity.role !== "string" || !identity.role
    || !Number.isSafeInteger(identity.userId) || identity.userId < 1
    || !Number.isSafeInteger(identity.tenantId) || identity.tenantId < 1
    || !Number.isFinite(identity.expiresInSeconds) || identity.expiresInSeconds <= 0) {
    throw new TypeError("Authentication response is missing a valid identity or token expiry");
  }
}

export function toPointDto(point: { lat: number; lng: number }): { type: "Point"; coordinates: [number, number] } {
  return { type: "Point", coordinates: [point.lng, point.lat] };
}

export function localDateTime(nowMs: number): string {
  const date = new Date(nowMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
