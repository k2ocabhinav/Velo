import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_BRANDING } from "@velo/app-core/tenant";
import { TenantBrandingProvider } from "@velo/ui/theme";
import DriverEarningsPage from "../app/earnings/page";

describe("driver earnings loading state", () => {
  it("renders summary, payout, and earning entry skeletons while data loads", () => {
    const markup = renderToStaticMarkup(
      createElement(TenantBrandingProvider, { branding: DEFAULT_TENANT_BRANDING, children: createElement(DriverEarningsPage) }),
    );

    expect(markup).toContain('aria-label="Loading earnings summary"');
    expect(markup).toContain('aria-label="Loading payout history"');
    expect(markup).toContain('aria-label="Loading earning entries"');
    expect(markup).toContain("motion-safe:animate-pulse");
  });
});
