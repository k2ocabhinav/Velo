import { expect, test } from "@playwright/test";

const tenantBrandName = process.env.PLAYWRIGHT_TENANT_BRAND_NAME ?? "Velo Business";
const tenantPrimaryHsl = process.env.PLAYWRIGHT_TENANT_PRIMARY_HSL ?? "224.3 100% 55.1%";

async function assertTenantTheme(page: import("@playwright/test").Page) {
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-tenant-brand-name", tenantBrandName);
  const inlinePrimary = await html.evaluate((element) => element.style.getPropertyValue("--color-primary").trim());
  expect(inlinePrimary).toBe(tenantPrimaryHsl);
}

test("rider login and home render the server-resolved tenant theme", async ({ baseURL, context, page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await assertTenantTheme(page);

  for (const viewport of [
    { width: 390, height: 844, suffix: "390x844" },
    { width: 1440, height: 900, suffix: "1440x900" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.screenshot({ path: `test-results/ui6-screenshots/rider-login-${viewport.suffix}.png`, fullPage: true });
  }

  const riderBaseUrl = baseURL ?? "http://127.0.0.1:5202";
  await context.addCookies([
    { name: "velo_rider_token", value: "ui6-theme-session", url: riderBaseUrl },
    { name: "velo_rider_role_hint", value: "RIDER", url: riderBaseUrl },
  ]);
  await page.route("**/api/auth/ws-ticket", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ticket: "ui6-e2e-ticket" } }) });
  });
  await page.route("**/api/proxy/api/v1/tenant/branding", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { brandName: tenantBrandName, primaryColor: "#0057B8", riderLabel: "Passenger", driverLabel: "Courier", tripLabel: "Journey", riderPortalEnabled: true } }) });
  });
  await page.route("**/api/backend/**", async (route) => {
    const url = route.request().url();
    const data = url.includes("getMyRides") ? { content: [], number: 0, totalPages: 1, totalElements: 0, size: 10 } : url.includes("unread-count") ? 0 : null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.goto("/");
  await expect(page.locator("main.booking-page")).toBeVisible();
  await expect(page.getByText("Loading map...", { exact: true })).toBeHidden({ timeout: 10_000 });
  await assertTenantTheme(page);

  for (const viewport of [
    { width: 390, height: 844, suffix: "390x844" },
    { width: 1440, height: 900, suffix: "1440x900" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.screenshot({ path: `test-results/ui6-screenshots/rider-home-${viewport.suffix}.png`, fullPage: true });
  }
});
