import type { SimApi } from "../api/http-client.ts";
import { toPointDto } from "../api/http-client.ts";
import type { StompSession } from "../api/stomp-session.ts";
import type { RideUpdateEventDto, RouteCatalogue, SimAccount } from "../types.ts";
import type { SimLogger } from "../log.ts";
import type { Clock } from "./clock.ts";
import type { RideRegistry } from "./contracts.ts";
import { pickPoiPair } from "./poi-selection.ts";
import type { RandomSource } from "./random.ts";

export class RiderBot {
  activeRequestId: number | null = null;
  activeRideId: number | null = null;
  private requestInFlight = false;
  private stopped = false;
  private readonly lifecycleController = new AbortController();
  private unsubscribe: (() => void) | null = null;
  readonly account: SimAccount;
  private readonly api: SimApi;
  private readonly stomp: StompSession;
  private readonly catalogue: RouteCatalogue;
  private readonly clock: Clock;
  private readonly random: RandomSource;
  private readonly logger: SimLogger;
  private readonly registry: RideRegistry;

  constructor(
    account: SimAccount,
    api: SimApi,
    stomp: StompSession,
    catalogue: RouteCatalogue,
    clock: Clock,
    random: RandomSource,
    logger: SimLogger,
    registry: RideRegistry,
  ) {
    this.account = account;
    this.api = api;
    this.stomp = stomp;
    this.catalogue = catalogue;
    this.clock = clock;
    this.random = random;
    this.logger = logger;
    this.registry = registry;
  }

  async start(): Promise<void> {
    const profile = await this.api.getRiderProfile();
    if (profile.user.email !== this.account.email || !profile.user.roles.includes("RIDER")) {
      throw new Error(`Rider profile does not match configured account ${this.account.key}`);
    }
    this.unsubscribe = this.stomp.subscribe("/user/queue/ride-updates", (body) => this.receiveRideUpdate(body));
    await this.stomp.connect();
    this.logger.event(this.account.tenant, this.account.key, "connected");
  }

  async requestRide(): Promise<number | null> {
    if (this.stopped || this.requestInFlight || this.activeRequestId !== null) {
      return null;
    }
    this.requestInFlight = true;
    this.registry.beginRequest();
    const [pickup, dropOff] = pickPoiPair(this.catalogue.pois, this.random);
    try {
      const request = await this.api.requestRide({
        pickupLocation: toPointDto(pickup),
        dropOffLocation: toPointDto(dropOff),
        pickupAddress: pickup.name,
        dropOffAddress: dropOff.name,
        paymentMethod: "WALLET",
      });
      const requestId = request.id;
      if (!Number.isSafeInteger(requestId) || requestId! < 1) {
        throw new Error("Ride request response did not include a valid id");
      }
      if (this.stopped) {
        return null;
      }
      if (request.rideRequestStatus === "EXPIRED" || request.rideRequestStatus === "CANCELLED") {
        this.logger.event(this.account.tenant, this.account.key, "request unavailable", `request ${requestId}`);
        return null;
      }
      this.activeRequestId = requestId!;
      this.registry.register({
        requestId: requestId!,
        rider: this.account,
        pickup,
        dropOff,
        readOtp: (rideId) => this.readOtp(rideId),
        rateDriver: (rideId, rating) => this.api.rateDriver(rideId, rating),
        onCompleted: () => this.completeRequest(requestId!),
      });
      this.logger.event(this.account.tenant, this.account.key, "requested", `request ${requestId}`);
      void this.expireIfUnassigned(requestId!, request.expiresAt);
      return requestId!;
    } catch (error) {
      this.logger.error(this.account.tenant, this.account.key, "request ride", error);
      return null;
    } finally {
      this.requestInFlight = false;
      this.registry.endRequest();
    }
  }

  completeRequest(requestId: number): void {
    if (this.activeRequestId !== requestId) {
      return;
    }
    this.activeRequestId = null;
    this.activeRideId = null;
  }

  async readOtp(rideId: number): Promise<string | null> {
    const tracking = await this.api.getActiveRide();
    return tracking?.rideId === rideId && typeof tracking.otp === "string" && tracking.otp.length > 0
      ? tracking.otp
      : null;
  }

  stop(): void {
    this.stopped = true;
    this.lifecycleController.abort(new Error("Rider bot is stopping"));
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async closeSocket(): Promise<void> {
    await this.stomp.close();
  }

  private receiveRideUpdate(body: string): void {
    let event: unknown;
    try {
      event = JSON.parse(body) as unknown;
    } catch {
      this.logger.error(this.account.tenant, this.account.key, "ride update", new Error("Malformed WebSocket event"));
      return;
    }
    if (!isRideUpdate(event)) {
      return;
    }
    if (event.rideId) {
      this.activeRideId = event.rideId;
    }
    if (this.activeRequestId === null) {
      return;
    }
    if (event.eventType === "RIDE_COMPLETED" || event.eventType === "RIDE_CANCELLED"
      || event.status === "ENDED" || event.status === "CANCELLED") {
      const requestId = this.activeRequestId;
      this.registry.complete(requestId);
      this.logger.event(this.account.tenant, this.account.key, "ride closed", `request ${requestId}`);
    }
  }

  private async expireIfUnassigned(requestId: number, expiresAt: string | null | undefined): Promise<void> {
    const parsedExpiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const delay = Number.isFinite(parsedExpiry) ? Math.max(0, parsedExpiry - this.clock.now() + 2_000) : 100_000;
    try {
      await this.clock.sleep(delay, this.lifecycleController.signal);
      if (this.stopped || this.activeRequestId !== requestId) {
        return;
      }
      if (await this.api.getActiveRide()) {
        return;
      }
      this.registry.complete(requestId);
      this.logger.event(this.account.tenant, this.account.key, "request expired", `request ${requestId}`);
    } catch {
      // The bot is stopping or the ride was completed while waiting for expiry.
    }
  }
}

function isRideUpdate(value: unknown): value is RideUpdateEventDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const event = value as Record<string, unknown>;
  return (event.eventType === undefined || typeof event.eventType === "string")
    && (event.rideId === undefined || event.rideId === null || Number.isSafeInteger(event.rideId))
    && (event.status === undefined || event.status === null || typeof event.status === "string");
}
