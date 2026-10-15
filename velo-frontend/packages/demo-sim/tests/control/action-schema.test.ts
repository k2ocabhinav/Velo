import { describe, expect, it } from "vitest";
import { parseAction, type SimAction } from "../../src/control/action-schema.ts";
import type { ConfigContext } from "../../src/control/runtime-config.ts";

const ctx: ConfigContext = {
  fleetSizes: { default: 6, "saffron-routes": 6 },
  poiIds: ["kia-t1", "kia-t2", "oberoi", "taj"],
  airportPoiIds: ["kia-t1", "kia-t2"],
  poiKinds: { "kia-t1": "airport", "kia-t2": "airport", oberoi: "hotel", taj: "hotel" },
  poiWeights: { "kia-t1": 1, "kia-t2": 1, oberoi: 10, taj: 20 },
};

function ok(name: string, body: unknown): SimAction {
  const result = parseAction(name, body, ctx);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result.action;
}

function error(name: string, body: unknown): string {
  const result = parseAction(name, body, ctx);
  if (result.ok) throw new Error(`expected error, got: ${JSON.stringify(result.action)}`);
  return result.error;
}

describe("parseAction request-trip", () => {
  it("parses from, to and rider", () => {
    expect(ok("request-trip", { tenant: "default", from: "oberoi", to: "kia-t1", rider: "rider1" })).toEqual({
      type: "request-trip",
      tenant: "default",
      from: "oberoi",
      to: "kia-t1",
      rider: "rider1",
    });
  });

  it("allows the tenant alone and omits optional fields", () => {
    expect(ok("request-trip", { tenant: "default" })).toEqual({ type: "request-trip", tenant: "default" });
  });

  it("treats a missing body as an empty body", () => {
    expect(error("request-trip", undefined)).toBe("request-trip: tenant is required");
  });

  it("rejects an unknown POI id", () => {
    expect(error("request-trip", { tenant: "default", from: "nowhere" })).toBe(
      'request-trip: unknown POI id "nowhere"',
    );
  });

  it("rejects a non-string rider", () => {
    expect(error("request-trip", { tenant: "default", rider: 5 })).toBe(
      "request-trip: rider must be a non-empty string",
    );
  });
});

describe("parseAction burst", () => {
  it("parses the count and optional near", () => {
    expect(ok("burst", { tenant: "default", count: 4, near: "taj" })).toEqual({
      type: "burst",
      tenant: "default",
      count: 4,
      near: "taj",
    });
  });

  it("requires the count", () => {
    expect(error("burst", { tenant: "default" })).toBe("burst: count is required");
  });

  it("rejects out-of-range and non-integer counts", () => {
    expect(error("burst", { tenant: "default", count: 9 })).toBe("burst: count must be between 2 and 8");
    expect(error("burst", { tenant: "default", count: 3.5 })).toBe("burst: count must be an integer");
    expect(error("burst", { tenant: "default", count: "4" })).toBe("burst: count must be an integer");
  });
});

describe("parseAction driver-offline / driver-online", () => {
  it("parses with and without a named driver", () => {
    expect(ok("driver-offline", { tenant: "saffron-routes", driver: "chauffeur1" })).toEqual({
      type: "driver-offline",
      tenant: "saffron-routes",
      driver: "chauffeur1",
    });
    expect(ok("driver-online", { tenant: "default" })).toEqual({ type: "driver-online", tenant: "default" });
  });

  it("rejects an empty driver", () => {
    expect(error("driver-offline", { tenant: "default", driver: "" })).toBe(
      "driver-offline: driver must be a non-empty string",
    );
  });
});

describe("parseAction decline-next", () => {
  it("defaults the count to 1", () => {
    expect(ok("decline-next", { tenant: "default" })).toEqual({ type: "decline-next", tenant: "default", count: 1 });
  });

  it("accepts a count up to 5", () => {
    expect(ok("decline-next", { tenant: "default", count: 5 })).toEqual({
      type: "decline-next",
      tenant: "default",
      count: 5,
    });
  });

  it("rejects a count above 5", () => {
    expect(error("decline-next", { tenant: "default", count: 6 })).toBe("decline-next: count must be between 1 and 5");
  });
});

describe("parseAction traffic-delay", () => {
  it("parses a delay for a named driver", () => {
    expect(ok("traffic-delay", { tenant: "default", driver: "driver2", seconds: 120 })).toEqual({
      type: "traffic-delay",
      tenant: "default",
      driver: "driver2",
      seconds: 120,
    });
  });

  it("requires seconds in 10..600", () => {
    expect(error("traffic-delay", { tenant: "default" })).toBe("traffic-delay: seconds is required");
    expect(error("traffic-delay", { tenant: "default", seconds: 5 })).toBe(
      "traffic-delay: seconds must be between 10 and 600",
    );
    expect(error("traffic-delay", { tenant: "default", seconds: 601 })).toBe(
      "traffic-delay: seconds must be between 10 and 600",
    );
  });
});

describe("parseAction rider-cancel / driver-cancel", () => {
  it("parses with and without an id", () => {
    expect(ok("rider-cancel", { tenant: "default", rideRequestId: 33 })).toEqual({
      type: "rider-cancel",
      tenant: "default",
      rideRequestId: 33,
    });
    expect(ok("rider-cancel", { tenant: "default" })).toEqual({ type: "rider-cancel", tenant: "default" });
    expect(ok("driver-cancel", { tenant: "default", rideId: 21 })).toEqual({
      type: "driver-cancel",
      tenant: "default",
      rideId: 21,
    });
    expect(ok("driver-cancel", { tenant: "default" })).toEqual({ type: "driver-cancel", tenant: "default" });
  });

  it("rejects a non-positive id", () => {
    expect(error("rider-cancel", { tenant: "default", rideRequestId: 0 })).toBe(
      "rider-cancel: rideRequestId must be a positive integer",
    );
    expect(error("driver-cancel", { tenant: "default", rideId: -1 })).toBe(
      "driver-cancel: rideId must be a positive integer",
    );
  });
});

describe("parseAction reset-fleet", () => {
  it("parses the tenant alone", () => {
    expect(ok("reset-fleet", { tenant: "saffron-routes" })).toEqual({ type: "reset-fleet", tenant: "saffron-routes" });
  });
});

describe("parseAction shared validation", () => {
  it("rejects an unknown action", () => {
    expect(error("teleport", { tenant: "default" })).toBe('unknown action "teleport"');
  });

  it("rejects a non-object body", () => {
    expect(error("reset-fleet", "default")).toBe("reset-fleet: request body must be a JSON object");
    expect(error("reset-fleet", [])).toBe("reset-fleet: request body must be a JSON object");
  });

  it("requires a tenant", () => {
    expect(error("reset-fleet", {})).toBe("reset-fleet: tenant is required");
  });

  it("rejects an empty or unknown tenant", () => {
    expect(error("reset-fleet", { tenant: "" })).toBe("reset-fleet: tenant must be a non-empty string");
    expect(error("reset-fleet", { tenant: "ghost" })).toBe('reset-fleet: unknown tenant "ghost"');
  });

  it("rejects unknown fields", () => {
    expect(error("reset-fleet", { tenant: "default", extra: 1 })).toBe('reset-fleet: unknown field "extra"');
    expect(error("driver-online", { tenant: "default", count: 2 })).toBe('driver-online: unknown field "count"');
  });
});
