import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_BRANDING } from "@velo/app-core/tenant";
import { TenantBrandingProvider } from "@velo/ui/theme";
import PayoutsPage from "../app/(protected)/payouts/page";
import UsersPage from "../app/(protected)/users/page";
import DashboardPage from "../app/(protected)/page";
import DispatchPage from "../app/(protected)/dispatch/page";
import DriversPage from "../app/(protected)/drivers/page";
import PromoCodesPage from "../app/(protected)/promo-codes/page";
import RevenuePage from "../app/(protected)/revenue/page";
import ScheduledRidesPage from "../app/(protected)/scheduled-rides/page";
import BrandingPage from "../app/(protected)/branding/page";

describe("admin data page loading states", () => {
  it.each([
    ["dashboard", DashboardPage, "Loading dashboard"],
    ["dispatch", DispatchPage, "Loading pending requests"],
    ["drivers", DriversPage, "Loading drivers"],
    ["users", UsersPage, "Loading users"],
    ["payouts", PayoutsPage, "Loading payouts"],
    ["promo codes", PromoCodesPage, "Loading promo codes"],
    ["revenue", RevenuePage, "Loading revenue"],
    ["scheduled rides", ScheduledRidesPage, "Loading scheduled rides"],
    ["branding", BrandingPage, "Loading branding settings"],
  ] as const)("renders an accessible skeleton while %s loads", (_page, Component, label) => {
    const markup = renderToStaticMarkup(
      createElement(TenantBrandingProvider, { branding: DEFAULT_TENANT_BRANDING, children: createElement(Component) }),
    );

    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("motion-safe:animate-pulse");
  });
});
