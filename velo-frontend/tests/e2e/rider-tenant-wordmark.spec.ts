import { expect, test } from "./fixtures";

const tenantBrandName = process.env.PLAYWRIGHT_TENANT_BRAND_NAME ?? "Velo";
const tenantWordmark = tenantBrandName === "Velo" ? "VELO" : tenantBrandName;

async function captureBrandScreens(page: import("@playwright/test").Page, name: string): Promise<void> {
  for (const viewport of [
    { width: 390, height: 844, suffix: "390x844" },
    { width: 1440, height: 900, suffix: "1440x900" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.screenshot({ path: `test-results/ep3-wordmark/rider-${name}-${viewport.suffix}.png`, fullPage: true });
  }
}

test("rider auth and app bar show the tenant wordmark", async ({ baseURL, context, page }) => {
  await page.goto("/login");
  await expect(page.locator(".auth-tenant-wordmark")).toHaveText(tenantWordmark);
  await captureBrandScreens(page, "auth");

  const appBaseUrl = baseURL ?? "http://127.0.0.1:5502";
  await context.addCookies([
    { name: "velo_rider_token", value: "tenant-wordmark-rider", url: appBaseUrl },
    { name: "velo_rider_role_hint", value: "RIDER", url: appBaseUrl },
  ]);
  await page.route("**/api/backend/**", async (route) => {
    const url = route.request().url();
    const data = url.includes("active-ride") ? null : { content: [], number: 0, totalPages: 1, totalElements: 0, size: 10 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });

  await page.goto("/rides");
  await expect(page.locator(".rider-brand")).toHaveText(tenantWordmark);
  await captureBrandScreens(page, "shell");
});
