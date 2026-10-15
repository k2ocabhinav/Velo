import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_BRANDING, type TenantBranding } from "@velo/app-core/tenant";
import { TenantBrandingProvider } from "@velo/ui/theme";
import RiderAccountPage from "../app/account/page";
import RiderPromosPage from "../app/promos/page";

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

describe("rider screens use the tenant nouns", () => {
  it("keeps the Velo wording when no tenant branding is present", () => {
    expect(renderPage(RiderPromosPage)).toContain("Save an offer and apply it when you book your next trip.");
    expect(renderPage(RiderAccountPage)).toContain("Find a code for your next trip");
  });

  it("rewrites the trip and driver nouns for a white-label tenant", () => {
    expect(renderPage(RiderPromosPage, SAFFRON_BRANDING)).toContain(
      "Save an offer and apply it when you book your next transfer.",
    );

    const account = renderPage(RiderAccountPage, SAFFRON_BRANDING);
    expect(account).toContain("Manage your preferences and saved transfer options.");
    expect(account).toContain("Find a code for your next transfer");
    expect(account).toContain("Scheduled transfers");
    expect(account).toContain("Plan or update a future transfer");
  });
});
