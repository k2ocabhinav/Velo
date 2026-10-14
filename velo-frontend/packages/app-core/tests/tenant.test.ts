import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TENANT_BRANDING, fetchTenantBranding, getTenantWordmark, resolveTenantSlug } from "../src/tenant";

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
});

describe("tenant branding fetch", () => {
  it("uses the tenant brand as a display wordmark and preserves the default VELO mark", () => {
    expect(getTenantWordmark(" Northstar Mobility ")).toBe("Northstar Mobility");
    expect(getTenantWordmark("Velo")).toBe("VELO");
    expect(getTenantWordmark(" ")).toBe("VELO");
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
