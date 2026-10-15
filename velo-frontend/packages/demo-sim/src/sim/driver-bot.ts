import { ApiError, type SimApi } from "../api/http-client.ts";
import { localDateTime } from "../api/http-client.ts";
import type { StompSession } from "../api/stomp-session.ts";
import { advanceMovement, createRouteMovement } from "../geo/movement.ts";
import type { DriverState, Poi, RouteCatalogue, SimAccount } from "../types.ts";
import type { SimLogger } from "../log.ts";
import type { Clock, SimulationClock } from "./clock.ts";
import type { RidePlan, RideRegistry } from "./contracts.ts";
import { integerBetween, type RandomSource } from "./random.ts";

interface DriverBotOptions {
  account: SimAccount;
  api: SimApi;
  stomp: StompSession;
  catalogue: RouteCatalogue;
  clock: Clock;
  simulationClock: SimulationClock;
  random: RandomSource;
  speedFactor: () => number;
  logger: SimLogger;
  registry: RideRegistry;
}

export class DriverBot {
  private stateValue: DriverState = "idle";
  rideId: number | null = null;
  private currentPoi: Poi | null = null;
  private movementController = new AbortController();
  private idleWaitController: AbortController | null = null;
  private unsubscribe: (() => void) | null = null;
  private completedCount = 0;
  private repositioningStarted = false;
  private readonly options: DriverBotOptions;

  constructor(options: DriverBotOptions) {
    this.options = options;
  }

  get name(): string {
    return this.options.account.displayName;
  }

  get state(): DriverState {
    return this.stateValue;
  }

  get completedRides(): number {
    return this.completedCount;
  }

  get tenant(): SimAccount["tenant"] {
    return this.options.account.tenant;
  }

  async start(): Promise<void> {
    const profile = await this.options.api.getDriverProfile();
    if (profile.user.email !== this.options.account.email || !profile.user.roles.includes("DRIVER")
      || (this.options.account.vehicleId !== undefined && profile.vehicleId !== this.options.account.vehicleId)) {
      throw new Error(`Driver profile does not match configured account ${this.options.account.key}`);
    }
    this.currentPoi = this.options.catalogue.pois[Math.floor(this.options.random.next() * this.options.catalogue.pois.length)]!;
    this.unsubscribe = this.options.stomp.subscribe("/user/queue/notifications", (body) => this.receiveNotification(body));
    await this.options.stomp.connect();
    await this.publishLocation(this.currentPoi, 0, 0);
    await this.options.api.setAvailability(true);
    this.options.logger.event(this.options.account.tenant, this.options.account.key, "online", this.currentPoi.id);
  }

  startIdleRepositioning(): void {
    if (!this.repositioningStarted) {
      this.repositioningStarted = true;
      void this.repositionLoop();
    }
  }

  async receiveNotification(body: string): Promise<void> {
    let notification: unknown;
    try {
      notification = JSON.parse(body) as unknown;
    } catch {
      this.options.logger.error(this.options.account.tenant, this.options.account.key, "notification", new Error("Malformed WebSocket event"));
      return;
    }
    if (!isOfferNotification(notification)) {
      return;
    }
    await this.handleOffer(notification.referenceId);
  }

  stopMovement(): void {
    this.setState("stopping");
    this.movementController.abort(new Error("Simulator is shutting down"));
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async setUnavailable(): Promise<void> {
    await this.options.api.setAvailability(false);
  }

  async closeSocket(): Promise<void> {
    await this.options.stomp.close();
  }

  private async handleOffer(requestId: number): Promise<void> {
    if (!this.options.registry.owns(requestId)) {
      for (let attempt = 0; attempt < 30 && !this.options.registry.owns(requestId)
        && this.options.registry.isRequestBeingCreated(); attempt += 1) {
        try {
          await this.options.clock.sleep(100, this.movementController.signal);
        } catch {
          return;
        }
      }
    }
    if (!this.options.registry.owns(requestId)) {
      return;
    }
    const isFirstOffer = this.options.registry.claimFirstOffer(requestId);
    if (this.state !== "idle") {
      return;
    }
    if (isFirstOffer && this.options.random.next() < 0.15) {
      this.options.logger.event(this.options.account.tenant, this.options.account.key, "exception ignored offer", `request ${requestId}`);
      return;
    }

    this.setState("thinking");
    this.options.logger.event(this.options.account.tenant, this.options.account.key, "thinking about request", requestId);
    let acceptedRideId: number | null = null;
    let rideStarted = false;
    let takenOffer = false;
    try {
      await this.options.simulationClock.sleep(integerBetween(this.options.random, 2, 6) * 1_000, this.movementController.signal);
      if (!this.isState("thinking")) {
        return;
      }
      let acceptedRide;
      try {
        acceptedRide = await this.options.api.acceptRide(requestId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          takenOffer = true;
          return;
        }
        throw error;
      }
      if (!Number.isSafeInteger(acceptedRide.id) || acceptedRide.id < 1) {
        throw new Error("Accept ride response did not include a valid ride id");
      }
      acceptedRideId = acceptedRide.id;
      this.rideId = acceptedRide.id;
      const plan = this.options.registry.get(requestId);
      if (!plan) {
        throw new Error("Accepted request has no simulator ride plan");
      }
      this.options.logger.event(this.options.account.tenant, this.options.account.key, "accepted", `request ${requestId}`);
      this.setState("to-pickup");
      await this.driveTo(plan.pickup, true);
      this.setState("waiting-rider");
      await this.options.simulationClock.sleep(integerBetween(this.options.random, 15, 30) * 1_000, this.movementController.signal);
      const otp = await this.readRiderOtp(plan, acceptedRide.id);
      await this.options.api.startRide(acceptedRide.id, otp);
      rideStarted = true;
      this.setState("on-trip");
      this.options.logger.event(this.options.account.tenant, this.options.account.key, "trip started", acceptedRide.id);
      await this.driveTo(plan.dropOff, false);
      await this.options.api.endRide(acceptedRide.id);
      this.completedCount += 1;
      this.options.registry.complete(requestId);
      this.options.logger.event(this.options.account.tenant, this.options.account.key, "trip completed", acceptedRide.id);
      this.setState("idle");
      this.rideId = null;
      const rating = integerBetween(this.options.random, 4, 5);
      const ratings = await Promise.allSettled([
        this.options.api.rateRider(acceptedRide.id, rating),
        plan.rateDriver(acceptedRide.id, rating),
      ]);
      for (const result of ratings) {
        if (result.status === "rejected") {
          this.options.logger.error(this.options.account.tenant, this.options.account.key, "ride rating", result.reason);
        }
      }
    } catch (error) {
      if (!takenOffer && !this.movementController.signal.aborted) {
        this.options.logger.error(this.options.account.tenant, this.options.account.key, "ride lifecycle", error);
      }
      if (acceptedRideId !== null && !rideStarted) {
        await this.options.api.cancelRide(acceptedRideId).catch((cancelError: unknown) => {
          if (!(cancelError instanceof ApiError && cancelError.status === 409)) {
            this.options.logger.error(this.options.account.tenant, this.options.account.key, "cancel incomplete ride", cancelError);
          }
        });
      }
    } finally {
      if (!this.isStopping() && !(rideStarted && this.isState("on-trip"))) {
        this.setState("idle");
        this.rideId = null;
      }
    }
  }

  private async readRiderOtp(plan: RidePlan, rideId: number): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const otp = await plan.readOtp(rideId);
      if (otp) {
        return otp;
      }
      await this.options.simulationClock.sleep(1_000, this.movementController.signal);
    }
    throw new Error(`Rider ${plan.rider.key} did not provide the OTP for ride ${rideId}`);
  }

  private async driveTo(destination: Poi, waitIfAlreadyThere: boolean): Promise<void> {
    const origin = this.currentPoi;
    if (!origin) {
      throw new Error("Driver has no current POI");
    }
    if (origin.id === destination.id) {
      if (waitIfAlreadyThere) {
        await this.options.simulationClock.sleep(10_000, this.movementController.signal);
      }
      return;
    }
    const route = this.options.catalogue.routes[`${origin.id}>${destination.id}`];
    if (!route) {
      throw new Error(`Route catalogue is missing ${origin.id}>${destination.id}`);
    }
    const movement = createRouteMovement(route, this.options.random);
    let lastTickAt = this.options.clock.now();
    while (true) {
      await this.options.clock.sleep(3_000, this.movementController.signal);
      const now = this.options.clock.now();
      const position = advanceMovement(movement, Math.max(0.001, (now - lastTickAt) / 1_000), this.options.speedFactor(), this.options.random);
      lastTickAt = now;
      await this.publishLocation(position, position.heading, position.speedKph);
      if (position.complete) {
        this.currentPoi = destination;
        return;
      }
    }
  }

  private async publishLocation(point: Poi | { lat: number; lng: number }, heading: number, speedKph: number): Promise<void> {
    try {
      await this.options.api.updateDriverLocation({
        lat: point.lat,
        lng: point.lng,
        heading,
        speedKph,
        accuracyM: 3,
        capturedAt: localDateTime(this.options.clock.now()),
      });
    } catch (error) {
      this.options.logger.error(this.options.account.tenant, this.options.account.key, "location update", error);
    }
  }

  private async repositionLoop(): Promise<void> {
    while (this.state !== "stopping") {
      if (this.state !== "idle") {
        try {
          await this.options.clock.sleep(100, this.movementController.signal);
        } catch {
          return;
        }
        continue;
      }
      const idleController = new AbortController();
      this.idleWaitController = idleController;
      try {
        await this.options.simulationClock.sleep(
          integerBetween(this.options.random, 2, 6) * 60_000,
          AbortSignal.any([this.movementController.signal, idleController.signal]),
        );
      } catch {
        if (this.movementController.signal.aborted) {
          return;
        }
        continue;
      } finally {
        if (this.idleWaitController === idleController) {
          this.idleWaitController = null;
        }
      }
      if (this.state !== "idle" || this.options.random.next() >= 0.3) {
        continue;
      }
      const destination = weightedHotspot(this.options.catalogue.pois, this.options.random);
      if (!destination || destination.id === this.currentPoi?.id) {
        continue;
      }
      this.setState("repositioning");
      this.options.logger.event(this.options.account.tenant, this.options.account.key, "repositioning", destination.id);
      try {
        await this.driveTo(destination, false);
      } catch (error) {
        if (!this.movementController.signal.aborted) {
          this.options.logger.error(this.options.account.tenant, this.options.account.key, "reposition", error);
        }
      } finally {
        if (!this.isStopping()) {
          this.setState("idle");
        }
      }
    }
  }

  private isStopping(): boolean {
    return this.state === "stopping";
  }

  private isState(state: DriverState): boolean {
    return this.stateValue === state;
  }

  private setState(state: DriverState): void {
    if (this.stateValue === state) {
      return;
    }
    const wasIdle = this.stateValue === "idle";
    this.stateValue = state;
    if (wasIdle && state !== "idle") {
      this.idleWaitController?.abort(new Error("Driver is no longer idle"));
      this.idleWaitController = null;
    }
  }
}

function isOfferNotification(value: unknown): value is { type: string; referenceId: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const notification = value as Record<string, unknown>;
  return notification.type === "RIDE_REQUESTED" && Number.isSafeInteger(notification.referenceId) && Number(notification.referenceId) > 0;
}

function weightedHotspot(pois: Poi[], random: RandomSource): Poi | undefined {
  const eligible = pois.filter((poi) => poi.kind === "airport" || poi.kind === "hotel" || poi.kind === "business");
  if (eligible.length === 0) {
    return undefined;
  }
  const total = eligible.reduce((sum, poi) => sum + poi.weight, 0);
  let choice = random.next() * total;
  for (const poi of eligible) {
    choice -= poi.weight;
    if (choice < 0) {
      return poi;
    }
  }
  return eligible[eligible.length - 1];
}
