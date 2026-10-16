import { expect, test } from "./fixtures";
import { tenantLabels } from "./tenant-labels";
import type { BrowserContext, Page } from "@playwright/test";

async function signInAsAdmin(context: BrowserContext, baseURL?: string): Promise<void> {
  await context.addCookies([
    { name: "velo_admin_token", value: "e2e-admin-token", url: baseURL ?? "http://127.0.0.1:5801" },
    { name: "velo_admin_role_hint", value: "ADMIN", url: baseURL ?? "http://127.0.0.1:5801" },
  ]);
}

function tomorrowDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function mockAdminApi(page: Page, options?: { templates?: Array<Record<string, unknown>>; onCreate?: (payload: Record<string, unknown>) => void; onTripReason?: (payload: Record<string, unknown>) => void }): Promise<void> {
  let createdTemplate: Record<string, unknown> | null = null;
  await page.route("**/api/proxy/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname.replace("/api/proxy/", "");
    if (path.endsWith("/trip-sheet/attention/count")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 1 }) });
      return;
    }
    if (path.endsWith("/trip-sheet/export")) {
      await route.fulfill({ status: 200, contentType: "text/csv", body: "date,time,booking reference\r\n" });
      return;
    }
    if (path.endsWith("/trip-sheet/31/cancel") && route.request().method() === "POST") {
      options?.onTripReason?.(JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
      return;
    }
    if (path.endsWith("/trip-sheet")) {
      const date = requestUrl.searchParams.get("date") ?? tomorrowDate();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [
        { rideRequestId: 31, scheduledTime: `${date}T09:15:00Z`, bookingReference: "HOTEL-31", riderName: "Asha Patel", pickupAddress: "Central Hotel", dropOffAddress: "Airport", assigned: false, needsAttention: true, status: "SCHEDULED" },
        { rideRequestId: 32, scheduledTime: `${date}T10:20:00Z`, bookingReference: "BIZ-32", riderName: "Ravi Rao", pickupAddress: "Business Park", dropOffAddress: "Station", assigned: true, driverName: "Kiran Das", needsAttention: false, status: "CONFIRMED" },
      ] }) });
      return;
    }
    if (path.endsWith("/recurring-trip-templates/riders")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ riderId: 12, name: "Asha Patel", email: "asha@example.com" }] }) });
      return;
    }
    if (path.endsWith("/recurring-trip-templates") && route.request().method() === "POST") {
      options?.onCreate?.(JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>);
      createdTemplate = { id: 8, riderId: 12, riderName: "Asha Patel", daysOfWeek: ["MONDAY"], localTime: "09:00", startDate: tomorrowDate(), endDate: tomorrowDate(), pickupAddress: "Central Hotel", dropOffAddress: "Airport", bookingReference: "HOTEL-31", active: true };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: createdTemplate }) });
      return;
    }
    if (path.endsWith("/recurring-trip-templates")) {
      const content = options?.templates ?? (createdTemplate ? [createdTemplate] : []);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content, number: 0, size: 50, totalElements: content.length, totalPages: 1 } }) });
      return;
    }
    if (path.endsWith("/admin/promo-codes")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [], number: 0, size: 10, totalElements: 0, totalPages: 1 } }) });
  });
}

test("admin trip sheet filters scheduled rides and downloads CSV", async ({ baseURL, context, page }, testInfo) => {
  await signInAsAdmin(context, baseURL);
  await mockAdminApi(page);

  await page.goto("/trip-sheet");
  await expect(page.getByRole("heading", { name: `${tenantLabels.trip} sheet`, exact: true })).toBeVisible();
  const tripTable = page.locator(".trip-sheet-desktop-table");
  await expect(tripTable.getByText("Central Hotel")).toBeVisible();
  await expect(tripTable.getByText(`Needs a ${tenantLabels.driverWord}`)).toBeVisible();
  await expect(tripTable.getByText("Kiran Das")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("trip-sheet-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".trip-sheet-mobile-card")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("trip-sheet-390.png"), fullPage: true });

  const downloadPromise = page.waitForEvent("download");
  const tripSheetDate = await page.getByLabel("Trip sheet date").inputValue();
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${tenantLabels.tripWord}-sheet-${tripSheetDate}.csv`);
  await expect(page.getByLabel("Trip sheet date")).toHaveValue(tripSheetDate);
  await page.setViewportSize({ width: 1440, height: 900 });

  let reasonPayload: Record<string, unknown> | null = null;
  await page.route("**/api/proxy/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/proxy/", "");
    if (path.endsWith("/trip-sheet/31/cancel") && route.request().method() === "POST") {
      reasonPayload = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
      return;
    }
    await route.fallback();
  });
  const firstTrip = page.locator(".trip-sheet-desktop-table").getByRole("row", { name: /HOTEL-31/ });
  await firstTrip.getByRole("button", { name: "Actions for Asha Patel" }).click();
  await page.getByRole("menuitem", { name: "Cancel scheduled trip" }).click();
  await page.getByLabel("Reason note (optional)").fill("Guest changed arrival time");
  await page.getByRole("button", { name: `Cancel scheduled ${tenantLabels.tripWord}` }).click();
  await expect(page.getByText(`Scheduled ${tenantLabels.tripWord} cancelled.`)).toBeVisible();
  expect(reasonPayload).toEqual({ reasonCode: "OPERATOR_CANCELLED", note: "Guest changed arrival time" });
});

test("admin creates a weekly recurring trip template", async ({ baseURL, context, page }, testInfo) => {
  await signInAsAdmin(context, baseURL);
  let createdPayload: Record<string, unknown> | null = null;
  await mockAdminApi(page, { onCreate: (payload) => { createdPayload = payload; } });

  await page.goto("/recurring-trips");
  await expect(page.getByRole("heading", { name: `Recurring ${tenantLabels.tripsWord}`, exact: true })).toBeVisible();
  await page.getByLabel(tenantLabels.rider).selectOption("12");
  await page.getByText("Enter pickup and drop-off coordinates").click();
  await page.getByLabel("Pickup latitude").fill("12.9716");
  await page.getByLabel("Pickup longitude").fill("77.5946");
  await page.getByLabel("Drop-off latitude").fill("12.9352");
  await page.getByLabel("Drop-off longitude").fill("77.6245");
  await page.getByLabel("Pickup address").fill("Central Hotel");
  await page.getByLabel("Drop-off address").fill("Airport");
  await page.getByLabel("Booking reference").fill("HOTEL-31");
  await page.getByRole("button", { name: `Create weekly ${tenantLabels.tripWord}` }).click();

  await expect(page.getByText(`Weekly ${tenantLabels.tripWord} template created.`)).toBeVisible();
  expect(createdPayload).toMatchObject({
    riderId: 12,
    daysOfWeek: expect.arrayContaining(["MONDAY"]),
    paymentMethod: "WALLET",
    bookingReference: "HOTEL-31",
    pickupLocation: { coordinates: [77.5946, 12.9716] },
  });
  await page.screenshot({ path: testInfo.outputPath("recurring-trips-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".recurring-trip-mobile-card")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("recurring-trips-390.png"), fullPage: true });
});
