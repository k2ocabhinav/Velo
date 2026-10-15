import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { attachTenantSlugHeader, DEFAULT_TENANT_BRANDING, fetchTenantBranding, getTenantPluralTripLabel, getTenantWordmark, resolveTenantSlug, TENANT_SLUG_HEADER } from "../src/tenant";

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

  it("uses the forwarded host for tenant resolution behind a reverse proxy", () => {
    const request = new NextRequest("http://localhost:6401/dispatch", {
      headers: { host: "localhost:6401", "x-forwarded-host": "saffron-routes.localhost:6401" },
    });

    const response = attachTenantSlugHeader(request, NextResponse.next());

    expect(response.headers.get("x-middleware-request-" + TENANT_SLUG_HEADER)).toBe("saffron-routes");
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
