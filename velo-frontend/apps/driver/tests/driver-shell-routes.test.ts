import { describe, expect, it } from "vitest";
import { isPublicDriverRoute, shouldPublishIdleDriverLocation } from "../app/_lib/driver-shell-routes";

describe("driver shell public routes", () => {
  it("keeps registration public so the shell skips protected requests", () => {
    expect(isPublicDriverRoute("/register")).toBe(true);
    expect(isPublicDriverRoute("/register/details")).toBe(true);
    expect(isPublicDriverRoute("/login")).toBe(true);
    expect(isPublicDriverRoute("/")).toBe(false);
    expect(isPublicDriverRoute("/me")).toBe(false);
  });
});

describe("driver shell idle location heartbeat routes", () => {
  it("publishes while online across private pages without duplicating page publishers", () => {
    expect(shouldPublishIdleDriverLocation("/rides")).toBe(true);
    expect(shouldPublishIdleDriverLocation("/earnings")).toBe(true);
    expect(shouldPublishIdleDriverLocation("/me")).toBe(true);
    expect(shouldPublishIdleDriverLocation("/")).toBe(false);
    expect(shouldPublishIdleDriverLocation("/ride/123")).toBe(false);
    expect(shouldPublishIdleDriverLocation("/login")).toBe(false);
  });
});
