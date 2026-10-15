import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_BRANDING, type TenantBranding } from "@velo/app-core/tenant";
import { TenantBrandingProvider } from "@velo/ui/theme";
import DriverAccountPage from "../app/me/page";
import DriverNotificationsPage from "../app/notifications/page";
import DriverRidesPage from "../app/rides/page";

const SAFFRON_BRANDING: TenantBranding = {
  ...DEFAULT_TENANT_BRANDING,
  brandName: "Saffron Routes",
  riderLabel: "Guest",
  driverLabel: "Chauffeur",
  tripLabel: "Transfer",
};

function renderPage(component: ComponentType, branding?: TenantBranding): string {
  const page = createElement(component);
  return renderToStaticMarkup(
    branding
      ? createElement(TenantBrandingProvider, { branding, children: page })
      : page,
  );
}

describe("driver screens use the tenant nouns", () => {
  it("keeps the Velo wording when no tenant branding is present", () => {
    const trips = renderPage(DriverRidesPage);
    expect(trips).toContain("Your trip history");
    expect(trips).toContain("Follow active trips and review completed ones.");
    expect(trips).toContain('aria-label="Filter trips"');
    expect(trips).toContain('aria-label="Loading trips"');
  });

  it("rewrites the trip, rider and driver nouns for a white-label tenant", () => {
    const trips = renderPage(DriverRidesPage, SAFFRON_BRANDING);
    expect(trips).toContain("Your transfer history");
    expect(trips).toContain("Follow active transfers and review completed ones.");
    expect(trips).toContain('aria-label="Filter transfers"');
    expect(trips).toContain('aria-label="Loading transfers"');

    const notifications = renderPage(DriverNotificationsPage, SAFFRON_BRANDING);
    expect(notifications).toContain("Review transfer and payout updates in one place.");

    const account = renderPage(DriverAccountPage, SAFFRON_BRANDING);
    expect(account).toContain("Manage your chauffeur details and app preferences.");
  });
});
