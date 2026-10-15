import { ApiError } from "../api/http-client.ts";
import type { Poi, RouteCatalogue, SimTenant } from "../types.ts";
import type { RideRegistry } from "../sim/contracts.ts";
import type { Clock } from "../sim/clock.ts";
import type { DriverBot } from "../sim/driver-bot.ts";
import type { RiderBot } from "../sim/rider-bot.ts";
import type { RandomSource } from "../sim/random.ts";
import { weightedChoice } from "../sim/random.ts";
import { parseAction, type SimAction } from "./action-schema.ts";
import type { ConfigContext, TenantSimConfig } from "./runtime-config.ts";
import { ControlRequestError } from "./errors.ts";

const NO_IDLE_RIDERS = "All simulated guests are on transfers — try again in a moment";
const NO_GUEST_COULD_REQUEST = "No simulated guest could create a trip — try again in a moment";

export interface ActionTenantRuntime extends RideRegistry {
  tenant: SimTenant;
  riders: RiderBot[];
  drivers: DriverBot[];
  random: RandomSource;
  forceDeclines(count: number): void;
  setDriverOnline(driver: DriverBot, online: boolean): Promise<void>;
}

export interface ActionExecutorOptions {
  context: ConfigContext;
  catalogue: RouteCatalogue;
  clock: Clock;
  shutdownSignal?: AbortSignal;
  paused?(): boolean;
  tenant(slug: string): ActionTenantRuntime | undefined;
  config(slug: string): TenantSimConfig;
  publish(tenant: string, type: string, message: string, data?: Record<string, unknown>): void;
}

export interface ActionAccepted {
  summary: string;
  refs?: Record<string, unknown>;
}

export class ActionExecutor {
  private readonly options: ActionExecutorOptions;
  private readonly bursts = new Map<string, Set<AbortController>>();

  constructor(options: ActionExecutorOptions) {
    this.options = options;
  }

  cancelBursts(tenant?: string): void {
    for (const [slug, tasks] of this.bursts) {
      if (tenant !== undefined && slug !== tenant) continue;
      for (const task of tasks) task.abort(new Error("Simulator burst cancelled"));
    }
  }

  async execute(name: string, body: unknown): Promise<ActionAccepted> {
    const parsed = parseAction(name, body, this.options.context);
    if (!parsed.ok) throw new ControlRequestError(400, parsed.error);
    const action = parsed.action;
    const runtime = this.options.tenant(action.tenant);
    if (!runtime) throw new ControlRequestError(409, `Tenant ${action.tenant} is waiting for backend startup.`);

    const result = await this.run(action, runtime);
    this.options.publish(action.tenant, "action.accepted", result.summary, {
      action: action.type,
      ...(result.refs ?? {}),
    });
    return result;
  }

  private async run(action: SimAction, runtime: ActionTenantRuntime): Promise<ActionAccepted> {
    switch (action.type) {
      case "request-trip": {
        const riders = action.rider === undefined
          ? this.takeRandomRiders(this.idleRiders(runtime), this.idleRiders(runtime).length, runtime.random)
          : [this.chooseRider(runtime, action.rider)];
        const pickup = action.from ? this.poi(action.from) : undefined;
        const dropOff = action.to ? this.poi(action.to) : undefined;
        if (pickup && dropOff && pickup.id === dropOff.id) {
          throw new ControlRequestError(400, "from and to must be different POI ids.");
        }
        if (riders.length === 0) throw new ControlRequestError(409, NO_IDLE_RIDERS);
        const config = this.options.config(action.tenant);
        let rider: RiderBot | undefined;
        let requestId: number | null = null;
        for (const candidate of riders) {
          rider = candidate;
          requestId = await rider.requestRide({
            ...(pickup ? { from: pickup } : {}),
            ...(dropOff ? { to: dropOff } : {}),
            airportShare: config.airportShare,
            hotspots: config.hotspots,
            preferIntraCity: config.airportShare < 0.5,
          });
          if (requestId !== null) break;
        }
        if (requestId === null || rider === undefined) {
          if (action.rider !== undefined) {
            throw new ControlRequestError(409, `Rider ${rider?.name ?? action.rider} could not create a request.`);
          }
          throw new ControlRequestError(409, NO_GUEST_COULD_REQUEST);
        }
        const plan = runtime.get(requestId);
        const summary = `${rider.name} requested ${plan?.pickup.name ?? pickup?.name ?? "a pickup"} → ${plan?.dropOff.name ?? dropOff?.name ?? "a destination"}`;
        return { summary, refs: { rideRequestId: requestId } };
      }
      case "burst": {
        if (this.options.paused?.()) throw new ControlRequestError(409, "Resume the simulator before starting a burst.");
        const availableRiders = this.idleRiders(runtime);
        if (availableRiders.length === 0) throw new ControlRequestError(409, NO_IDLE_RIDERS);
        const near = action.near ? this.poi(action.near) : undefined;
        const burstRiders = this.takeRandomRiders(availableRiders, Math.min(action.count, availableRiders.length), runtime.random);
        let firstRequestId: number | null = null;
        let firstRiderIndex = 0;
        while (firstRiderIndex < burstRiders.length && firstRequestId === null) {
          firstRequestId = await this.requestTrip(burstRiders[firstRiderIndex]!, action.tenant, near);
          firstRiderIndex += 1;
        }
        if (firstRequestId === null) throw new ControlRequestError(409, NO_GUEST_COULD_REQUEST);
        const controller = new AbortController();
        const tasks = this.bursts.get(action.tenant) ?? new Set<AbortController>();
        tasks.add(controller);
        this.bursts.set(action.tenant, tasks);
        const remainingRiders = burstRiders.slice(firstRiderIndex, action.count);
        void this.finishBurst(remainingRiders, action.tenant, near, controller)
          .catch((error: unknown) => {
            this.options.publish(action.tenant, "action.failed", "Burst stopped after an unexpected error", {
              error: error instanceof Error ? error.message : "unknown error",
            });
          })
          .finally(() => {
            tasks.delete(controller);
            if (tasks.size === 0) this.bursts.delete(action.tenant);
          });
        const plannedCount = 1 + remainingRiders.length;
        const suffix = plannedCount < action.count ? `; ${action.count - plannedCount} skipped because only ${availableRiders.length} riders were idle` : "";
        return {
          summary: `Started a burst of ${plannedCount} requests spread over about 20 seconds${suffix}.`,
          refs: { rideRequestId: firstRequestId, plannedCount },
        };
      }
      case "driver-offline":
      case "driver-online": {
        const online = action.type === "driver-online";
        const driver = this.chooseDriver(runtime, action.driver, online);
        await runtime.setDriverOnline(driver, online);
        return { summary: `${driver.name} will ${online ? "come online" : "go offline"}${driver.rideId === null ? " now" : " after the active ride"}.` };
      }
      case "decline-next":
        runtime.forceDeclines(action.count);
        return { summary: `The next ${action.count} owned ride offer${action.count === 1 ? "" : "s"} will be declined.` };
      case "traffic-delay": {
        const driver = this.chooseDriver(runtime, action.driver, false);
        const delayedUntil = driver.applyTrafficDelay(action.seconds);
        return { summary: `${driver.name} slowed for ${action.seconds} seconds.`, refs: { delayedUntil } };
      }
      case "rider-cancel": {
        const requestId = action.rideRequestId ?? runtime.riders.find((rider) => rider.activeRequestId !== null)?.activeRequestId;
        if (requestId === undefined || requestId === null) throw new ControlRequestError(409, "There is no active bot rider request to cancel.");
        const plan = runtime.get(requestId);
        if (!plan) throw new ControlRequestError(409, `Request ${requestId} is not an active simulator request.`);
        const rider = runtime.riders.find((candidate) => candidate.account.key === plan.rider.key);
        if (!rider) throw new ControlRequestError(409, `No simulated rider owns request ${requestId}.`);
        const driver = runtime.drivers.find((candidate) => candidate.currentRequestId === requestId);
        let rideId: number | null;
        try {
          rideId = await rider.cancelRideRequest(requestId);
        } catch (error) {
          throw apiControlError(error, "Rider cancellation");
        }
        if (rideId !== null) driver?.cancelLocally(requestId, rideId);
        return {
          summary: rideId === null
            ? `${rider.name} cancelled pending request ${requestId}.`
            : `${rider.name} cancelled ride ${rideId}.`,
          refs: { rideRequestId: requestId, ...(rideId === null ? {} : { rideId }) },
        };
      }
      case "driver-cancel": {
        const driver = action.rideId === undefined
          ? runtime.drivers.find((candidate) => candidate.rideId !== null)
          : runtime.drivers.find((candidate) => candidate.rideId === action.rideId);
        if (!driver) throw new ControlRequestError(409, "No matching driver has an assigned ride to cancel.");
        try {
          const rideId = await driver.cancelCurrentRide(action.rideId);
          return { summary: `${driver.name} cancelled ride ${rideId}.`, refs: { rideId } };
        } catch (error) {
          throw apiControlError(error, "Driver cancellation");
        }
      }
      case "reset-fleet":
        this.cancelBursts(action.tenant);
        return this.resetFleet(runtime);
    }
  }

  private async resetFleet(runtime: ActionTenantRuntime): Promise<ActionAccepted> {
    const cancelled: number[] = [];
    const rideFailures: string[] = [];
    const parkingFailures: string[] = [];
    await Promise.all(runtime.riders.map((rider) => rider.waitForRequestSettlement()));
    for (const rider of runtime.riders) {
      const requestId = rider.activeRequestId;
      if (requestId === null) continue;
      const driver = runtime.drivers.find((candidate) => candidate.currentRequestId === requestId);
      try {
        const rideId = await this.cancelRequestForReset(rider, requestId);
        if (rideId !== null) driver?.cancelLocally(requestId, rideId);
        cancelled.push(requestId);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown cancellation error";
        rideFailures.push(`${rider.name} (request ${requestId}): ${detail}`);
      }
    }
    const hotspots = this.options.config(runtime.tenant.slug).hotspots
      .map((id) => this.options.catalogue.pois.find((poi) => poi.id === id))
      .filter((poi): poi is NonNullable<typeof poi> => poi !== undefined);
    const parking = hotspots.length > 0
      ? hotspots
      : this.options.catalogue.pois.filter((poi) => poi.kind === "airport" || poi.kind === "hotel");
    if (parking.length === 0) throw new ControlRequestError(500, "Fleet reset has no valid hotspot POIs to park the bots.");
    for (let index = 0; index < runtime.drivers.length; index += 1) {
      const driver = runtime.drivers[index]!;
      const poi = weightedChoice(parking, runtime.random);
      try {
        await driver.resetToPoi(poi);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown location error";
        parkingFailures.push(`${driver.name}: ${detail}`);
      }
    }
    for (let index = 0; index < runtime.riders.length; index += 1) {
      const rider = runtime.riders[index]!;
      if (rider.activeRequestId !== null) continue;
      rider.resetToPoi(weightedChoice(parking, runtime.random));
    }
    if (rideFailures.length > 0) {
      this.options.publish(runtime.tenant.slug, "action.failed", "Fleet reset could not close every simulated ride", {
        failures: rideFailures,
      });
      throw new ControlRequestError(409, `Fleet reset could not close these simulated rides: ${rideFailures.join("; ")}`);
    }
    if (parkingFailures.length > 0) {
      this.options.publish(runtime.tenant.slug, "action.failed", "Fleet reset could not park every simulated driver", {
        failures: parkingFailures,
      });
      throw new ControlRequestError(500, `Fleet reset could not park these simulated drivers: ${parkingFailures.join("; ")}`);
    }
    return {
      summary: `Fleet reset; cancelled ${cancelled.length} bot request${cancelled.length === 1 ? "" : "s"} and parked bots at hotspots.`,
      refs: { rideRequestIds: cancelled },
    };
  }

  private async finishBurst(riders: RiderBot[], tenant: string, near: Poi | undefined, controller: AbortController): Promise<void> {
    const signal = this.options.shutdownSignal
      ? AbortSignal.any([controller.signal, this.options.shutdownSignal])
      : controller.signal;
    for (let index = 0; index < riders.length; index += 1) {
      try {
        await this.options.clock.sleep(20_000 / (riders.length + 1), signal);
      } catch {
        return;
      }
      if (signal.aborted || this.options.paused?.() || !this.options.tenant(tenant)) return;
      const rider = riders[index]!;
      if (!rider.canRequest) continue;
      await this.requestTrip(rider, tenant, near);
    }
  }

  private async requestTrip(rider: RiderBot, tenant: string, near?: Poi): Promise<number | null> {
    const config = this.options.config(tenant);
    return rider.requestRide({
      ...(near ? { near } : {}),
      airportShare: config.airportShare,
      hotspots: config.hotspots,
      preferIntraCity: config.airportShare < 0.5,
    });
  }

  private chooseRider(runtime: ActionTenantRuntime, label?: string): RiderBot {
    if (label !== undefined) {
      const rider = runtime.riders.find((candidate) => matches(candidate.account.key, label)
        || matches(candidate.account.email, label) || matches(candidate.name, label));
      if (!rider) throw new ControlRequestError(400, `Unknown rider "${label}" for tenant ${runtime.tenant.slug}.`);
      if (!rider.canRequest) {
        const message = this.idleRiders(runtime).length === 0 ? NO_IDLE_RIDERS : `Rider ${rider.name} is on a transfer.`;
        throw new ControlRequestError(409, message);
      }
      return rider;
    }
    const idle = this.idleRiders(runtime);
    if (idle.length === 0) throw new ControlRequestError(409, NO_IDLE_RIDERS);
    return idle[Math.floor(runtime.random.next() * idle.length)]!;
  }

  private idleRiders(runtime: ActionTenantRuntime): RiderBot[] {
    return runtime.riders.filter((rider) => rider.canRequest);
  }

  private takeRandomRiders(riders: RiderBot[], count: number, random: RandomSource): RiderBot[] {
    const candidates = [...riders];
    const selected: RiderBot[] = [];
    while (selected.length < count && candidates.length > 0) {
      const index = Math.floor(random.next() * candidates.length);
      selected.push(candidates.splice(index, 1)[0]!);
    }
    return selected;
  }

  private async cancelRequestForReset(rider: RiderBot, requestId: number): Promise<number | null> {
    try {
      return await rider.cancelRideRequest(requestId);
    } catch (error) {
      if (error instanceof ApiError && error.status < 500 && error.status !== 409) throw error;
      await this.options.clock.sleep(250, this.options.shutdownSignal);
      if (rider.activeRequestId !== requestId) return null;
      return rider.cancelRideRequest(requestId);
    }
  }

  private chooseDriver(runtime: ActionTenantRuntime, label?: string, onlineTarget?: boolean): DriverBot {
    if (label !== undefined) {
      const driver = runtime.drivers.find((candidate) => matches(candidate.accountKey, label)
        || matches(candidate.email, label) || matches(candidate.name, label));
      if (!driver) throw new ControlRequestError(400, `Unknown driver "${label}" for tenant ${runtime.tenant.slug}.`);
      return driver;
    }
    const eligible = runtime.drivers.filter((driver) => onlineTarget === undefined
      || (onlineTarget ? driver.state === "offline" : driver.state !== "offline"));
    if (eligible.length === 0) throw new ControlRequestError(409, `No ${onlineTarget ? "offline" : "online"} driver is available.`);
    return eligible[Math.floor(runtime.random.next() * eligible.length)]!;
  }

  private poi(id: string) {
    const poi = this.options.catalogue.pois.find((candidate) => candidate.id === id);
    if (!poi) throw new ControlRequestError(400, `Unknown POI "${id}".`);
    return poi;
  }
}

function matches(value: string, label: string): boolean {
  return value.toLowerCase() === label.toLowerCase();
}

function apiControlError(error: unknown, operation: string): ControlRequestError {
  if (error instanceof ControlRequestError) return error;
  if (error instanceof ApiError && error.status === 409) {
    return new ControlRequestError(409, `${operation} was rejected: ${error.message}. The current ride state may not support cancellation.`);
  }
  if (error instanceof ApiError) return new ControlRequestError(error.status, `${operation} failed: ${error.message}.`);
  return new ControlRequestError(409, error instanceof Error ? `${operation} failed: ${error.message}` : `${operation} failed.`);
}
