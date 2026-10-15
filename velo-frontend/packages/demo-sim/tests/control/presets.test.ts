import { describe, expect, it } from "vitest";
import { applyPreset, isPresetName, type PresetName } from "../../src/control/presets.ts";
import { applyConfigPatch, defaultConfig, type ConfigContext, type SimConfig } from "../../src/control/runtime-config.ts";

const ctx: ConfigContext = {
  fleetSizes: { default: 6, "saffron-routes": 6 },
  poiIds: ["kia-t1", "kia-t2", "oberoi", "taj", "mg-road"],
  airportPoiIds: ["kia-t1", "kia-t2"],
  poiKinds: { "kia-t1": "airport", "kia-t2": "airport", oberoi: "hotel", taj: "hotel", "mg-road": "business" },
  poiWeights: { "kia-t1": 1, "kia-t2": 1, oberoi: 10, taj: 20, "mg-road": 1 },
};

function baseConfig(): SimConfig {
  return defaultConfig(ctx, 5);
}

describe("isPresetName", () => {
  it("accepts the four presets and rejects anything else", () => {
    expect(["quiet", "steady", "busy", "airport-rush"].every(isPresetName)).toBe(true);
    expect(isPresetName("calm")).toBe(false);
    expect(isPresetName(7)).toBe(false);
    expect(isPresetName(undefined)).toBe(false);
  });
});

describe("applyPreset", () => {
  it("applies quiet to every tenant", () => {
    const result = applyPreset(baseConfig(), "quiet", undefined, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const tenant of Object.values(result.config.tenants)) {
      expect(tenant.onlineDrivers).toBe(2);
      expect(tenant.requestIntervalSec).toBe(0);
      expect(tenant.airportShare).toBe(0.4);
      expect(tenant.pickupWaitSec).toEqual([15, 30]);
    }
  });

  it("applies steady as the documented default", () => {
    const scrambled = applyConfigPatch(
      baseConfig(),
      { tenants: { default: { onlineDrivers: 0, requestIntervalSec: 0, airportShare: 0 } } },
      ctx,
    );
    expect(scrambled.ok).toBe(true);
    if (!scrambled.ok) return;

    const result = applyPreset(scrambled.config, "steady", undefined, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["default"]).toEqual({
      onlineDrivers: 6,
      requestIntervalSec: 75,
      airportShare: 0.4,
      declineProbability: 0.15,
      pickupWaitSec: [15, 30],
      idleRepositionProbability: 0.3,
      hotspots: ["kia-t1", "kia-t2", "taj", "oberoi"],
    });
  });

  it("applies busy: all drivers, 25 s, decline 0.15", () => {
    const result = applyPreset(baseConfig(), "busy", undefined, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["default"]?.onlineDrivers).toBe(6);
    expect(result.config.tenants["default"]?.requestIntervalSec).toBe(25);
    expect(result.config.tenants["default"]?.declineProbability).toBe(0.15);
  });

  it("applies airport-rush: all drivers, 30 s, 0.8 share, airport hotspots", () => {
    const result = applyPreset(baseConfig(), "airport-rush", undefined, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tenant = result.config.tenants["default"];
    expect(tenant?.onlineDrivers).toBe(6);
    expect(tenant?.requestIntervalSec).toBe(30);
    expect(tenant?.airportShare).toBe(0.8);
    expect(tenant?.hotspots).toEqual(["kia-t1", "kia-t2"]);
  });

  it("scopes a preset to one tenant only", () => {
    const result = applyPreset(baseConfig(), "busy", "default", ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.tenants["default"]?.requestIntervalSec).toBe(25);
    expect(result.config.tenants["saffron-routes"]?.requestIntervalSec).toBe(75);
    expect(result.changed.every((path) => path.startsWith("tenants.default."))).toBe(true);
  });

  it("leaves global fields untouched", () => {
    const paused = applyConfigPatch(baseConfig(), { paused: true, speedFactor: 8, seed: 3 }, ctx);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    const result = applyPreset(paused.config, "quiet", undefined, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.paused).toBe(true);
    expect(result.config.speedFactor).toBe(8);
    expect(result.config.seed).toBe(3);
  });

  it("reports only the fields that actually changed", () => {
    const quiet = applyPreset(baseConfig(), "quiet", "default", ctx);
    expect(quiet.ok).toBe(true);
    if (!quiet.ok) return;

    const busy = applyPreset(quiet.config, "busy", "default", ctx);
    expect(busy.ok).toBe(true);
    if (!busy.ok) return;
    expect(busy.changed).toEqual([
      "tenants.default.onlineDrivers",
      "tenants.default.requestIntervalSec",
    ]);
  });

  it("rejects an unknown tenant", () => {
    expect(applyPreset(baseConfig(), "quiet", "ghost", ctx)).toEqual({
      ok: false,
      error: 'unknown tenant "ghost"',
    });
  });

  it("rejects an unknown preset name at runtime", () => {
    const result = applyPreset(baseConfig(), "calm" as PresetName, undefined, ctx);
    expect(result).toEqual({ ok: false, error: 'unknown preset "calm"' });
  });
});
