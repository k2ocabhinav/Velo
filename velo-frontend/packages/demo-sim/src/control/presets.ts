import { applyConfigPatch, steadyTenantConfig } from "./runtime-config.ts";
import type { ConfigContext, PatchResult, SimConfig, TenantSimConfig } from "./runtime-config.ts";

export type PresetName = "quiet" | "steady" | "busy" | "airport-rush";

const PRESET_NAMES: readonly PresetName[] = ["quiet", "steady", "busy", "airport-rush"];

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === "string" && (PRESET_NAMES as readonly string[]).includes(value);
}

/** Writes the scenario's values for the named tenant, or for every tenant when `tenant` is undefined. */
export function applyPreset(
  config: SimConfig,
  name: PresetName,
  tenant: string | undefined,
  ctx: ConfigContext,
): PatchResult {
  if (!isPresetName(name)) return { ok: false, error: `unknown preset "${String(name)}"` };

  const slugs = tenant === undefined ? Object.keys(config.tenants) : [tenant];
  const tenants: Record<string, TenantSimConfig> = {};

  for (const slug of slugs) {
    const fleetSize = ctx.fleetSizes[slug];
    if (fleetSize === undefined) return { ok: false, error: `unknown tenant "${slug}"` };
    tenants[slug] = presetTenantConfig(name, ctx, fleetSize);
  }

  return applyConfigPatch(config, { tenants }, ctx);
}

function presetTenantConfig(name: PresetName, ctx: ConfigContext, fleetSize: number): TenantSimConfig {
  const steady = steadyTenantConfig(ctx, fleetSize);
  switch (name) {
    case "quiet":
      return { ...steady, onlineDrivers: 2, requestIntervalSec: 0 };
    case "steady":
      return steady;
    case "busy":
      return { ...steady, onlineDrivers: fleetSize, requestIntervalSec: 25, declineProbability: 0.15 };
    case "airport-rush":
      return {
        ...steady,
        onlineDrivers: fleetSize,
        requestIntervalSec: 30,
        airportShare: 0.8,
        hotspots: [...ctx.airportPoiIds],
      };
  }
}
