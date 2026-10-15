import { ApiError, type SimApi } from "../api/http-client.ts";
import { localDateTime } from "../api/http-client.ts";
import type { StompSession } from "../api/stomp-session.ts";
import { advanceMovement, createRouteMovement } from "../geo/movement.ts";
import type { ControlDriverState, DriverState, Poi, RouteCatalogue, SimAccount } from "../types.ts";
import type { SimLogger } from "../log.ts";
import type { Clock, SimulationClock } from "./clock.ts";
import type { RidePlan, RideRegistry } from "./contracts.ts";
import type { TenantSimConfig } from "../control/runtime-config.ts";
import { integerBetween, weightedChoice, type RandomSource } from "./random.ts";

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
  config?: () => TenantSimConfig;
}

const DEFAULT_CONFIG: TenantSimConfig = {
  onlineDrivers: 0,
  requestIntervalSec: 75,
  airportShare: 0.4,
  declineProbability: 0.15,
  pickupWaitSec: [15, 30],
  idleRepositionProbability: 0.3,
  hotspots: [],
};

export class DriverBot {
  private stateValue: DriverState = "offline";
  private desiredOnline = false;
  private started = false;
  private rideIdValue: number | null = null;
  private requestIdValue: number | null = null;
  private currentPoi: Poi | null = null;
  private movementController = new AbortController();
  private activeRouteController: AbortController | null = null;
  private rideController: AbortController | null = null;
  private idleHeartbeatCancel: (() => void) | null = null;
  private idleHeartbeatEnabled = false;
  private unsubscribe: (() => void) | null = null;
  private completedCount = 0;
  private repositioningStarted = false;
  private delayedUntilValue: number | null = null;
  private readonly options: DriverBotOptions;

  constructor(options: DriverBotOptions) {
    this.options = options;
  }

  get name(): string {
    return this.options.account.displayName;
  }

  get email(): string {
    return this.options.account.email;
  }

  get accountKey(): string {
    return this.options.account.key;
  }

  get wantsOnline(): boolean {
    return this.desiredOnline;
  }

  get state(): ControlDriverState {
    if (this.stateValue === "stopping" || this.stateValue === "offline") return "offline";
    if (this.isDelayed()) return "delayed";
    switch (this.stateValue) {
      case "thinking": return "idle";
      case "waiting-rider": return "waiting";
      case "to-pickup": return "to-pickup";
      case "on-trip": return "on-trip";
      case "repositioning": return "repositioning";
      default: return "idle";
    }
  }

  get rideId(): number | null {
    return this.rideIdValue;
  }

  get currentRequestId(): number | null {
    return this.requestIdValue;
  }

  get poi(): string | null {
    return this.currentPoi?.name ?? null;
  }

  get delayedUntil(): number | null {
    return this.isDelayed() ? this.delayedUntilValue : null;
  }

  get completedRides(): number {
    return this.completedCount;
  }

  get tenant(): SimAccount["tenant"] {
    return this.options.account.tenant;
  }

  async start(online = true): Promise<void> {
    const profile = await this.options.api.getDriverProfile();
    if (profile.user.email !== this.options.account.email || !profile.user.roles.includes("DRIVER")
      || (this.options.account.vehicleId !== undefined && profile.vehicleId !== this.options.account.vehicleId)) {
      throw new Error(`Driver profile does not match configured account ${this.options.account.key}`);
    }
    this.currentPoi = weightedChoice(this.options.catalogue.pois, this.options.random);
    this.unsubscribe = this.options.stomp.subscribe("/user/queue/notifications", (body) => this.receiveNotification(body));
    await this.options.stomp.connect();
    await this.publishLocation(this.currentPoi, 0, 0);
    this.started = true;
    this.desiredOnline = online;
    await this.options.api.setAvailability(online);
    this.setState(online ? "idle" : "offline");
    if (online) this.startIdleHeartbeat();
    this.options.logger.event(this.tenant, this.options.account.key, online ? "online" : "offline", this.currentPoi.id);
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
      this.options.logger.error(this.tenant, this.options.account.key, "notification", new Error("Malformed WebSocket event"));
      return;
    }
    if (!isOfferNotification(notification)) return;
    await this.handleOffer(notification.referenceId);
  }

  async setOnline(online: boolean): Promise<void> {
    this.desiredOnline = online;
    if (!this.started || this.stateValue === "stopping") {
      if (!online) this.setState("offline");
      return;
    }
    if (!online) {
      this.stopIdleHeartbeat();
      if (this.rideIdValue !== null) return;
      this.activeRouteController?.abort(new Error("Driver is going offline"));
      await this.options.api.setAvailability(false);
      this.setState("offline");
      this.options.logger.event(this.tenant, this.options.account.key, "offline");
      return;
    }
    if (this.stateValue === "offline") {
      await this.options.api.setAvailability(true);
      this.setState("idle");
      this.options.logger.event(this.tenant, this.options.account.key, "online");
    }
    this.startIdleHeartbeat();
  }

  applyTrafficDelay(seconds: number): number {
    this.delayedUntilValue = this.options.clock.now() + seconds * 1_000;
    this.options.logger.event(this.tenant, this.options.account.key, "traffic delay", `${seconds}s`);
    return this.delayedUntilValue;
  }

  async cancelCurrentRide(expectedRideId?: number): Promise<number> {
    const rideId = this.rideIdValue;
    const requestId = this.requestIdValue;
    if (rideId === null || requestId === null || (expectedRideId !== undefined && expectedRideId !== rideId)) {
      throw new ApiError(409, "Driver has no matching assigned ride to cancel.");
    }
    await this.options.api.cancelRide(rideId);
    this.cancelLocally(requestId, rideId);
    this.options.registry.complete(requestId);
    return rideId;
  }

  cancelLocally(requestId: number, rideId: number): void {
    if (this.requestIdValue !== requestId || this.rideIdValue !== rideId) return;
    this.rideController?.abort(new Error("Ride cancelled by simulator control"));
    this.requestIdValue = null;
    this.rideIdValue = null;
    this.setState(this.desiredOnline ? "idle" : "offline");
  }

  async resetToPoi(poi: Poi): Promise<void> {
    if (this.rideIdValue !== null) throw new ApiError(409, "Cancel the driver's active ride before resetting its location.");
    this.activeRouteController?.abort(new Error("Driver fleet reset"));
    this.delayedUntilValue = null;
    this.currentPoi = poi;
    this.setState(this.desiredOnline ? "idle" : "offline");
    await this.publishLocation(poi, 0, 0);
  }

  stopMovement(): void {
    this.setState("stopping");
    this.stopIdleHeartbeat();
    this.movementController.abort(new Error("Simulator is shutting down"));
    this.rideController?.abort(new Error("Simulator is shutting down"));
    this.activeRouteController?.abort(new Error("Simulator is shutting down"));
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async setUnavailable(): Promise<void> {
    if (this.started) await this.options.api.setAvailability(false);
  }

  async closeSocket(): Promise<void> {
    await this.options.stomp.close();
  }

  private async handleOffer(requestId: number): Promise<void> {
    if (!this.desiredOnline || this.stateValue !== "idle") return;
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
    if (!this.options.registry.owns(requestId) || !this.desiredOnline || this.stateValue !== "idle") return;

    if (this.options.registry.consumeForcedDecline() || this.options.random.next() < this.config().declineProbability) {
      this.options.logger.event(this.tenant, this.options.account.key, "offer declined", `request ${requestId}`);
      return;
    }

    const lifecycle = new AbortController();
    this.rideController = lifecycle;
    this.setState("thinking");
    this.options.logger.event(this.tenant, this.options.account.key, "thinking about request", requestId);
    let acceptedRideId: number | null = null;
    let rideStarted = false;
    let takenOffer = false;
    try {
      await this.options.simulationClock.sleep(integerBetween(this.options.random, 2, 6) * 1_000, lifecycle.signal);
      if (!this.isState("thinking") || !this.desiredOnline) return;
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
      this.rideIdValue = acceptedRide.id;
      this.requestIdValue = requestId;
      const plan = this.options.registry.get(requestId);
      if (!plan) throw new Error("Accepted request has no simulator ride plan");
      plan.onAssigned(acceptedRide.id);
      this.options.logger.event(this.tenant, this.options.account.key, "accepted", `request ${requestId}`);
      this.setState("to-pickup");
      await this.driveTo(plan.pickup, true, lifecycle.signal);
      this.setState("waiting-rider");
      const [minimumWait, maximumWait] = this.config().pickupWaitSec;
      await this.options.simulationClock.sleep(integerBetween(this.options.random, minimumWait, maximumWait) * 1_000, lifecycle.signal);
      const otp = await this.readRiderOtp(plan, acceptedRide.id, lifecycle.signal);
      await this.options.api.startRide(acceptedRide.id, otp);
      rideStarted = true;
      plan.onStarted(acceptedRide.id);
      this.setState("on-trip");
      this.options.logger.event(this.tenant, this.options.account.key, "trip started", acceptedRide.id);
      await this.driveTo(plan.dropOff, false, lifecycle.signal);
      await this.options.api.endRide(acceptedRide.id);
      this.completedCount += 1;
      this.options.registry.complete(requestId);
      this.options.logger.event(this.tenant, this.options.account.key, "trip completed", acceptedRide.id);
      this.setState("idle");
      const rating = integerBetween(this.options.random, 4, 5);
      for (const rate of [
        () => this.options.api.rateRider(acceptedRide.id, rating),
        () => plan.rateDriver(acceptedRide.id, rating),
      ]) {
        try {
          await rate();
        } catch (error) {
          this.options.logger.error(this.tenant, this.options.account.key, "ride rating", error);
        }
      }
    } catch (error) {
      if (!takenOffer && !lifecycle.signal.aborted && !this.movementController.signal.aborted) {
        this.options.logger.error(this.tenant, this.options.account.key, "ride lifecycle", error);
      }
      if (acceptedRideId !== null && !rideStarted && !lifecycle.signal.aborted) {
        await this.options.api.cancelRide(acceptedRideId).catch((cancelError: unknown) => {
          if (!(cancelError instanceof ApiError && cancelError.status === 409)) {
            this.options.logger.error(this.tenant, this.options.account.key, "cancel incomplete ride", cancelError);
          }
        });
        this.options.registry.complete(requestId);
      }
    } finally {
      if (this.rideController === lifecycle) this.rideController = null;
      // Shutdown aborts movement before the rider API cancels the persisted ride.
      if (!this.isState("stopping")) {
        this.rideIdValue = null;
        this.requestIdValue = null;
        this.setState(this.desiredOnline ? "idle" : "offline");
        if (!this.desiredOnline) await this.setOnline(false).catch((error: unknown) => {
          this.options.logger.error(this.tenant, this.options.account.key, "set unavailable", error);
        });
      }
    }
  }

  private async readRiderOtp(plan: RidePlan, rideId: number, signal: AbortSignal): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const otp = await plan.readOtp(rideId);
      if (otp) return otp;
      await this.options.simulationClock.sleep(1_000, signal);
    }
    throw new Error(`Rider ${plan.rider.key} did not provide the OTP for ride ${rideId}`);
  }

  private async driveTo(destination: Poi, waitIfAlreadyThere: boolean, rideSignal?: AbortSignal): Promise<void> {
    const origin = this.currentPoi;
    if (!origin) throw new Error("Driver has no current POI");
    if (origin.id === destination.id) {
      if (waitIfAlreadyThere) await this.options.simulationClock.sleep(10_000, rideSignal);
      return;
    }
    const route = this.options.catalogue.routes[`${origin.id}>${destination.id}`];
    if (!route) throw new Error(`Route catalogue is missing ${origin.id}>${destination.id}`);
    const movement = createRouteMovement(route, this.options.random);
    const routeController = new AbortController();
    this.activeRouteController = routeController;
    const signals = [this.movementController.signal, routeController.signal];
    if (rideSignal) signals.push(rideSignal);
    const signal = AbortSignal.any(signals);
    let lastTickAt = this.options.clock.now();
    try {
      while (true) {
        await this.options.clock.sleep(3_000, signal);
        const now = this.options.clock.now();
        const delayFactor = this.isDelayed() ? 0.05 : 1;
        const position = advanceMovement(
          movement,
          Math.max(0.001, (now - lastTickAt) / 1_000),
          Math.max(0.001, this.options.speedFactor() * delayFactor),
          this.options.random,
        );
        lastTickAt = now;
        await this.publishLocation(position, position.heading, position.speedKph);
        if (position.complete) {
          this.currentPoi = destination;
          return;
        }
      }
    } catch (error) {
      if (!routeController.signal.aborted) throw error;
    } finally {
      if (this.activeRouteController === routeController) this.activeRouteController = null;
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
      this.options.logger.error(this.tenant, this.options.account.key, "location update", error);
    }
  }

  private startIdleHeartbeat(): void {
    if (!this.desiredOnline || this.stateValue === "stopping") return;
    this.idleHeartbeatEnabled = true;
    this.scheduleIdleHeartbeat();
  }

  private stopIdleHeartbeat(): void {
    this.idleHeartbeatEnabled = false;
    this.idleHeartbeatCancel?.();
    this.idleHeartbeatCancel = null;
  }

  private scheduleIdleHeartbeat(): void {
    if (!this.idleHeartbeatEnabled || this.idleHeartbeatCancel !== null) return;
    const intervalMs = integerBetween(this.options.random, 20, 30) * 1_000;
    let cancelInterval: () => void = () => undefined;
    cancelInterval = this.options.clock.every(intervalMs, () => {
      cancelInterval();
      if (this.idleHeartbeatCancel === cancelInterval) this.idleHeartbeatCancel = null;
      void this.publishIdleHeartbeat().finally(() => this.scheduleIdleHeartbeat());
    });
    this.idleHeartbeatCancel = cancelInterval;
  }

  private async publishIdleHeartbeat(): Promise<void> {
    const point = this.currentPoi;
    if (!this.idleHeartbeatEnabled || !this.desiredOnline || this.stateValue !== "idle" || !point) return;
    await this.publishLocation(point, 0, 0);
  }

  private async repositionLoop(): Promise<void> {
    while (this.stateValue !== "stopping") {
      if (this.stateValue !== "idle" || !this.desiredOnline) {
        try {
          await this.options.clock.sleep(100, this.movementController.signal);
        } catch {
          return;
        }
        continue;
      }
      try {
        await this.options.simulationClock.sleep(
          integerBetween(this.options.random, 2, 6) * 60_000,
          this.movementController.signal,
        );
      } catch {
        return;
      }
      if (this.stateValue !== "idle" || !this.desiredOnline
        || this.options.random.next() >= this.config().idleRepositionProbability) continue;
      const destination = weightedHotspot(this.options.catalogue.pois, this.config().hotspots, this.options.random);
      if (!destination || destination.id === this.currentPoi?.id) continue;
      this.setState("repositioning");
      this.options.logger.event(this.tenant, this.options.account.key, "repositioning", destination.id);
      try {
        await this.driveTo(destination, false);
      } catch (error) {
        if (!this.movementController.signal.aborted && this.desiredOnline) {
          this.options.logger.error(this.tenant, this.options.account.key, "reposition", error);
        }
      } finally {
        if (!this.isState("stopping")) this.setState(this.desiredOnline ? "idle" : "offline");
      }
      if (!this.desiredOnline) {
        await this.options.api.setAvailability(false).catch((error: unknown) => {
          this.options.logger.error(this.tenant, this.options.account.key, "set unavailable", error);
        });
      }
    }
  }

  private config(): TenantSimConfig {
    return this.options.config?.() ?? DEFAULT_CONFIG;
  }

  private isDelayed(): boolean {
    if (this.delayedUntilValue === null) return false;
    if (this.options.clock.now() < this.delayedUntilValue) return true;
    this.delayedUntilValue = null;
    this.options.logger.event(this.tenant, this.options.account.key, "traffic delay ended");
    return false;
  }

  private setState(state: DriverState): void {
    if (this.stateValue === state) return;
    this.stateValue = state;
    this.options.logger.event(this.tenant, this.options.account.key, "driver state", this.state);
  }

  private isState(state: DriverState): boolean {
    return this.stateValue === state;
  }
}

function isOfferNotification(value: unknown): value is { type: string; referenceId: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const notification = value as Record<string, unknown>;
  return notification.type === "RIDE_REQUESTED"
    && Number.isSafeInteger(notification.referenceId)
    && Number(notification.referenceId) > 0;
}

function weightedHotspot(pois: Poi[], hotspotIds: readonly string[], random: RandomSource): Poi | undefined {
  const hotspots = pois.filter((poi) => hotspotIds.includes(poi.id));
  const eligible = hotspots.length > 0
    ? hotspots
    : pois.filter((poi) => poi.kind === "airport" || poi.kind === "hotel" || poi.kind === "business");
  return eligible.length > 0 ? weightedChoice(eligible, random) : undefined;
}
