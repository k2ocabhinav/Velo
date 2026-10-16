import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../src/api/http-client.ts";
import { ActionExecutor, type ActionTenantRuntime } from "../../src/control/action-executor.ts";
import type { ConfigContext, TenantSimConfig } from "../../src/control/runtime-config.ts";
import { loadRouteCatalogue } from "../../src/geo/route-catalogue.ts";
import { SimLogger } from "../../src/log.ts";
import { SIM_TENANTS } from "../../src/config.ts";
import { SimulationClock } from "../../src/sim/clock.ts";
import type { RidePlan, RideRegistry } from "../../src/sim/contracts.ts";
import { DriverBot } from "../../src/sim/driver-bot.ts";
import { RiderBot } from "../../src/sim/rider-bot.ts";
import type { RandomSource } from "../../src/sim/random.ts";
import type { RouteCatalogue } from "../../src/types.ts";
import { FakeApi, FakeClock, FakeStompSession } from "../helpers.ts";

const fixedRandom: RandomSource = { next: () => 0.5 };
const fixtureDirectory = new URL("../fixtures/", import.meta.url);

describe("control actions execute against simulator bots and APIs", () => {
  it("requests trips and starts a bounded burst using configured POI choices", async () => {
    const harness = await makeHarness();
    const first = await harness.executor.execute("request-trip", {
      tenant: "default", from: "hotel", to: "kia-t1", rider: "rider1",
    });
    expect(first.refs).toEqual({ rideRequestId: 101 });
    expect(first.summary).toContain("Priya Nair requested Test Hotel → Airport Terminal");
    expect(harness.riderApis[0]!.requests[0]).toMatchObject({ pickupAddress: "Test Hotel", dropOffAddress: "Airport Terminal" });

    const burst = await harness.executor.execute("burst", { tenant: "default", count: 3, near: "hotel" });
    expect(burst.refs?.plannedCount).toBe(3);
    expect(Number.isSafeInteger(burst.refs?.rideRequestId)).toBe(true);
    await flushMicrotasks();
    expect(harness.riderApis.reduce((total, api) => total + api.requests.length, 0)).toBe(4);
    expect(harness.riderApis.filter((api) => api.requests.length === 1)).toHaveLength(4);
    await harness.close();
  });

  it("keeps steady requests on short city routes while airport-rush retains airport legs", async () => {
    const harness = await makeHarness();
    const steady = await harness.executor.execute("request-trip", { tenant: "default" });
    const steadyPlan = harness.registry.get(steady.refs?.rideRequestId as number)!;
    const steadyRoute = harness.catalogue.routes[`${steadyPlan.pickup.id}>${steadyPlan.dropOff.id}`]!;
    expect(steadyRoute.distanceM).toBeLessThan(15_000);
    expect(steadyRoute.durationS).toBeLessThan(12 * 60);

    harness.setAirportShare(0.8);
    const airportRush = await harness.executor.execute("request-trip", { tenant: "default" });
    const airportPlan = harness.registry.get(airportRush.refs?.rideRequestId as number)!;
    expect(airportPlan.pickup.kind === "airport" || airportPlan.dropOff.kind === "airport").toBe(true);
    await harness.close();
  });

  it("reports the same clear conflict for trip and burst actions when no guest is idle", async () => {
    const harness = await makeHarness();
    harness.riders.forEach((rider, index) => { rider.activeRequestId = 900 + index; });

    await expect(harness.executor.execute("request-trip", { tenant: "default" }))
      .rejects.toMatchObject({ status: 409, message: "All simulated guests are on transfers — try again in a moment" });
    await expect(harness.executor.execute("burst", { tenant: "default", count: 2 }))
      .rejects.toMatchObject({ status: 409, message: "All simulated guests are on transfers — try again in a moment" });

    harness.riders.forEach((rider) => { rider.activeRequestId = null; });
    await harness.close();
  });

  it("tries another idle guest when the selected rider has a stale backend request", async () => {
    const harness = await makeHarness();
    const conflictingApi = harness.riderApis[5]!;
    conflictingApi.requestRide = async (payload) => {
      conflictingApi.requests.push(payload);
      conflictingApi.activeRideOverride = { rideRequestId: 700, status: "PENDING" };
      throw new ApiError(409, "Rider already has an active request");
    };
    conflictingApi.cancelRiderRequest = async (requestId) => {
      conflictingApi.calls.push(`rider cancel request ${requestId}`);
      conflictingApi.activeRideOverride = null;
    };

    const result = await harness.executor.execute("request-trip", { tenant: "default" });

    expect(result.refs).toEqual({ rideRequestId: 105 });
    expect(result.summary).toContain("Leah Parker requested");
    expect(conflictingApi.calls).toContain("rider cancel request 700");
    expect(harness.riders[5]!.canRequest).toBe(true);
    expect(harness.riderApis[4]!.requests).toHaveLength(1);
    await harness.close();
  });

  it("cancels an ongoing backend ride during fleet reset", async () => {
    const harness = await makeHarness();
    const rider = harness.riders[0]!;
    const riderApi = harness.riderApis[0]!;
    const requestId = await rider.requestRide({ from: harness.catalogue.pois[0], to: harness.catalogue.pois[1] });
    expect(requestId).toBe(101);
    riderApi.activeRideOverride = { rideId: 611, rideRequestId: requestId, status: "ONGOING" };

    const reset = await harness.executor.execute("reset-fleet", { tenant: "default" });

    expect(reset.summary).toContain("cancelled 1 bot request");
    expect(riderApi.calls).toContain("rider cancel 611");
    expect(rider.activeRequestId).toBeNull();
    await harness.close();
  });

  it("releases a rider after repeated request API conflicts so a later trip can proceed", async () => {
    const harness = await makeHarness();
    const rider = harness.riders[0]!;
    const riderApi = harness.riderApis[0]!;
    const requestRide = riderApi.requestRide.bind(riderApi);
    const cancelRequest = riderApi.cancelRiderRequest.bind(riderApi);
    let conflictsRemaining = 2;
    riderApi.requestRide = async (payload) => {
      if (conflictsRemaining > 0) {
        conflictsRemaining -= 1;
        riderApi.activeRideOverride = { rideRequestId: 700 + conflictsRemaining, status: "PENDING" };
        throw new ApiError(409, "Rider already has an active request");
      }
      return requestRide(payload);
    };
    riderApi.cancelRiderRequest = async (id) => {
      await cancelRequest(id);
      riderApi.activeRideOverride = null;
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(harness.executor.execute("request-trip", { tenant: "default", rider: "rider1" }))
        .rejects.toMatchObject({ status: 409 });
      expect(rider.canRequest).toBe(true);
    }
    const result = await harness.executor.execute("request-trip", { tenant: "default", rider: "rider1" });

    expect(result.refs).toEqual({ rideRequestId: 101 });
    expect(riderApi.calls.filter((call) => call.startsWith("rider cancel request "))).toHaveLength(2);
    expect(rider.state).toBe("requested");
    await harness.close();
  });

  it("cancels pending burst work when paused, reset, or shutdown is requested", async () => {
    const pausedHarness = await makeHarness(false, new HeldBurstClock());
    await pausedHarness.executor.execute("burst", { tenant: "default", count: 3 });
    await (pausedHarness.clock as HeldBurstClock).waitForBurstSleep();
    pausedHarness.setPaused(true);
    pausedHarness.executor.cancelBursts("default");
    await flushMicrotasks();
    expect(pausedHarness.riderApis.reduce((sum, api) => sum + api.requests.length, 0)).toBe(1);
    await pausedHarness.close();

    const resetHarness = await makeHarness(false, new HeldBurstClock());
    await resetHarness.executor.execute("burst", { tenant: "default", count: 3 });
    await (resetHarness.clock as HeldBurstClock).waitForBurstSleep();
    await resetHarness.executor.execute("reset-fleet", { tenant: "default" });
    await flushMicrotasks();
    expect(resetHarness.riderApis.reduce((sum, api) => sum + api.requests.length, 0)).toBe(1);
    await resetHarness.close();

    const shutdownHarness = await makeHarness(false, new HeldBurstClock());
    await shutdownHarness.executor.execute("burst", { tenant: "default", count: 3 });
    await (shutdownHarness.clock as HeldBurstClock).waitForBurstSleep();
    shutdownHarness.shutdown.abort(new Error("shutdown"));
    await flushMicrotasks();
    expect(shutdownHarness.riderApis.reduce((sum, api) => sum + api.requests.length, 0)).toBe(1);
    await shutdownHarness.close();
  });

  it("applies online changes, forced declines, and traffic delay through drivers", async () => {
    const harness = await makeHarness();
    const driver = harness.driver;
    const driverApi = harness.driverApi;
    await harness.executor.execute("driver-offline", { tenant: "default", driver: "driver1" });
    expect(driver.state).toBe("offline");
    expect(driverApi.calls).toContain("unavailable");
    await harness.executor.execute("driver-online", { tenant: "default", driver: "driver1" });
    expect(driver.state).toBe("idle");
    expect(driverApi.calls.filter((call) => call === "available")).toHaveLength(2);

    const rider = harness.riders[0]!;
    const requestId = await rider.requestRide({ from: harness.catalogue.pois[0], to: harness.catalogue.pois[1] });
    expect(requestId).toBe(101);
    await harness.executor.execute("decline-next", { tenant: "default", count: 1 });
    await driver.receiveNotification(JSON.stringify({ type: "RIDE_REQUESTED", referenceId: requestId }));
    expect(driverApi.calls.some((call) => call.startsWith("accept "))).toBe(false);
    expect(harness.events.some((event) => event.type === "offer.declined")).toBe(true);

    await harness.executor.execute("traffic-delay", { tenant: "default", driver: "driver1", seconds: 60 });
    expect(driver.state).toBe("delayed");
    expect(driver.delayedUntil).toBe(harness.clock.now() + 60_000);
    await harness.close();
  });

  it("cancels pending requests and assigned rides through the rider API, and assigned rides through the driver API", async () => {
    const harness = await makeHarness(true);
    const rider = harness.riders[0]!;
    const requestId = await rider.requestRide({ from: harness.catalogue.pois[0], to: harness.catalogue.pois[1] });
    expect(requestId).toBe(101);
    harness.riderApis[0]!.activeRideOverride = null;
    const pendingCancel = await harness.executor.execute("rider-cancel", { tenant: "default", rideRequestId: requestId });
    expect(pendingCancel.refs).toEqual({ rideRequestId: requestId });
    expect(pendingCancel.summary).toContain("cancelled pending request 101");
    expect(harness.riderApis[0]!.calls).toContain("rider cancel request 101");
    expect(harness.riderApis[0]!.calls).not.toContain("rider cancel 91");

    harness.riderApis[0]!.requestId = 102;
    const nextRequestId = await rider.requestRide({ from: harness.catalogue.pois[0], to: harness.catalogue.pois[1] });
    expect(nextRequestId).toBe(102);
    harness.riderApis[0]!.activeRideOverride = { rideId: 511, rideRequestId: nextRequestId, status: "CONFIRMED" };
    const riderCancel = await harness.executor.execute("rider-cancel", { tenant: "default", rideRequestId: nextRequestId });
    expect(riderCancel.refs).toEqual({ rideRequestId: nextRequestId, rideId: 511 });
    expect(harness.riderApis[0]!.calls).toContain("rider cancel 511");

    const plan = makePlan(harness.catalogue, 700, SIM_TENANTS.default.riders[1]!);
    const pickup = harness.catalogue.pois.find((poi) => poi.name === harness.driver.poi)!;
    plan.pickup = pickup;
    plan.dropOff = harness.catalogue.pois.find((poi) => poi.id !== pickup.id)!;
    harness.registry.register(plan);
    const rideInProgress = harness.driver.receiveNotification(JSON.stringify({ type: "RIDE_REQUESTED", referenceId: 700 }));
    await harness.driverApi.startEntered;
    expect(harness.driver.rideId).toBe(91);
    await harness.executor.execute("driver-offline", { tenant: "default", driver: "driver1" });
    expect(harness.driver.state).toBe("waiting");
    expect(harness.driverApi.calls).not.toContain("unavailable");
    const onlineResult = await harness.executor.execute("driver-online", { tenant: "default", driver: "driver1" });
    expect(onlineResult.summary).toBe("Cancelled Arjun Rao's pending offline request; they will stay online after the active ride.");
    expect(harness.driver.wantsOnline).toBe(true);
    expect(harness.driver.state).toBe("waiting");
    const driverCancel = await harness.executor.execute("driver-cancel", { tenant: "default", rideId: 91 });
    expect(driverCancel.refs).toEqual({ rideId: 91 });
    expect(harness.driverApi.calls).toContain("cancel 91");
    harness.driverApi.finishStart();
    await rideInProgress;
    expect(harness.driverApi.calls).not.toContain("unavailable");
    await harness.close();
  });

  it("preserves the rider plan when driver movement stops so shutdown can cancel the active ride", async () => {
    const harness = await makeHarness(true);
    const rider = harness.riders[0]!;
    const riderApi = harness.riderApis[0]!;
    const requestId = 700;
    rider.activeRequestId = requestId;
    const plan = makePlan(harness.catalogue, requestId, rider.account);
    plan.pickup = harness.catalogue.pois.find((poi) => poi.name === harness.driver.poi)!;
    plan.dropOff = harness.catalogue.pois.find((poi) => poi.id !== plan.pickup.id)!;
    plan.onCompleted = () => rider.completeRequest(requestId);
    harness.registry.register(plan);
    riderApi.activeRideOverride = { rideId: 91, rideRequestId: requestId, status: "CONFIRMED" };

    const rideInProgress = harness.driver.receiveNotification(JSON.stringify({ type: "RIDE_REQUESTED", referenceId: requestId }));
    await harness.driverApi.startEntered;
    harness.driver.stopMovement();
    harness.driverApi.finishStart();
    await rideInProgress;

    expect(harness.registry.owns(requestId)).toBe(true);
    expect(rider.activeRequestId).toBe(requestId);
    expect(await rider.cancelRideRequest(requestId)).toBe(91);
    expect(rider.activeRequestId).toBeNull();
    harness.driver.cancelLocally(requestId, 91);
    expect(riderApi.calls).toContain("rider cancel 91");
    await harness.close();
  });

  it("resets idle fleet bots to seeded hotspots", async () => {
    const harness = await makeHarness();
    await harness.executor.execute("traffic-delay", { tenant: "default", driver: "driver1", seconds: 60 });
    expect(harness.driver.delayedUntil).not.toBeNull();
    const before = harness.driverApi.locations.length;
    const result = await harness.executor.execute("reset-fleet", { tenant: "default" });
    expect(result.summary).toContain("parked bots at hotspots");
    expect(harness.driverApi.locations.length).toBe(before + 1);
    expect(harness.driver.state).toBe("idle");
    expect(harness.driver.delayedUntil).toBeNull();
    await harness.close();
  });

  it("keeps rider ownership when reset cancellation fails", async () => {
    const harness = await makeHarness();
    const rider = harness.riders[0]!;
    const api = harness.riderApis[0]!;
    api.activeRideOverride = null;
    const requestId = await rider.requestRide({ from: harness.catalogue.pois[0], to: harness.catalogue.pois[1] });
    expect(requestId).toBe(101);
    api.cancelRiderRequest = async (id) => {
      api.calls.push(`rider cancel request ${id}`);
      throw new ApiError(503, "backend unavailable");
    };

    await expect(harness.executor.execute("reset-fleet", { tenant: "default" }))
      .rejects.toMatchObject({ status: 409 });
    expect(rider.activeRequestId).toBe(requestId);
    expect(harness.registry.owns(requestId!)).toBe(true);
    expect(api.calls.filter((call) => call === "rider cancel request 101")).toHaveLength(2);
    expect(harness.events.some((event) => event.type === "action.failed")).toBe(true);
    expect(() => rider.resetToPoi(harness.catalogue.pois[0]!)).toThrow(ApiError);
    await harness.close();
  });
});

interface Harness {
  clock: FakeClock;
  catalogue: RouteCatalogue;
  driver: DriverBot;
  driverApi: GatedStartApi;
  riderApis: FakeApi[];
  riders: RiderBot[];
  registry: TestRegistry;
  executor: ActionExecutor;
  events: Array<{ type: string; message: string }>;
  shutdown: AbortController;
  setPaused(paused: boolean): void;
  setAirportShare(share: number): void;
  close(): Promise<void>;
}

async function makeHarness(gatedStart = false, clock: FakeClock = new FakeClock()): Promise<Harness> {
  const catalogue = await loadRouteCatalogue(fileURLToPath(fixtureDirectory));
  const shutdown = new AbortController();
  let paused = false;
  const logger = new SimLogger(clock, () => undefined);
  const events: Array<{ type: string; message: string }> = [];
  logger.setEventPublisher((event) => events.push({ type: event.type, message: event.message }));
  const registry = new TestRegistry();
  const riderApis = SIM_TENANTS.default.riders.map((account, index) => {
    const api = new FakeApi();
    api.riderEmail = account.email;
    api.requestId = 101 + index;
    return api;
  });
  const riders = SIM_TENANTS.default.riders.map((account, index) => new RiderBot(
    account,
    riderApis[index]!,
    new FakeStompSession().session,
    catalogue,
    clock,
    fixedRandom,
    logger,
    registry,
  ));
  for (const rider of riders) await rider.start();

  const driverAccount = SIM_TENANTS.default.drivers[0]!;
  const driverApi = new GatedStartApi(gatedStart);
  driverApi.driverEmail = driverAccount.email;
  driverApi.driverVehicleId = driverAccount.vehicleId!;
  const config: TenantSimConfig = {
    onlineDrivers: 1,
    requestIntervalSec: 0,
    airportShare: 0,
    declineProbability: 0,
    pickupWaitSec: [5, 5],
    idleRepositionProbability: 0,
    hotspots: ["kia-t1", "kia-t2"],
  };
  const driver = new DriverBot({
    account: driverAccount,
    api: driverApi,
    stomp: new FakeStompSession().session,
    catalogue,
    clock,
    simulationClock: new SimulationClock(clock, () => 20),
    random: fixedRandom,
    speedFactor: () => 20,
    logger,
    registry,
    config: () => config,
  });
  await driver.start();
  const context: ConfigContext = {
    fleetSizes: { default: SIM_TENANTS.default.drivers.length },
    poiIds: catalogue.pois.map((poi) => poi.id),
    airportPoiIds: catalogue.pois.filter((poi) => poi.kind === "airport").map((poi) => poi.id),
    poiKinds: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.kind])),
    poiWeights: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.weight])),
  };
  const runtime = {
    tenant: SIM_TENANTS.default,
    riders,
    drivers: [driver],
    random: fixedRandom,
    forceDeclines: (count: number) => registry.forceDeclines(count),
    setDriverOnline: async (target: DriverBot, online: boolean) => {
      await target.setOnline(online);
      config.onlineDrivers = [driver].filter((candidate) => candidate.wantsOnline).length;
    },
    beginRequest: () => registry.beginRequest(),
    endRequest: () => registry.endRequest(),
    isRequestBeingCreated: () => registry.isRequestBeingCreated(),
    register: (plan: RidePlan) => registry.register(plan),
    owns: (requestId: number) => registry.owns(requestId),
    get: (requestId: number) => registry.get(requestId),
    claimFirstOffer: (requestId: number) => registry.claimFirstOffer(requestId),
    consumeForcedDecline: () => registry.consumeForcedDecline(),
    complete: (requestId: number) => registry.complete(requestId),
  } as ActionTenantRuntime;
  const executor = new ActionExecutor({
    context,
    catalogue,
    clock,
    shutdownSignal: shutdown.signal,
    paused: () => paused,
    tenant: (slug) => slug === "default" ? runtime : undefined,
    config: () => config,
    publish: (_tenant, type, message) => events.push({ type, message }),
  });

  return {
    clock, catalogue, driver, driverApi, riderApis, riders, registry, executor, events,
    shutdown,
    setPaused(value) { paused = value; },
    setAirportShare(value) { config.airportShare = value; },
    async close() {
      for (const rider of riders) {
        rider.stop();
        await rider.closeSocket();
      }
      driver.stopMovement();
      await driver.closeSocket();
      driverApi.finishStart();
    },
  };
}

class HeldBurstClock extends FakeClock {
  private startedResolve!: () => void;
  private readonly started = new Promise<void>((resolve) => { this.startedResolve = resolve; });

  override sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    if (milliseconds < 5_000 || milliseconds > 10_000) return super.sleep(milliseconds, signal);
    this.startedResolve();
    return new Promise<void>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new Error("Operation aborted"));
        return;
      }
      signal?.addEventListener("abort", () => reject(signal.reason ?? new Error("Operation aborted")), { once: true });
    });
  }

  waitForBurstSleep(): Promise<void> {
    return this.started;
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await new Promise<void>((resolve) => setImmediate(resolve));
}

class TestRegistry implements RideRegistry {
  readonly plans = new Map<number, RidePlan>();
  private creating = 0;
  private forcedDeclines = 0;

  beginRequest(): void { this.creating += 1; }
  endRequest(): void { this.creating = Math.max(0, this.creating - 1); }
  isRequestBeingCreated(): boolean { return this.creating > 0; }
  register(plan: RidePlan): void { this.plans.set(plan.requestId, plan); }
  owns(requestId: number): boolean { return this.plans.has(requestId); }
  get(requestId: number): RidePlan | undefined { return this.plans.get(requestId); }
  claimFirstOffer(_requestId: number): boolean { return false; }
  consumeForcedDecline(): boolean {
    if (this.forcedDeclines === 0) return false;
    this.forcedDeclines -= 1;
    return true;
  }
  forceDeclines(count: number): void { this.forcedDeclines += count; }
  complete(requestId: number): void {
    const plan = this.plans.get(requestId);
    this.plans.delete(requestId);
    plan?.onCompleted();
  }
}

function makePlan(catalogue: RouteCatalogue, requestId: number, rider: RidePlan["rider"]): RidePlan {
  return {
    requestId,
    rider,
    pickup: catalogue.pois[0]!,
    dropOff: catalogue.pois[1]!,
    readOtp: async () => "4821",
    rateDriver: async () => undefined,
    onAssigned: () => undefined,
    onStarted: () => undefined,
    onCompleted: () => undefined,
  };
}

class GatedStartApi extends FakeApi {
  readonly startEntered: Promise<void>;
  private entered!: () => void;
  private finish?: () => void;
  private readonly gateStart: boolean;

  constructor(gateStart: boolean) {
    super();
    this.gateStart = gateStart;
    this.startEntered = new Promise((resolve) => { this.entered = resolve; });
  }

  override async startRide(rideId: number, otp: string) {
    this.calls.push(`start ${rideId}:${otp}`);
    if (this.gateStart) {
      this.entered();
      return new Promise<{ id: number; rideStatus: string }>((resolve) => {
        this.finish = () => resolve({ id: rideId, rideStatus: "ONGOING" });
      });
    }
    return { id: rideId, rideStatus: "ONGOING" };
  }

  finishStart(): void {
    this.finish?.();
  }
}

