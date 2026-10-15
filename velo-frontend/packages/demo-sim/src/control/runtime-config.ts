export type PoiId = string;

export interface TenantSimConfig {
  onlineDrivers: number;
  requestIntervalSec: number;
  airportShare: number;
  declineProbability: number;
  pickupWaitSec: [number, number];
  idleRepositionProbability: number;
  hotspots: PoiId[];
}

export interface SimConfig {
  paused: boolean;
  speedFactor: number;
  seed: number;
  tenants: Record<string, TenantSimConfig>;
}

export interface ConfigContext {
  fleetSizes: Record<string, number>;
  poiIds: readonly PoiId[];
  airportPoiIds: readonly PoiId[];
}

export type PatchResult =
  | { ok: true; config: SimConfig; changed: string[] }
  | { ok: false; error: string };

const MIN_SPEED_FACTOR = 1;
const MAX_SPEED_FACTOR = 20;
const REQUEST_INTERVAL_MIN = 10;
const REQUEST_INTERVAL_MAX = 900;
const MIN_PROBABILITY = 0;
const MAX_PROBABILITY = 1;
const MAX_DECLINE_PROBABILITY = 0.9;
const MIN_PICKUP_WAIT_SEC = 5;
const MAX_PICKUP_WAIT_SEC = 300;

const STEADY_REQUEST_INTERVAL_SEC = 75;
const STEADY_AIRPORT_SHARE = 0.4;
const STEADY_DECLINE_PROBABILITY = 0.15;
const STEADY_PICKUP_WAIT_SEC: [number, number] = [15, 30];
const STEADY_IDLE_REPOSITION_PROBABILITY = 0.3;

/** The "steady" baseline shared by the default config and every preset. */
export function steadyTenantConfig(ctx: ConfigContext, fleetSize: number): TenantSimConfig {
  return {
    onlineDrivers: fleetSize,
    requestIntervalSec: STEADY_REQUEST_INTERVAL_SEC,
    airportShare: STEADY_AIRPORT_SHARE,
    declineProbability: STEADY_DECLINE_PROBABILITY,
    pickupWaitSec: [STEADY_PICKUP_WAIT_SEC[0], STEADY_PICKUP_WAIT_SEC[1]],
    idleRepositionProbability: STEADY_IDLE_REPOSITION_PROBABILITY,
    // The frozen ConfigContext exposes airports but no POI weights, so
    // "airports + top-weighted hotels" resolves to the airport ids.
    hotspots: [...ctx.airportPoiIds],
  };
}

/** Every tenant starts from the "steady" scenario. */
export function defaultConfig(ctx: ConfigContext, seed: number): SimConfig {
  const tenants: Record<string, TenantSimConfig> = {};
  for (const [slug, fleetSize] of Object.entries(ctx.fleetSizes)) {
    tenants[slug] = steadyTenantConfig(ctx, fleetSize);
  }
  return { paused: false, speedFactor: 1, seed, tenants };
}

/** Deep-partial patch: unknown keys are rejected, numbers are clamped to their range, the input is never mutated. */
export function applyConfigPatch(config: SimConfig, patch: unknown, ctx: ConfigContext): PatchResult {
  if (!isRecord(patch)) return { ok: false, error: "config patch must be an object" };

  const next = structuredClone(config);
  const changed: string[] = [];

  for (const key of Object.keys(patch)) {
    const value = patch[key];
    switch (key) {
      case "paused": {
        if (typeof value !== "boolean") return { ok: false, error: "paused must be a boolean" };
        if (next.paused !== value) {
          next.paused = value;
          changed.push("paused");
        }
        break;
      }
      case "speedFactor": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return { ok: false, error: "speedFactor must be a number" };
        }
        const clamped = clamp(value, MIN_SPEED_FACTOR, MAX_SPEED_FACTOR);
        if (next.speedFactor !== clamped) {
          next.speedFactor = clamped;
          changed.push("speedFactor");
        }
        break;
      }
      case "seed": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          return { ok: false, error: "seed must be a number" };
        }
        if (next.seed !== value) {
          next.seed = value;
          changed.push("seed");
        }
        break;
      }
      case "tenants": {
        const error = applyTenantsPatch(next, value, ctx, changed);
        if (error !== undefined) return { ok: false, error };
        break;
      }
      default:
        return { ok: false, error: `unknown config key "${key}"` };
    }
  }

  changed.sort();
  return { ok: true, config: next, changed };
}

function applyTenantsPatch(
  next: SimConfig,
  value: unknown,
  ctx: ConfigContext,
  changed: string[],
): string | undefined {
  if (!isRecord(value)) return "tenants must be an object";

  for (const [slug, tenantValue] of Object.entries(value)) {
    const fleetSize = ctx.fleetSizes[slug];
    if (fleetSize === undefined) return `tenants.${slug} is not a known tenant`;
    if (!isRecord(tenantValue)) return `tenants.${slug} must be an object`;

    const current = next.tenants[slug] ?? steadyTenantConfig(ctx, fleetSize);
    next.tenants[slug] = current;

    const error = applyTenantFields(current, slug, tenantValue, fleetSize, ctx, changed);
    if (error !== undefined) return error;
  }

  return undefined;
}

function applyTenantFields(
  current: TenantSimConfig,
  slug: string,
  patch: Record<string, unknown>,
  fleetSize: number,
  ctx: ConfigContext,
  changed: string[],
): string | undefined {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    const path = `tenants.${slug}.${key}`;

    switch (key) {
      case "onlineDrivers": {
        if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
        // Driver counts are whole and cannot exceed the tenant's fleet size.
        const clamped = Math.round(clamp(value, 0, Math.max(0, fleetSize)));
        if (current.onlineDrivers !== clamped) {
          current.onlineDrivers = clamped;
          changed.push(path);
        }
        break;
      }
      case "requestIntervalSec": {
        if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
        const clamped = clampRequestInterval(value);
        if (current.requestIntervalSec !== clamped) {
          current.requestIntervalSec = clamped;
          changed.push(path);
        }
        break;
      }
      case "airportShare": {
        if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
        const clamped = clamp(value, MIN_PROBABILITY, MAX_PROBABILITY);
        if (current.airportShare !== clamped) {
          current.airportShare = clamped;
          changed.push(path);
        }
        break;
      }
      case "declineProbability": {
        if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
        const clamped = clamp(value, MIN_PROBABILITY, MAX_DECLINE_PROBABILITY);
        if (current.declineProbability !== clamped) {
          current.declineProbability = clamped;
          changed.push(path);
        }
        break;
      }
      case "pickupWaitSec": {
        if (!Array.isArray(value)) return `${path} must be a [min, max] pair of numbers`;
        const pair: unknown[] = value;
        const min = pair[0];
        const max = pair[1];
        if (pair.length !== 2 || typeof min !== "number" || typeof max !== "number") {
          return `${path} must be a [min, max] pair of numbers`;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return `${path} must be a [min, max] pair of numbers`;
        const low = clamp(min, MIN_PICKUP_WAIT_SEC, MAX_PICKUP_WAIT_SEC);
        const high = clamp(max, MIN_PICKUP_WAIT_SEC, MAX_PICKUP_WAIT_SEC);
        const sorted: [number, number] = low <= high ? [low, high] : [high, low];
        if (current.pickupWaitSec[0] !== sorted[0] || current.pickupWaitSec[1] !== sorted[1]) {
          current.pickupWaitSec = sorted;
          changed.push(path);
        }
        break;
      }
      case "idleRepositionProbability": {
        if (typeof value !== "number" || !Number.isFinite(value)) return `${path} must be a number`;
        const clamped = clamp(value, MIN_PROBABILITY, MAX_PROBABILITY);
        if (current.idleRepositionProbability !== clamped) {
          current.idleRepositionProbability = clamped;
          changed.push(path);
        }
        break;
      }
      case "hotspots": {
        if (!Array.isArray(value)) return `${path} must be an array of POI ids`;
        const items: unknown[] = value;
        const ids: PoiId[] = [];
        for (let index = 0; index < items.length; index += 1) {
          const id = items[index];
          if (typeof id !== "string" || !ctx.poiIds.includes(id)) return `${path}[${index}] is not a known POI id`;
          if (!ids.includes(id)) ids.push(id);
        }
        if (!sameIds(current.hotspots, ids)) {
          current.hotspots = ids;
          changed.push(path);
        }
        break;
      }
      default:
        return `unknown config key "${path}"`;
    }
  }

  return undefined;
}

function clampRequestInterval(value: number): number {
  if (value <= 0) return 0;
  return clamp(value, REQUEST_INTERVAL_MIN, REQUEST_INTERVAL_MAX);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sameIds(a: readonly PoiId[], b: readonly PoiId[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
