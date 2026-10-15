import { describe, expect, it } from "vitest";
import {
  applyConfigPatch,
  defaultConfig,
  steadyTenantConfig,
  type ConfigContext,
  type SimConfig,
} from "../../src/control/runtime-config.ts";

const ctx: ConfigContext = {
  fleetSizes: { default: 6, "saffron-routes": 6 },
  poiIds: ["kia-t1", "kia-t2", "oberoi", "taj", "mg-road"],
  airportPoiIds: ["kia-t1", "kia-t2"],
  poiKinds: { "kia-t1": "airport", "kia-t2": "airport", oberoi: "hotel", taj: "hotel", "mg-road": "business" },
  poiWeights: { "kia-t1": 1, "kia-t2": 1, oberoi: 10, taj: 20, "mg-road": 1 },
};

function baseConfig(): SimConfig {
  return defaultConfig(ctx, 42);
}

describe("defaultConfig", () => {
  it("creates one steady tenant per fleet and carries the global defaults", () => {
    const config = defaultConfig(ctx, 7);

    expect(config).toEqual({
      paused: false,
      speedFactor: 1,
      seed: 7,
      tenants: {
        default: {
          onlineDrivers: 6,
          requestIntervalSec: 75,
          airportShare: 0.4,
          declineProbability: 0.15,
          pickupWaitSec: [15, 30],
          idleRepositionProbability: 0.3,
          hotspots: ["kia-t1", "kia-t2", "taj", "oberoi"],
        },
        "saffron-routes": {
          onlineDrivers: 6,
          requestIntervalSec: 75,
          airportShare: 0.4,
          declineProbability: 0.15,
          pickupWaitSec: [15, 30],
          idleRepositionProbability: 0.3,
          hotspots: ["kia-t1", "kia-t2", "taj", "oberoi"],
        },
      },
    });
  });

  it("uses airports and the three highest-weight hotels as steady hotspots", () => {
    expect(steadyTenantConfig(ctx, 6).hotspots).toEqual(["kia-t1", "kia-t2", "taj", "oberoi"]);
  });

  it("handles an empty context", () => {
    const empty: ConfigContext = { fleetSizes: {}, poiIds: [], airportPoiIds: [], poiKinds: {}, poiWeights: {} };
    expect(defaultConfig(empty, 1).tenants).toEqual({});
  });

  it("gives each tenant a distinct hotspot array", () => {
    const config = defaultConfig(ctx, 1);
    expect(config.tenants["default"]?.hotspots).not.toBe(config.tenants["saffron-routes"]?.hotspots);
  });
});

describe("applyConfigPatch globals", () => {
  it("returns an unchanged clone for an empty patch", () => {
    const config = baseConfig();
    const before = structuredClone(config);
    const result = applyConfigPatch(config, {}, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toEqual([]);
    expect(result.config).toEqual(config);
    expect(result.config).not.toBe(config);
    expect(config).toEqual(before);
  });

  it("rejects a non-object patch", () => {
    expect(applyConfigPatch(baseConfig(), null, ctx)).toEqual({ ok: false, error: "config patch must be an object" });
    expect(applyConfigPatch(baseConfig(), [], ctx).ok).toBe(false);
    expect(applyConfigPatch(baseConfig(), "paused", ctx).ok).toBe(false);
  });

  it("rejects unknown top-level keys", () => {
    expect(applyConfigPatch(baseConfig(), { wat: 1 }, ctx)).toEqual({
      ok: false,
      error: 'unknown config key "wat"',
    });
  });

  it("toggles paused and reports the change", () => {
    const result = applyConfigPatch(baseConfig(), { paused: true }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.paused).toBe(true);
    expect(result.changed).toEqual(["paused"]);
  });

  it("rejects a non-boolean paused", () => {
    expect(applyConfigPatch(baseConfig(), { paused: "yes" }, ctx)).toEqual({
      ok: false,
      error: "paused must be a boolean",
    });
  });

  it("clamps speedFactor into 1..20", () => {
    const low = applyConfigPatch(baseConfig(), { speedFactor: 0.2 }, ctx);
    const high = applyConfigPatch(baseConfig(), { speedFactor: 99 }, ctx);

    expect(low.ok && low.config.speedFactor).toBe(1);
    expect(high.ok && high.config.speedFactor).toBe(20);
  });

  it("rejects non-numeric or non-finite speedFactor", () => {
    expect(applyConfigPatch(baseConfig(), { speedFactor: "4" }, ctx)).toEqual({
      ok: false,
      error: "speedFactor must be a number",
    });
    expect(applyConfigPatch(baseConfig(), { speedFactor: Number.NaN }, ctx).ok).toBe(false);
    expect(applyConfigPatch(baseConfig(), { speedFactor: Number.POSITIVE_INFINITY }, ctx).ok).toBe(false);
  });

  it("sets the seed and rejects non-numbers", () => {
    const result = applyConfigPatch(baseConfig(), { seed: 99 }, ctx);
    expect(result.ok && result.config.seed).toBe(99);
    expect(applyConfigPatch(baseConfig(), { seed: "x" }, ctx)).toEqual({
      ok: false,
      error: "seed must be a number",
    });
  });

  it("rejects a non-object tenants patch", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: 3 }, ctx)).toEqual({
      ok: false,
      error: "tenants must be an object",
    });
  });

  it("rejects an unknown tenant", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: { ghost: {} } }, ctx)).toEqual({
      ok: false,
      error: "tenants.ghost is not a known tenant",
    });
  });

  it("rejects a non-object tenant patch", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: { default: 3 } }, ctx)).toEqual({
      ok: false,
      error: "tenants.default must be an object",
    });
  });

  it("never mutates its input", () => {
    const config = baseConfig();
    const snapshot = structuredClone(config);

    applyConfigPatch(config, { paused: true, tenants: { default: { onlineDrivers: 1, hotspots: ["taj"] } } }, ctx);

    expect(config).toEqual(snapshot);
  });

  it("creates a tenant that is known to the context but absent from the config", () => {
    const partial: SimConfig = {
      paused: false,
      speedFactor: 1,
      seed: 1,
      tenants: { default: steadyTenantConfig(ctx, 6) },
    };

    const result = applyConfigPatch(partial, { tenants: { "saffron-routes": { onlineDrivers: 3 } } }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["saffron-routes"]?.onlineDrivers).toBe(3);
    expect(result.config.tenants["saffron-routes"]?.requestIntervalSec).toBe(75);
  });
});

describe("applyConfigPatch tenant fields", () => {
  it("clamps onlineDrivers into 0..fleetSize and rounds", () => {
    const low = applyConfigPatch(baseConfig(), { tenants: { default: { onlineDrivers: -5 } } }, ctx);
    const high = applyConfigPatch(baseConfig(), { tenants: { default: { onlineDrivers: 50 } } }, ctx);
    const rounded = applyConfigPatch(baseConfig(), { tenants: { default: { onlineDrivers: 2.6 } } }, ctx);

    expect(low.ok && low.config.tenants["default"]?.onlineDrivers).toBe(0);
    expect(high.ok && high.config.tenants["default"]?.onlineDrivers).toBe(6);
    expect(rounded.ok && rounded.config.tenants["default"]?.onlineDrivers).toBe(3);
  });

  it("rejects a non-numeric onlineDrivers", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: { default: { onlineDrivers: "3" } } }, ctx)).toEqual({
      ok: false,
      error: "tenants.default.onlineDrivers must be a number",
    });
  });

  it("treats requestIntervalSec as off at 0 or below and clamps the rest into 10..900", () => {
    const off = applyConfigPatch(baseConfig(), { tenants: { default: { requestIntervalSec: 0 } } }, ctx);
    const below = applyConfigPatch(baseConfig(), { tenants: { default: { requestIntervalSec: -3 } } }, ctx);
    const small = applyConfigPatch(baseConfig(), { tenants: { default: { requestIntervalSec: 4 } } }, ctx);
    const big = applyConfigPatch(baseConfig(), { tenants: { default: { requestIntervalSec: 5000 } } }, ctx);

    expect(off.ok && off.config.tenants["default"]?.requestIntervalSec).toBe(0);
    expect(below.ok && below.config.tenants["default"]?.requestIntervalSec).toBe(0);
    expect(small.ok && small.config.tenants["default"]?.requestIntervalSec).toBe(10);
    expect(big.ok && big.config.tenants["default"]?.requestIntervalSec).toBe(900);
  });

  it("clamps probabilities", () => {
    const result = applyConfigPatch(
      baseConfig(),
      { tenants: { default: { airportShare: 2, declineProbability: 1, idleRepositionProbability: -1 } } },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["default"]?.airportShare).toBe(1);
    expect(result.config.tenants["default"]?.declineProbability).toBe(0.9);
    expect(result.config.tenants["default"]?.idleRepositionProbability).toBe(0);
  });

  it("clamps and orders pickupWaitSec", () => {
    const swapped = applyConfigPatch(baseConfig(), { tenants: { default: { pickupWaitSec: [100, 3] } } }, ctx);
    const floor = applyConfigPatch(baseConfig(), { tenants: { default: { pickupWaitSec: [0, 1] } } }, ctx);
    const ceiling = applyConfigPatch(baseConfig(), { tenants: { default: { pickupWaitSec: [400, 900] } } }, ctx);

    expect(swapped.ok && swapped.config.tenants["default"]?.pickupWaitSec).toEqual([5, 100]);
    expect(floor.ok && floor.config.tenants["default"]?.pickupWaitSec).toEqual([5, 5]);
    expect(ceiling.ok && ceiling.config.tenants["default"]?.pickupWaitSec).toEqual([300, 300]);
  });

  it("rejects a malformed pickupWaitSec", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: { default: { pickupWaitSec: [10] } } }, ctx)).toEqual({
      ok: false,
      error: "tenants.default.pickupWaitSec must be a [min, max] pair of numbers",
    });
    expect(
      applyConfigPatch(baseConfig(), { tenants: { default: { pickupWaitSec: ["a", "b"] } } }, ctx).ok,
    ).toBe(false);
  });

  it("validates and de-duplicates hotspots", () => {
    const result = applyConfigPatch(
      baseConfig(),
      { tenants: { default: { hotspots: ["taj", "taj", "kia-t1"] } } },
      ctx,
    );

    expect(result.ok && result.config.tenants["default"]?.hotspots).toEqual(["taj", "kia-t1"]);
  });

  it("rejects unknown or non-string hotspot ids with the index", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: { default: { hotspots: ["nope"] } } }, ctx)).toEqual({
      ok: false,
      error: "tenants.default.hotspots[0] is not a known POI id",
    });
    expect(applyConfigPatch(baseConfig(), { tenants: { default: { hotspots: ["kia-t1", 7] } } }, ctx)).toEqual({
      ok: false,
      error: "tenants.default.hotspots[1] is not a known POI id",
    });
    expect(applyConfigPatch(baseConfig(), { tenants: { default: { hotspots: "kia-t1" } } }, ctx)).toEqual({
      ok: false,
      error: "tenants.default.hotspots must be an array of POI ids",
    });
  });

  it("rejects unknown tenant fields", () => {
    expect(applyConfigPatch(baseConfig(), { tenants: { default: { wat: 1 } } }, ctx)).toEqual({
      ok: false,
      error: 'unknown config key "tenants.default.wat"',
    });
  });

  it("keeps unrelated fields when patching a tenant", () => {
    const result = applyConfigPatch(baseConfig(), { tenants: { default: { airportShare: 0.9 } } }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["default"]?.airportShare).toBe(0.9);
    expect(result.config.tenants["default"]?.requestIntervalSec).toBe(75);
    expect(result.config.tenants["saffron-routes"]).toEqual(baseConfig().tenants["saffron-routes"]);
  });

  it("reports changed paths sorted and only for real differences", () => {
    const result = applyConfigPatch(
      baseConfig(),
      {
        paused: true,
        tenants: {
          "saffron-routes": { onlineDrivers: 2, requestIntervalSec: 0 },
          default: { airportShare: 0.9 },
        },
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toEqual([
      "paused",
      "tenants.default.airportShare",
      "tenants.saffron-routes.onlineDrivers",
      "tenants.saffron-routes.requestIntervalSec",
    ]);
  });

  it("reports no change when values already match, including clamped input", () => {
    const config = baseConfig();
    const result = applyConfigPatch(
      config,
      { tenants: { default: { onlineDrivers: 99, airportShare: 0.4 } } },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["default"]?.onlineDrivers).toBe(6);
    expect(result.changed).toEqual([]);
  });
});
