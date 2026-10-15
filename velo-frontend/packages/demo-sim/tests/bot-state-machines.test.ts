import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/http-client.ts";
import { loadRouteCatalogue } from "../src/geo/route-catalogue.ts";
import { SimLogger } from "../src/log.ts";
import { SimulationClock } from "../src/sim/clock.ts";
import type { RidePlan, RideRegistry } from "../src/sim/contracts.ts";
import { DriverBot } from "../src/sim/driver-bot.ts";
import { RiderBot } from "../src/sim/rider-bot.ts";
import type { RandomSource } from "../src/sim/random.ts";
import { SIM_TENANTS } from "../src/config.ts";
import type { Poi } from "../src/types.ts";
import { FakeApi, FakeClock, FakeStompSession } from "./helpers.ts";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fixedRandom: RandomSource = { next: () => 0.5 };

describe("rider and driver simulator bots", () => {
  it("refreshes an online idle driver's last known location on a jittered heartbeat", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const clock = new IntervalCaptureClock();
    const api = new FakeApi();
    const driver = new DriverBot({
      account: SIM_TENANTS.default.drivers[0]!,
      api,
      stomp: new FakeStompSession().session,
      catalogue,
      clock,
      simulationClock: new SimulationClock(clock, () => 4),
      random: fixedRandom,
      speedFactor: () => 4,
      logger: new SimLogger(clock, () => undefined),
      registry: createRegistry(),
    });

    await driver.start();
    expect(api.locations).toHaveLength(1);
    expect(clock.activeInterval()?.milliseconds).toBeGreaterThanOrEqual(20_000);
    expect(clock.activeInterval()?.milliseconds).toBeLessThanOrEqual(30_000);

    clock.activeInterval()?.fire();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(api.locations).toHaveLength(2);
    expect(api.locations[1]).toMatchObject({ lat: api.locations[0]?.lat, lng: api.locations[0]?.lng, speedKph: 0 });
    expect(clock.activeInterval()?.milliseconds).toBeGreaterThanOrEqual(20_000);
    expect(clock.activeInterval()?.milliseconds).toBeLessThanOrEqual(30_000);

    driver.stopMovement();
    expect(clock.activeInterval()).toBeNull();
    await driver.closeSocket();
  });

  it("posts a typed WALLET request and releases its slot on a completion event", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const clock = new FakeClock();
    const api = new FakeApi();
    api.requestId = 52;
    const stomp = new FakeStompSession();
    const registry = createRegistry();
    const rider = new RiderBot(
      SIM_TENANTS.default.riders[0]!, api, stomp.session, catalogue, clock, fixedRandom,
      new SimLogger(clock, () => undefined), registry,
    );

    await rider.start();
    expect(await rider.requestRide()).toBe(52);
    expect(rider.activeRequestId).toBe(52);
    expect(await rider.readOtp(91)).toBe("4821");
    expect(registry.owns(52)).toBe(true);
    expect(api.requests[0]).toMatchObject({ paymentMethod: "WALLET", pickupLocation: { type: "Point" } });
    expect(api.requests[0]?.pickupLocation.coordinates).toHaveLength(2);

    stomp.publish("/user/queue/ride-updates", JSON.stringify({ eventType: "RIDE_CANCELLED", rideId: 999, rideRequestId: 53, status: "CANCELLED" }));
    expect(rider.activeRequestId).toBe(52);
    expect(registry.owns(52)).toBe(true);

    stomp.publish("/user/queue/ride-updates", JSON.stringify({ eventType: "RIDE_COMPLETED", rideId: 91, rideRequestId: 52, status: "ENDED" }));
    expect(rider.activeRequestId).toBeNull();
    expect(registry.owns(52)).toBe(false);
    rider.stop();
    await rider.closeSocket();
  });

  it("reconciles stale pending requests and active rides from backend tracking", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const clock = new FakeClock();
    const api = new FakeApi();
    api.activeRideOverride = { rideRequestId: 701, status: "PENDING" };
    const rider = new RiderBot(
      SIM_TENANTS.default.riders[0]!, api, new FakeStompSession().session, catalogue, clock, fixedRandom,
      new SimLogger(clock, () => undefined), createRegistry(),
    );

    await rider.reconcileBackendState();
    expect(api.calls).toContain("rider cancel request 701");
    api.activeRideOverride = { rideId: 808, rideRequestId: 702, status: "ONGOING" };
    await rider.reconcileBackendState();
    expect(api.calls).toContain("rider cancel 808");
  });

  it("ignores foreign request notifications and runs an owned offer through OTP, route, completion, and rating", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const clock = new FakeClock();
    const driverApi = new FakeApi();
    const ignoredApi = new FakeApi();
    const riderApi = new FakeApi();
    let ratingInFlight = false;
    let concurrentRatings = false;
    const recordRating = async (calls: string[], entry: string) => {
      if (ratingInFlight) concurrentRatings = true;
      ratingInFlight = true;
      await Promise.resolve();
      calls.push(entry);
      ratingInFlight = false;
    };
    driverApi.rateRider = async (rideId, rating) => recordRating(driverApi.calls, `rate rider ${rideId}:${rating}`);
    riderApi.rateDriver = async (rideId, rating) => recordRating(riderApi.calls, `rate driver ${rideId}:${rating}`);
    const driverStomp = new FakeStompSession();
    const ignoredStomp = new FakeStompSession();
    const registry = createRegistry();
    const pickup = catalogue.pois.find((poi) => poi.id === "hotel")!;
    const dropOff = catalogue.pois.find((poi) => poi.id === "kia-t1")!;
    let completed = 0;
    driverApi.driverEmail = SIM_TENANTS.default.drivers[1]!.email;
    driverApi.driverVehicleId = SIM_TENANTS.default.drivers[1]!.vehicleId!;
    ignoredApi.driverEmail = SIM_TENANTS.default.drivers[0]!.email;
    const loggerLines: string[] = [];
    const logger = new SimLogger(clock, (line) => loggerLines.push(line));
    const driver = new DriverBot({
      account: SIM_TENANTS.default.drivers[1]!,
      api: driverApi,
      stomp: driverStomp.session,
      catalogue,
      clock,
      simulationClock: new SimulationClock(clock, () => 20),
      random: fixedRandom,
      speedFactor: () => 20,
      logger,
      registry,
    });
    const firstNotifiedDriver = new DriverBot({
      account: SIM_TENANTS.default.drivers[0]!,
      api: ignoredApi,
      stomp: ignoredStomp.session,
      catalogue,
      clock,
      simulationClock: new SimulationClock(clock, () => 20),
      random: sequenceRandom([0.1]),
      speedFactor: () => 20,
      logger,
      registry,
    });
    await driver.start();
    await firstNotifiedDriver.start();

    await firstNotifiedDriver.receiveNotification(JSON.stringify({ type: "RIDE_REQUESTED", referenceId: 999 }));
    expect(ignoredApi.calls.some((call) => call.startsWith("accept "))).toBe(false);

    registry.beginRequest();
    const earlyOffer = firstNotifiedDriver.receiveNotification(JSON.stringify({ title: "Ride Request Received", type: "RIDE_REQUESTED", referenceId: 41 }));
    registry.register({
      requestId: 41,
      rider: SIM_TENANTS.default.riders[0]!,
      pickup,
      dropOff,
      readOtp: async (rideId) => {
        const tracking = await riderApi.getActiveRide();
        return tracking?.rideId === rideId ? tracking.otp ?? null : null;
      },
      rateDriver: (rideId, rating) => riderApi.rateDriver(rideId, rating),
      onAssigned: () => undefined,
      onStarted: () => undefined,
      onCompleted: () => { completed += 1; },
    });
    registry.endRequest();
    await earlyOffer;
    expect(ignoredApi.calls.some((call) => call.startsWith("accept "))).toBe(false);
    expect(loggerLines.some((line) => line.includes("offer declined"))).toBe(true);

    await driver.receiveNotification(JSON.stringify({ title: "Ride Request Received", type: "RIDE_REQUESTED", referenceId: 41 }));
    expect(driverApi.calls).toContain("accept 41");
    expect(driverApi.calls).toContain("start 91:4821");
    expect(driverApi.calls).toContain("end 91");
    expect(driverApi.calls.some((call) => call.startsWith("rate rider 91:"))).toBe(true);
    expect(riderApi.calls.some((call) => call.startsWith("rate driver 91:"))).toBe(true);
    expect(concurrentRatings).toBe(false);
    expect(driver.state).toBe("idle");
    expect(driver.completedRides).toBe(1);
    expect(completed).toBe(1);
    expect(driverApi.locations.length).toBeGreaterThan(1);

    driver.stopMovement();
    firstNotifiedDriver.stopMovement();
    await driver.closeSocket();
    await firstNotifiedDriver.closeSocket();
  });

  it("handles a taken offer quietly and returns the driver to idle", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const clock = new FakeClock();
    const driverApi = new FakeApi();
    driverApi.acceptError = new ApiError(409, "taken");
    const registry = createRegistry();
    registry.register(makePlan(catalogue, 41));
    const loggerLines: string[] = [];
    const driver = new DriverBot({
      account: SIM_TENANTS.default.drivers[0]!,
      api: driverApi,
      stomp: new FakeStompSession().session,
      catalogue,
      clock,
      simulationClock: new SimulationClock(clock, () => 4),
      random: fixedRandom,
      speedFactor: () => 4,
      logger: new SimLogger(clock, (line) => loggerLines.push(line)),
      registry,
    });
    await driver.start();

    await driver.receiveNotification(JSON.stringify({ type: "RIDE_REQUESTED", referenceId: 41 }));

    expect(driverApi.calls).toContain("accept 41");
    expect(driverApi.calls.some((call) => call.startsWith("cancel "))).toBe(false);
    expect(driver.state).toBe("idle");
    expect(loggerLines.some((line) => line.includes("error"))).toBe(false);
    driver.stopMovement();
    await driver.closeSocket();
  });

  it("treats a fleet reset as a normal route interruption", async () => {
    const catalogue = await loadRouteCatalogue(fixtureDirectory);
    const clock = new RouteGateClock();
    const loggerLines: string[] = [];
    const driver = new DriverBot({
      account: SIM_TENANTS.default.drivers[0]!,
      api: new FakeApi(),
      stomp: new FakeStompSession().session,
      catalogue,
      clock,
      simulationClock: new SimulationClock(clock, () => 20),
      random: sequenceRandom([0.5, 0, 0, 0]),
      speedFactor: () => 20,
      logger: new SimLogger(clock, (line) => loggerLines.push(line)),
      registry: createRegistry(),
      config: () => ({
        onlineDrivers: 1,
        requestIntervalSec: 0,
        airportShare: 0,
        declineProbability: 0,
        pickupWaitSec: [5, 5],
        idleRepositionProbability: 1,
        hotspots: ["kia-t1"],
      }),
    });
    await driver.start();
    driver.startIdleRepositioning();
    await clock.routeStarted;
    expect(driver.state).toBe("repositioning");

    await driver.resetToPoi(catalogue.pois.find((poi) => poi.id === "kia-t1")!);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(driver.state).toBe("idle");
    expect(driver.poi).toBe(catalogue.pois.find((poi) => poi.id === "kia-t1")!.name);
    expect(loggerLines.some((line) => line.includes("error reposition"))).toBe(false);
    driver.stopMovement();
    await driver.closeSocket();
  }, 10_000);
});

function createRegistry(): RideRegistry {
  const plans = new Map<number, RidePlan>();
  const firstOffers = new Set<number>();
  let creating = 0;
  let forcedDeclines = 0;
  return {
    beginRequest() { creating += 1; },
    endRequest() { creating = Math.max(0, creating - 1); },
    isRequestBeingCreated() { return creating > 0; },
    register(plan) { plans.set(plan.requestId, plan); },
    owns(requestId) { return plans.has(requestId); },
    get(requestId) { return plans.get(requestId); },
    claimFirstOffer(requestId) {
      if (firstOffers.has(requestId)) {
        return false;
      }
      firstOffers.add(requestId);
      return true;
    },
    consumeForcedDecline() {
      if (forcedDeclines <= 0) return false;
      forcedDeclines -= 1;
      return true;
    },
    complete(requestId) {
      const plan = plans.get(requestId);
      plans.delete(requestId);
      plan?.onCompleted();
    },
  };
}

function makePlan(catalogue: { pois: Poi[] }, requestId: number): RidePlan {
  return {
    requestId,
    rider: SIM_TENANTS.default.riders[0]!,
    pickup: catalogue.pois[1]!,
    dropOff: catalogue.pois[0]!,
    readOtp: async () => "4821",
    rateDriver: async () => undefined,
    onAssigned: () => undefined,
    onStarted: () => undefined,
    onCompleted: () => undefined,
  };
}

function sequenceRandom(values: number[]): RandomSource {
  let index = 0;
  return {
    next: () => {
      const value = values[index] ?? values[values.length - 1] ?? 0.5;
      index += 1;
      return value;
    },
  };
}

class RouteGateClock extends FakeClock {
  private signalRouteStarted!: () => void;
  readonly routeStarted = new Promise<void>((resolve) => { this.signalRouteStarted = resolve; });

  override sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    if (milliseconds === 3_000) {
      this.signalRouteStarted();
      return new Promise<void>((_resolve, reject) => {
        const abort = () => reject(signal?.reason ?? new Error("Operation aborted"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return super.sleep(milliseconds, signal);
  }
}

class IntervalCaptureClock extends FakeClock {
  private readonly intervals: { milliseconds: number; callback: () => void; cancelled: boolean }[] = [];

  override every(milliseconds: number, callback: () => void): () => void {
    const interval = { milliseconds, callback, cancelled: false };
    this.intervals.push(interval);
    return () => { interval.cancelled = true; };
  }

  activeInterval(): { milliseconds: number; fire: () => void } | null {
    const interval = [...this.intervals].reverse().find((candidate) => !candidate.cancelled);
    return interval ? { milliseconds: interval.milliseconds, fire: interval.callback } : null;
  }
}
