import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { attachTenantSlugHeader, DEFAULT_TENANT_BRANDING, fetchTenantBranding, getTenantAdminUsersLabel, getTenantLabelForCount, getTenantLabelWords, getTenantPluralLabel, getTenantPluralTripLabel, getTenantTripLabelForCount, getTenantWordmark, resolveTenantSlug, resolveTenantSlugFromHeader, resolveTenantSlugFromRequest, TENANT_SLUG_HEADER } from "../src/tenant";

afterEach(() => vi.unstubAllEnvs());

describe("tenant resolution", () => {
  it("uses a tenant subdomain and leaves platform hosts on the development default", () => {
    expect(resolveTenantSlug({ hostname: "acme.velo.app" })).toBe("acme");
    expect(resolveTenantSlug({ hostname: "acme.localhost:5202" })).toBe("acme");
    expect(resolveTenantSlug({ hostname: "admin.velo.app", defaultTenantSlug: "default" })).toBe("default");
    expect(resolveTenantSlug({ hostname: "localhost:5202" })).toBe("default");
  });

  it("rejects invalid tenant subdomains and invalid development defaults", () => {
    expect(resolveTenantSlug({ hostname: "two.labels.localhost" })).toBe("default");
    expect(resolveTenantSlug({ hostname: "-bad.localhost" })).toBe("default");
    expect(resolveTenantSlug({ hostname: "localhost", defaultTenantSlug: "../admin" })).toBe("default");
  });

  it("resolves the tenant from the incoming host when Next's URL uses an internal host", () => {
    const request = new NextRequest("http://localhost:6401/dispatch", {
      headers: { host: "saffron-routes.localhost:6401" },
    });

    const response = attachTenantSlugHeader(request, NextResponse.next());

    expect(response.headers.get("x-middleware-request-" + TENANT_SLUG_HEADER)).toBe("saffron-routes");
  });

  it("ignores forwarded host values unless proxy trust is explicitly enabled", () => {
    const request = new NextRequest("http://localhost:6401/dispatch", {
      headers: { host: "localhost:6401", "x-forwarded-host": "saffron-routes.localhost:6401" },
    });

    const response = attachTenantSlugHeader(request, NextResponse.next());

    expect(response.headers.get("x-middleware-request-" + TENANT_SLUG_HEADER)).toBe("default");
  });

  it("uses the forwarded host only behind an explicitly trusted proxy", () => {
    vi.stubEnv("VELO_TRUST_PROXY", "1");
    const request = new NextRequest("http://localhost:6401/dispatch", {
      headers: { host: "localhost:6401", "x-forwarded-host": "saffron-routes.localhost:6401" },
    });

    const response = attachTenantSlugHeader(request, NextResponse.next());

    expect(response.headers.get("x-middleware-request-" + TENANT_SLUG_HEADER)).toBe("saffron-routes");
  });

  it("resolves the tenant slug from a request's host for BFF routes", () => {
    expect(resolveTenantSlugFromRequest(new Headers({ host: "saffron-routes.localhost:6401" }))).toBe("saffron-routes");
    expect(resolveTenantSlugFromRequest(new Headers({ host: "localhost:6401" }))).toBe("default");
  });
});

describe("tenant branding fetch", () => {
  it("uses the tenant brand as a display wordmark and preserves the default VELO mark", () => {
    expect(getTenantWordmark(" Northstar Mobility ")).toBe("Northstar Mobility");
    expect(getTenantWordmark("Velo")).toBe("VELO");
    expect(getTenantWordmark(" ")).toBe("VELO");
  });

  it("pluralizes tenant trip labels for navigation", () => {
    expect(getTenantPluralTripLabel("Trip")).toBe("Trips");
    expect(getTenantPluralTripLabel("Transfer")).toBe("Transfers");
    expect(getTenantPluralTripLabel("Transfers")).toBe("Transfers");
    expect(getTenantPluralTripLabel(null)).toBe("Trips");
  });

  it("maps tenant rider, driver, and trip nouns in title and sentence case", () => {
    expect(getTenantPluralLabel("Guest")).toBe("Guests");
    expect(getTenantPluralLabel("Chauffeur")).toBe("Chauffeurs");
    expect(getTenantPluralLabel("Transfer")).toBe("Transfers");
    expect(getTenantLabelForCount(1, "Guest")).toBe("Guest");
    expect(getTenantLabelForCount(3, "Chauffeur")).toBe("Chauffeurs");
    expect(getTenantLabelForCount(1, "Transfer", { midSentence: true })).toBe("transfer");
    expect(getTenantLabelForCount(4, "Transfer", { midSentence: true })).toBe("transfers");
    expect(getTenantLabelForCount(0, null, { fallback: "Driver" })).toBe("Drivers");
    expect(getTenantAdminUsersLabel("Rider")).toBe("Users");
    expect(getTenantAdminUsersLabel("Guest")).toBe("Guests");
  });

  it("selects the trip label that matches a count", () => {
    expect(getTenantTripLabelForCount(1, "Trip")).toBe("Trip");
    expect(getTenantTripLabelForCount(2, "Trip")).toBe("Trips");
    expect(getTenantTripLabelForCount(0, "Transfer")).toBe("Transfers");
    expect(getTenantTripLabelForCount(1, "Transfer")).toBe("Transfer");
    expect(getTenantTripLabelForCount(3, null)).toBe("Trips");
  });

  it("lower-cases the trip label for mid-sentence use", () => {
    expect(getTenantTripLabelForCount(1, "Trip", { midSentence: true })).toBe("trip");
    expect(getTenantTripLabelForCount(4, "Trip", { midSentence: true })).toBe("trips");
    expect(getTenantTripLabelForCount(1, "Transfer", { midSentence: true })).toBe("transfer");
    expect(getTenantTripLabelForCount(3, "Transfer", { midSentence: true })).toBe("transfers");
    expect(getTenantTripLabelForCount(0, "Airport Transfer", { midSentence: true })).toBe("airport transfers");
    expect(getTenantTripLabelForCount(2, null, { midSentence: true })).toBe("trips");
  });

  it("resolves every title and sentence case form of the tenant nouns in one pass", () => {
    expect(getTenantLabelWords({ riderLabel: "Guest", driverLabel: "Chauffeur", tripLabel: "Transfer" })).toEqual({
      rider: "Guest",
      driver: "Chauffeur",
      trip: "Transfer",
      riders: "Guests",
      drivers: "Chauffeurs",
      trips: "Transfers",
      riderWord: "guest",
      driverWord: "chauffeur",
      tripWord: "transfer",
      tripsWord: "transfers",
    });
  });

  it("falls back to the Velo nouns when the tenant has no labels", () => {
    expect(getTenantLabelWords({ riderLabel: "", driverLabel: "", tripLabel: "" })).toEqual({
      rider: "Rider",
      driver: "Driver",
      trip: "Trip",
      riders: "Riders",
      drivers: "Drivers",
      trips: "Trips",
      riderWord: "rider",
      driverWord: "driver",
      tripWord: "trip",
      tripsWord: "trips",
    });
  });

  it("reads the middleware tenant header and falls back when it is absent", () => {
    expect(resolveTenantSlugFromHeader("saffron-routes", "default")).toBe("saffron-routes");
    expect(resolveTenantSlugFromHeader("  saffron-routes  ", "default")).toBe("saffron-routes");
    expect(resolveTenantSlugFromHeader(null, "default")).toBe("default");
    expect(resolveTenantSlugFromHeader("   ", "default")).toBe("default");
  });

  it("loads the public envelope using the Next fetch revalidation cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        tenantId: 8,
        brandName: "Northstar",
        primaryColor: "#0057B8",
        riderLabel: "Passenger",
        driverLabel: "Courier",
        tripLabel: "Journey",
        riderPortalEnabled: true,
      },
    }), { status: 200 }));

    const branding = await fetchTenantBranding("northstar", fetcher, "http://api.test");

    expect(branding).toMatchObject({
      tenantId: 8,
      brandName: "Northstar",
      currency: "USD",
      primaryColor: "#0057B8",
      riderLabel: "Passenger",
      driverLabel: "Courier",
      tripLabel: "Journey",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/api/v1/public/tenant/branding?tenant=northstar",
      expect.objectContaining({ cache: "force-cache", next: { revalidate: 60 } }),
    );
  });

  it("returns null when the public endpoint is unavailable", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    await expect(fetchTenantBranding("missing", fetcher, "http://api.test")).resolves.toBeNull();
    expect(DEFAULT_TENANT_BRANDING.brandName).toBe("Velo");
  });
});
