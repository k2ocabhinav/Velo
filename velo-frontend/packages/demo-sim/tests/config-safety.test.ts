import { describe, expect, it } from "vitest";
import { parseCliArgs, SIM_TENANTS } from "../src/config.ts";
import { assertSimulationAllowed, isLoopbackHost, validateApiBaseUrl, validateOptions } from "../src/safety.ts";

describe("CLI and simulator safety", () => {
  it("parses the documented options and defaults", () => {
    expect(parseCliArgs([])).toMatchObject({
      apiBaseUrl: "http://localhost:8080",
      controlPort: 8790,
      seed: 42,
      speed: 4,
      paused: false,
      tenants: ["default", "saffron-routes"],
    });
    expect(parseCliArgs(["--api", "http://localhost:9000", "--control-port", "8791", "--seed", "7", "--speed", "2", "--paused", "--tenants", "default"]))
      .toMatchObject({ apiBaseUrl: "http://localhost:9000", controlPort: 8791, seed: 7, speed: 2, paused: true, tenants: ["default"] });
  });

  it("refuses missing opt-in, non-loopback hosts, unlisted tenants, and invalid speed", () => {
    expect(() => assertSimulationAllowed(undefined)).toThrow(/VELO_SIM_ALLOW=1/);
    expect(() => validateApiBaseUrl("https://example.com")).toThrow(/loopback/);
    expect(() => parseCliArgs(["--tenants", "production"])).toThrow(/not allowlisted/);
    expect(() => parseCliArgs(["--speed", "21"])).toThrow(/1 to 20/);
  });

  it("accepts only loopback names and simulator account domains", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("default.localhost")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("localhost.example.com")).toBe(false);
    const validated = validateOptions(parseCliArgs(["--api", "http://saffron-routes.localhost:8080/", "--tenants", "saffron-routes"]), "1");
    expect(validated.apiBaseUrl).toBe("http://saffron-routes.localhost:8080");
    expect(SIM_TENANTS["saffron-routes"].drivers).toHaveLength(6);
    expect(SIM_TENANTS.default.riders).toHaveLength(4);
    expect(SIM_TENANTS.default.drivers.map((driver) => driver.vehicleId)).toEqual([
      "KA01SV1001", "KA01SV1002", "KA01SV1003", "KA01SV1004", "KA01SV1005", "KA01SV1006",
    ]);
    expect(SIM_TENANTS["saffron-routes"].drivers.map((driver) => driver.vehicleId)).toEqual([
      "KA03SS2001", "KA03SS2002", "KA03SS2003", "KA03SS2004", "KA03SS2005", "KA03SS2006",
    ]);
    expect(() => validateOptions({ ...parseCliArgs([]), apiBaseUrl: "http://192.168.1.10:8080" }, "1")).toThrow(/loopback/);
  });
});
