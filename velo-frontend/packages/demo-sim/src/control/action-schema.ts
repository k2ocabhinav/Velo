import type { ConfigContext, PoiId } from "./runtime-config.ts";

export type SimAction =
  | { type: "request-trip"; tenant: string; from?: PoiId; to?: PoiId; rider?: string }
  | { type: "burst"; tenant: string; count: number; near?: PoiId }
  | { type: "driver-offline" | "driver-online"; tenant: string; driver?: string }
  | { type: "decline-next"; tenant: string; count: number }
  | { type: "traffic-delay"; tenant: string; driver?: string; seconds: number }
  | { type: "rider-cancel"; tenant: string; rideRequestId?: number }
  | { type: "driver-cancel"; tenant: string; rideId?: number }
  | { type: "reset-fleet"; tenant: string };

export type ActionParseResult = { ok: true; action: SimAction } | { ok: false; error: string };

const ALLOWED_FIELDS: Record<string, readonly string[]> = {
  "request-trip": ["tenant", "from", "to", "rider"],
  burst: ["tenant", "count", "near"],
  "driver-offline": ["tenant", "driver"],
  "driver-online": ["tenant", "driver"],
  "decline-next": ["tenant", "count"],
  "traffic-delay": ["tenant", "driver", "seconds"],
  "rider-cancel": ["tenant", "rideRequestId"],
  "driver-cancel": ["tenant", "rideId"],
  "reset-fleet": ["tenant"],
};

type Field<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates an action name and its body against the config context; the body must not include `type`. */
export function parseAction(name: string, body: unknown, ctx: ConfigContext): ActionParseResult {
  const allowed = ALLOWED_FIELDS[name];
  if (allowed === undefined) return { ok: false, error: `unknown action "${name}"` };

  let record: Record<string, unknown>;
  if (body === undefined || body === null) record = {};
  else if (isRecord(body)) record = body;
  else return { ok: false, error: `${name}: request body must be a JSON object` };

  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) return { ok: false, error: `${name}: unknown field "${key}"` };
  }

  const tenant = record["tenant"];
  if (tenant === undefined) return { ok: false, error: `${name}: tenant is required` };
  if (typeof tenant !== "string" || tenant.length === 0) {
    return { ok: false, error: `${name}: tenant must be a non-empty string` };
  }
  if (!Object.prototype.hasOwnProperty.call(ctx.fleetSizes, tenant)) {
    return { ok: false, error: `${name}: unknown tenant "${tenant}"` };
  }

  switch (name) {
    case "request-trip": {
      const from = readOptionalPoi(record, "from", ctx);
      if (!from.ok) return err(name, from.error);
      const to = readOptionalPoi(record, "to", ctx);
      if (!to.ok) return err(name, to.error);
      const rider = readOptionalLabel(record, "rider");
      if (!rider.ok) return err(name, rider.error);
      return {
        ok: true,
        action: {
          type: "request-trip",
          tenant,
          ...(from.value !== undefined ? { from: from.value } : {}),
          ...(to.value !== undefined ? { to: to.value } : {}),
          ...(rider.value !== undefined ? { rider: rider.value } : {}),
        },
      };
    }
    case "burst": {
      const count = readRequiredInt(record, "count", 2, 8);
      if (!count.ok) return err(name, count.error);
      const near = readOptionalPoi(record, "near", ctx);
      if (!near.ok) return err(name, near.error);
      return {
        ok: true,
        action: {
          type: "burst",
          tenant,
          count: count.value,
          ...(near.value !== undefined ? { near: near.value } : {}),
        },
      };
    }
    case "driver-offline":
    case "driver-online": {
      const driver = readOptionalLabel(record, "driver");
      if (!driver.ok) return err(name, driver.error);
      return {
        ok: true,
        action: { type: name, tenant, ...(driver.value !== undefined ? { driver: driver.value } : {}) },
      };
    }
    case "decline-next": {
      const count = readOptionalInt(record, "count", 1, 5, 1);
      if (!count.ok) return err(name, count.error);
      return { ok: true, action: { type: "decline-next", tenant, count: count.value } };
    }
    case "traffic-delay": {
      const driver = readOptionalLabel(record, "driver");
      if (!driver.ok) return err(name, driver.error);
      const seconds = readRequiredNumber(record, "seconds", 10, 600);
      if (!seconds.ok) return err(name, seconds.error);
      return {
        ok: true,
        action: {
          type: "traffic-delay",
          tenant,
          ...(driver.value !== undefined ? { driver: driver.value } : {}),
          seconds: seconds.value,
        },
      };
    }
    case "rider-cancel": {
      const rideRequestId = readOptionalId(record, "rideRequestId");
      if (!rideRequestId.ok) return err(name, rideRequestId.error);
      return {
        ok: true,
        action: {
          type: "rider-cancel",
          tenant,
          ...(rideRequestId.value !== undefined ? { rideRequestId: rideRequestId.value } : {}),
        },
      };
    }
    case "driver-cancel": {
      const rideId = readOptionalId(record, "rideId");
      if (!rideId.ok) return err(name, rideId.error);
      return {
        ok: true,
        action: {
          type: "driver-cancel",
          tenant,
          ...(rideId.value !== undefined ? { rideId: rideId.value } : {}),
        },
      };
    }
    case "reset-fleet":
      return { ok: true, action: { type: "reset-fleet", tenant } };
    default:
      return { ok: false, error: `unknown action "${name}"` };
  }
}

function err(name: string, message: string): { ok: false; error: string } {
  return { ok: false, error: `${name}: ${message}` };
}

function readOptionalPoi(record: Record<string, unknown>, key: string, ctx: ConfigContext): Field<PoiId | undefined> {
  const value = record[key];
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "string") return { ok: false, error: `${key} must be a POI id` };
  if (!ctx.poiIds.includes(value)) return { ok: false, error: `unknown POI id "${value}"` };
  return { ok: true, value };
}

function readOptionalLabel(record: Record<string, unknown>, key: string): Field<string | undefined> {
  const value = record[key];
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "string" || value.length === 0) return { ok: false, error: `${key} must be a non-empty string` };
  return { ok: true, value };
}

function readRequiredInt(record: Record<string, unknown>, key: string, min: number, max: number): Field<number> {
  const value = record[key];
  if (value === undefined) return { ok: false, error: `${key} is required` };
  if (typeof value !== "number" || !Number.isInteger(value)) return { ok: false, error: `${key} must be an integer` };
  if (value < min || value > max) return { ok: false, error: `${key} must be between ${min} and ${max}` };
  return { ok: true, value };
}

function readOptionalInt(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  fallback: number,
): Field<number> {
  const value = record[key];
  if (value === undefined) return { ok: true, value: fallback };
  if (typeof value !== "number" || !Number.isInteger(value)) return { ok: false, error: `${key} must be an integer` };
  if (value < min || value > max) return { ok: false, error: `${key} must be between ${min} and ${max}` };
  return { ok: true, value };
}

function readRequiredNumber(record: Record<string, unknown>, key: string, min: number, max: number): Field<number> {
  const value = record[key];
  if (value === undefined) return { ok: false, error: `${key} is required` };
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, error: `${key} must be a number` };
  if (value < min || value > max) return { ok: false, error: `${key} must be between ${min} and ${max}` };
  return { ok: true, value };
}

function readOptionalId(record: Record<string, unknown>, key: string): Field<number | undefined> {
  const value = record[key];
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return { ok: false, error: `${key} must be a positive integer` };
  }
  return { ok: true, value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
