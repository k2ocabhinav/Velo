import { ApiError, type SimApi } from "../api/http-client.ts";
import { toPointDto } from "../api/http-client.ts";
import type { StompSession } from "../api/stomp-session.ts";
import type { Poi, RideUpdateEventDto, RouteCatalogue, RiderState, SimAccount } from "../types.ts";
import type { SimLogger } from "../log.ts";
import type { Clock } from "./clock.ts";
import type { RideRegistry } from "./contracts.ts";
import { pickPoiPair, type PoiPairOptions } from "./poi-selection.ts";
import type { RandomSource } from "./random.ts";

const MAX_INTRA_CITY_DISTANCE_M = 15_000;
const MAX_INTRA_CITY_DURATION_S = 12 * 60;

export class RiderBot {
  activeRequestId: number | null = null;
  activeRideId: number | null = null;
  private rideStarted = false;
  private requestInFlight = false;
  private requestSettlement: Promise<void> = Promise.resolve();
  private resolveRequestSettlement: (() => void) | null = null;
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
  private readonly intraCityPairs: [Poi, Poi][];
  private currentPoi: RouteCatalogue["pois"][number] | null = null;
  private parkedAtPoi = false;

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
    this.intraCityPairs = catalogue.pois
      .filter((poi) => poi.kind !== "airport")
      .flatMap((pickup) => catalogue.pois
        .filter((dropOff) => dropOff.kind !== "airport" && dropOff.id !== pickup.id)
        .filter((dropOff) => {
          const route = catalogue.routes[`${pickup.id}>${dropOff.id}`];
          return route !== undefined && route.distanceM > 0
            && route.distanceM < MAX_INTRA_CITY_DISTANCE_M
            && route.durationS < MAX_INTRA_CITY_DURATION_S;
        })
        .map((dropOff): [Poi, Poi] => [pickup, dropOff]));
  }

  get state(): RiderState {
    if (this.activeRequestId === null) return "idle";
    if (this.rideStarted) return "on-trip";
    if (this.activeRideId !== null) return "assigned";
    return "requested";
  }

  get canRequest(): boolean {
    return !this.stopped && !this.requestInFlight && this.activeRequestId === null;
  }

  get name(): string {
    return this.account.displayName;
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

  async reconcileBackendState(): Promise<void> {
    const tracking = await this.api.getActiveRide();
    if (!tracking) return;
    if (tracking.rideId !== undefined && tracking.rideId !== null) {
      await this.api.cancelRiderRide(tracking.rideId);
      this.logger.event(this.account.tenant, this.account.key, "reconciled active ride", `ride ${tracking.rideId}`);
      return;
    }
    if (tracking.rideRequestId !== undefined && tracking.rideRequestId !== null) {
      await this.api.cancelRiderRequest(tracking.rideRequestId);
      this.logger.event(this.account.tenant, this.account.key, "reconciled pending request", `request ${tracking.rideRequestId}`);
      return;
    }
    throw new Error(`Rider ${this.account.key} has an active backend record without a ride or request id`);
  }

  async requestRide(options: PoiPairOptions = {}): Promise<number | null> {
    if (!this.canRequest) {
      return null;
    }
    this.requestInFlight = true;
    this.requestSettlement = new Promise<void>((resolve) => {
      this.resolveRequestSettlement = resolve;
    });
    this.registry.beginRequest();
    const selection = this.parkedAtPoi && this.currentPoi && !options.from && !options.near
      ? { ...options, from: this.currentPoi }
      : options;
    const [pickup, dropOff] = pickPoiPair(this.catalogue.pois, this.random, {
      ...selection,
      ...(selection.preferIntraCity ? { intraCityPairs: this.intraCityPairs } : {}),
    });
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
      this.currentPoi = dropOff;
      this.parkedAtPoi = false;
      this.registry.register({
        requestId: requestId!,
        rider: this.account,
        pickup,
        dropOff,
        readOtp: (rideId) => this.readOtp(rideId),
        rateDriver: (rideId, rating) => this.api.rateDriver(rideId, rating),
        onAssigned: (rideId) => { this.activeRideId = rideId; },
        onStarted: (rideId) => { this.activeRideId = rideId; this.rideStarted = true; },
        onCompleted: () => this.completeRequest(requestId!),
      });
      this.logger.event(this.account.tenant, this.account.key, "requested", `request ${requestId}`);
      void this.expireIfUnassigned(requestId!, request.expiresAt);
      return requestId!;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await this.reconcileConflictingBackendRequest();
      } else {
        this.logger.error(this.account.tenant, this.account.key, "request ride", error);
      }
      return null;
    } finally {
      this.requestInFlight = false;
      this.resolveRequestSettlement?.();
      this.resolveRequestSettlement = null;
      this.registry.endRequest();
    }
  }

  async waitForRequestSettlement(): Promise<void> {
    await this.requestSettlement;
  }

  completeRequest(requestId: number): void {
    if (this.activeRequestId !== requestId) {
      return;
    }
    this.activeRequestId = null;
    this.activeRideId = null;
    this.rideStarted = false;
  }

  async cancelRideRequest(requestId: number): Promise<number | null> {
    if (this.activeRequestId !== requestId) {
      throw new ApiError(409, `Rider ${this.account.key} does not own request ${requestId}`);
    }
    const tracking = await this.api.getActiveRide();
    if (tracking?.rideId && tracking.rideRequestId === requestId) {
      await this.cancelActiveRide(requestId, tracking.rideId);
      return tracking.rideId;
    }

    try {
      await this.api.cancelRiderRequest(requestId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      const updatedTracking = await this.api.getActiveRide();
      if (updatedTracking?.rideId && updatedTracking.rideRequestId === requestId) {
        await this.cancelActiveRide(requestId, updatedTracking.rideId);
        return updatedTracking.rideId;
      }
      if (updatedTracking?.rideRequestId !== requestId) {
        this.registry.complete(requestId);
        this.logger.event(this.account.tenant, this.account.key, "request already closed", `request ${requestId}`);
        return null;
      }
      throw error;
    }
    this.registry.complete(requestId);
    this.logger.event(this.account.tenant, this.account.key, "request cancelled", `request ${requestId}`);
    return null;
  }

  resetToPoi(poi: RouteCatalogue["pois"][number]): void {
    if (this.activeRequestId !== null) {
      throw new ApiError(409, `Rider ${this.account.key} still owns request ${this.activeRequestId}`);
    }
    this.currentPoi = poi;
    this.parkedAtPoi = true;
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
    const requestMatches = this.activeRequestId !== null && event.rideRequestId === this.activeRequestId;
    const rideMatches = this.activeRideId !== null && event.rideId === this.activeRideId;
    if (!requestMatches && !rideMatches) return;
    if (event.rideId) this.activeRideId = event.rideId;
    if (event.status === "ONGOING") {
      this.rideStarted = true;
    }
    if (event.eventType === "RIDE_COMPLETED" || event.eventType === "RIDE_CANCELLED"
      || event.status === "ENDED" || event.status === "CANCELLED") {
      const requestId = this.activeRequestId;
      if (requestId === null) return;
      this.registry.complete(requestId);
      this.logger.event(this.account.tenant, this.account.key, "ride closed", `request ${requestId}`);
    }
  }

  private async cancelActiveRide(requestId: number, rideId: number): Promise<void> {
    await this.api.cancelRiderRide(rideId);
    this.registry.complete(requestId);
    this.logger.event(this.account.tenant, this.account.key, "trip cancelled", `ride ${rideId}`);
  }

  private async reconcileConflictingBackendRequest(): Promise<void> {
    try {
      const tracking = await this.api.getActiveRide();
      if (!tracking?.rideRequestId) return;
      if (tracking.rideId) {
        await this.api.cancelRiderRide(tracking.rideId);
      } else {
        await this.api.cancelRiderRequest(tracking.rideRequestId);
      }
      this.logger.event(
        this.account.tenant,
        this.account.key,
        "cleared conflicting backend request",
        `request ${tracking.rideRequestId}`,
      );
    } catch (error) {
      this.logger.error(this.account.tenant, this.account.key, "reconcile request conflict", error);
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
    && (event.rideRequestId === undefined || event.rideRequestId === null || Number.isSafeInteger(event.rideRequestId))
    && (event.status === undefined || event.status === null || typeof event.status === "string");
}
