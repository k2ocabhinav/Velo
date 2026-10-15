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
    expect(initialStatus).toMatchObject({ paused: true, speedFactor: 7, tenants: [{ slug: "default", currency: "INR" }] });
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
});

function contextFor(catalogue: Awaited<ReturnType<typeof loadRouteCatalogue>>): ConfigContext {
  return {
    fleetSizes: { default: SIM_TENANTS.default.drivers.length },
    poiIds: catalogue.pois.map((poi) => poi.id),
    airportPoiIds: catalogue.pois.filter((poi) => poi.kind === "airport").map((poi) => poi.id),
    poiKinds: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.kind])),
    poiWeights: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.weight])),
  };
}
