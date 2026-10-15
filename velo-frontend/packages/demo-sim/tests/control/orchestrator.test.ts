import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig, applyConfigPatch, type ConfigContext } from "../../src/control/runtime-config.ts";
import { saveState, loadState } from "../../src/control/state-store.ts";
import { loadRouteCatalogue } from "../../src/geo/route-catalogue.ts";
import { TenantOrchestrator } from "../../src/sim/tenant-orchestrator.ts";
import { SIM_TENANTS } from "../../src/config.ts";
import type { RideTrackingDto } from "../../src/types.ts";
import { FakeApi, FakeClock, FakeStompSession } from "../helpers.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("tenant orchestrator control wiring", () => {
  it("restores persisted config on start, applies updates to bots, reports §8.1 status, and flushes state", async () => {
    const catalogue = await loadRouteCatalogue(fileURLToPath(new URL("../fixtures/", import.meta.url)));
    const directory = await mkdtemp(join(tmpdir(), "demo-sim-orchestrator-"));
    tempDirs.push(directory);
    const stateFile = join(directory, "sim-state.json");
    const context = contextFor(catalogue);
    const defaults = defaultConfig(context, 77);
    const persisted = applyConfigPatch(defaults, {
      paused: true,
      speedFactor: 7,
      tenants: { default: { onlineDrivers: 1, requestIntervalSec: 30, airportShare: 0.8, hotspots: ["kia-t1"] } },
    }, context);
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    await saveState(stateFile, persisted.config);

    const apiInstances: FakeApi[] = [];
    const orchestrator = new TenantOrchestrator({
      apiBaseUrl: "http://127.0.0.1:59999",
      tenants: ["default"],
      catalogue,
      seed: 2,
      speed: 4,
      paused: false,
      stateFile,
      clock: new FakeClock(),
      startBackgroundLoops: false,
      apiFactory: () => {
        const api = new FakeApi();
        api.activeRideOverride = null;
        apiInstances.push(api);
        return api;
      },
      stompFactory: () => new FakeStompSession().session,
    });

    await orchestrator.start();
    expect(orchestrator.getConfig()).toMatchObject({
      paused: true,
      speedFactor: 7,
      seed: 77,
      tenants: { default: { onlineDrivers: 1, requestIntervalSec: 30, airportShare: 0.8, hotspots: ["kia-t1"] } },
    });
    const initialStatus = orchestrator.status();
    expect(initialStatus).toMatchObject({ ready: true, paused: true, speedFactor: 7, tenants: [{ slug: "default", currency: "USD" }] });
    expect(initialStatus.tenants[0]?.drivers).toHaveLength(6);
    expect(initialStatus.tenants[0]?.riders).toHaveLength(4);
    expect(initialStatus.tenants[0]?.drivers.filter((driver) => driver.state !== "offline")).toHaveLength(1);
    expect(initialStatus).toHaveProperty("uptimeSec");
    expect(initialStatus).toHaveProperty("recentErrors");

    const changed = orchestrator.patchConfig({
      paused: false,
      speedFactor: 3,
      tenants: {
        default: {
          onlineDrivers: 0,
          requestIntervalSec: 0,
          airportShare: 0.1,
          declineProbability: 0.8,
          pickupWaitSec: [25, 45],
          idleRepositionProbability: 0.9,
          hotspots: ["hotel"],
        },
      },
    });
    expect(changed.ok).toBe(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const driverApi = apiInstances.find((api) => api.calls.includes("driver profile"))!;
    expect(driverApi.calls).toContain("unavailable");
    expect(orchestrator.status().speedFactor).toBe(3);
    expect(orchestrator.status().tenants[0]?.drivers.every((driver) => driver.state === "offline")).toBe(true);

    await orchestrator.stop();
    const restoredAfterStop = await loadState(stateFile, context, defaults);
    expect(restoredAfterStop).toMatchObject({
      paused: false,
      speedFactor: 3,
      tenants: { default: { onlineDrivers: 0, requestIntervalSec: 0, pickupWaitSec: [25, 45], hotspots: ["hotel"] } },
    });
  });

  it.each([
    { name: "pending requests", tracking: null, cancellation: "rider cancel request 41" },
    {
      name: "assigned rides",
      tracking: { rideId: 811, rideRequestId: 41, status: "CONFIRMED" } as RideTrackingDto,
      cancellation: "rider cancel 811",
    },
  ])("cancels $name before taking drivers offline", async ({ tracking, cancellation }) => {
    const catalogue = await loadRouteCatalogue(fileURLToPath(new URL("../fixtures/", import.meta.url)));
    const operations: string[] = [];
    const apiInstances: FakeApi[] = [];
    const orchestrator = new TenantOrchestrator({
      apiBaseUrl: "http://127.0.0.1:59999",
      tenants: ["default"],
      catalogue,
      seed: 2,
      speed: 4,
      paused: false,
      clock: new FakeClock(),
      startBackgroundLoops: false,
      apiFactory: () => {
        const api = observeShutdownCalls(new FakeApi(), operations);
        api.activeRideOverride = null;
        apiInstances.push(api);
        return api;
      },
      stompFactory: () => new FakeStompSession().session,
    });
    const control = orchestrator.createControlServer(0);

    await orchestrator.start();
    await control.listen();
    operations.length = 0;
    const response = await fetch(`http://127.0.0.1:${control.listeningPort}/actions/request-trip`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-velo-sim": "1" },
      body: JSON.stringify({ tenant: "default", from: "hotel", to: "kia-t1", rider: "rider1" }),
    });
    const body = await response.json() as { refs?: { rideRequestId?: number } };
    expect(response.status).toBe(202);
    expect(body.refs?.rideRequestId).toBe(41);
    const riderApi = apiInstances.find((api) => api.calls.includes("request ride"))!;
    riderApi.activeRideOverride = tracking;

    await control.close();
    await orchestrator.stop();

    expect(operations[0]).toBe(cancellation);
    expect(operations.filter((operation) => operation === "driver offline")).toHaveLength(SIM_TENANTS.default.drivers.length);
    expect(operations.indexOf(cancellation)).toBeLessThan(operations.indexOf("driver offline"));
  });

  it("waits for in-flight request creation so shutdown can cancel its persisted request", async () => {
    const catalogue = await loadRouteCatalogue(fileURLToPath(new URL("../fixtures/", import.meta.url)));
    const operations: string[] = [];
    const apiInstances: FakeApi[] = [];
    let requestStarted!: () => void;
    let finishRequest!: () => void;
    const requestStartedPromise = new Promise<void>((resolve) => { requestStarted = resolve; });
    const requestGate = new Promise<void>((resolve) => { finishRequest = resolve; });
    const orchestrator = new TenantOrchestrator({
      apiBaseUrl: "http://127.0.0.1:59999",
      tenants: ["default"],
      catalogue,
      seed: 2,
      speed: 4,
      paused: false,
      clock: new FakeClock(),
      startBackgroundLoops: false,
      apiFactory: () => {
        const api = observeShutdownCalls(new FakeApi(), operations);
        api.activeRideOverride = null;
        const requestRide = api.requestRide.bind(api);
        api.requestRide = async (payload) => {
          api.activeRideOverride = null;
          requestStarted();
          await requestGate;
          return requestRide(payload);
        };
        apiInstances.push(api);
        return api;
      },
      stompFactory: () => new FakeStompSession().session,
    });
    const control = orchestrator.createControlServer(0);

    await orchestrator.start();
    await control.listen();
    const action = fetch(`http://127.0.0.1:${control.listeningPort}/actions/request-trip`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-velo-sim": "1" },
      body: JSON.stringify({ tenant: "default", from: "hotel", to: "kia-t1", rider: "rider1" }),
    }).catch(() => undefined);
    await requestStartedPromise;
    await control.close();
    const stopping = orchestrator.stop();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(operations).not.toContain("rider cancel request 41");

    finishRequest();
    await stopping;
    await action;

    const requestApi = apiInstances.find((api) => api.calls.includes("request ride"));
    expect(requestApi?.calls).toContain("rider cancel request 41");
    expect(operations.indexOf("rider cancel request 41")).toBeLessThan(operations.indexOf("driver offline"));
  });

  it("cancels stale simulated backend records before bringing drivers online", async () => {
    const catalogue = await loadRouteCatalogue(fileURLToPath(new URL("../fixtures/", import.meta.url)));
    const operations: string[] = [];
    let created = 0;
    const orchestrator = new TenantOrchestrator({
      apiBaseUrl: "http://127.0.0.1:59999",
      tenants: ["default"],
      catalogue,
      seed: 2,
      speed: 4,
      paused: false,
      clock: new FakeClock(),
      startBackgroundLoops: false,
      apiFactory: () => {
        const api = observeShutdownCalls(new FakeApi(), operations);
        api.activeRideOverride = created++ === 0
          ? { rideRequestId: 307, status: "PENDING" }
          : null;
        return api;
      },
      stompFactory: () => new FakeStompSession().session,
    });

    await orchestrator.start();
    expect(operations[0]).toBe("rider cancel request 307");
    expect(operations.indexOf("rider cancel request 307")).toBeLessThan(operations.indexOf("driver online"));
    await orchestrator.stop();
  });

  it("serializes availability changes and settles at the latest online-driver count", async () => {
    const catalogue = await loadRouteCatalogue(fileURLToPath(new URL("../fixtures/", import.meta.url)));
    const apiInstances: FakeApi[] = [];
    const orchestrator = new TenantOrchestrator({
      apiBaseUrl: "http://127.0.0.1:59999",
      tenants: ["default"],
      catalogue,
      seed: 2,
      speed: 4,
      paused: false,
      clock: new FakeClock(),
      startBackgroundLoops: false,
      apiFactory: () => {
        const api = new FakeApi();
        api.activeRideOverride = null;
        apiInstances.push(api);
        return api;
      },
      stompFactory: () => new FakeStompSession().session,
    });
    orchestrator.patchConfig({ tenants: { default: { onlineDrivers: 0 } } });
    await orchestrator.start();

    const firstDriverApi = apiInstances[SIM_TENANTS.default.riders.length]!;
    const setAvailability = firstDriverApi.setAvailability.bind(firstDriverApi);
    let inFlight = 0;
    let maximumInFlight = 0;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    let gateNextOnline = true;
    firstDriverApi.setAvailability = async (available) => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      try {
        if (available && gateNextOnline) {
          gateNextOnline = false;
          entered();
          await gate;
        }
        await setAvailability(available);
      } finally {
        inFlight -= 1;
      }
    };

    orchestrator.patchConfig({ tenants: { default: { onlineDrivers: 6 } } });
    await enteredPromise;
    orchestrator.patchConfig({ tenants: { default: { onlineDrivers: 2 } } });
    release();
    for (let turn = 0; turn < 20; turn += 1) await new Promise<void>((resolve) => setImmediate(resolve));

    expect(maximumInFlight).toBe(1);
    expect(orchestrator.status().tenants[0]?.drivers.filter((driver) => driver.state !== "offline")).toHaveLength(2);
    await orchestrator.stop();
  });
});

function observeShutdownCalls(api: FakeApi, operations: string[]): FakeApi {
  const setAvailability = api.setAvailability.bind(api);
  const cancelRiderRequest = api.cancelRiderRequest.bind(api);
  const cancelRiderRide = api.cancelRiderRide.bind(api);
  api.setAvailability = async (available) => {
    operations.push(available ? "driver online" : "driver offline");
    await setAvailability(available);
  };
  api.cancelRiderRequest = async (requestId) => {
    operations.push(`rider cancel request ${requestId}`);
    await cancelRiderRequest(requestId);
  };
  api.cancelRiderRide = async (rideId) => {
    operations.push(`rider cancel ${rideId}`);
    await cancelRiderRide(rideId);
  };
  return api;
}

function contextFor(catalogue: Awaited<ReturnType<typeof loadRouteCatalogue>>): ConfigContext {
  return {
    fleetSizes: { default: SIM_TENANTS.default.drivers.length },
    poiIds: catalogue.pois.map((poi) => poi.id),
    airportPoiIds: catalogue.pois.filter((poi) => poi.kind === "airport").map((poi) => poi.id),
    poiKinds: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.kind])),
    poiWeights: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.weight])),
  };
}
