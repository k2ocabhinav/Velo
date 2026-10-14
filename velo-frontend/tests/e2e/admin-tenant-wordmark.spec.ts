import { expect, test } from "./fixtures";
import tenantBranding from "./tenant-branding.json";

const tenantBrandName = tenantBranding.brandName;
const tenantWordmark = tenantBrandName === "Velo" ? "VELO" : tenantBrandName;

async function captureBrandScreens(page: import("@playwright/test").Page, name: string): Promise<void> {
  for (const viewport of [
    { width: 390, height: 844, suffix: "390x844" },
    { width: 1440, height: 900, suffix: "1440x900" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.screenshot({ path: `test-results/ep3-wordmark/admin-${name}-${viewport.suffix}.png`, fullPage: true });
  }
}

test("admin auth and sidebar show the tenant wordmark", async ({ baseURL, context, page }) => {
  await page.goto("/login");
  await expect(page.locator(".auth-tenant-wordmark")).toHaveText(tenantWordmark);
  await captureBrandScreens(page, "auth");

  const appBaseUrl = baseURL ?? "http://127.0.0.1:5501";
  await context.addCookies([
    { name: "velo_admin_token", value: "tenant-wordmark-admin", url: appBaseUrl },
    { name: "velo_admin_role_hint", value: "ADMIN", url: appBaseUrl },
  ]);
  await page.route("**/api/proxy/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { content: [], number: 0, totalPages: 1, totalElements: 0, size: 10 } }),
    });
  });

  await page.goto("/users");
  await expect(page.locator(".admin-brand strong")).toHaveText(tenantWordmark);
  await captureBrandScreens(page, "shell");
});
