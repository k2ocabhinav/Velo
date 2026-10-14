import { expect, test } from "./fixtures";

test("rider creates and reviews a weekly trip template", async ({ baseURL, context, page }, testInfo) => {
  const riderBaseURL = baseURL ?? "http://127.0.0.1:5802";
  await context.addCookies([
    { name: "velo_rider_token", value: "e2e-rider-token", url: riderBaseURL },
    { name: "velo_rider_role_hint", value: "RIDER", url: riderBaseURL },
  ]);

  let created = false;
  await page.route("**/api/backend/notifications/unread-count", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) });
  });
  await page.route("**/api/backend/riders/active-ride", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
  });
  await page.route("**/api/backend/riders/scheduled-rides*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [] } }) });
  });
  await page.route("**/api/backend/riders/recurring-trip-templates*", async (route) => {
    if (route.request().method() === "POST") {
      created = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: 19 } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: created ? [
      { id: 19, daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], localTime: "09:00", startDate: "2026-10-16", endDate: "2026-11-15", pickupAddress: "Central Hotel", dropOffAddress: "Airport", paymentMethod: "WALLET", active: true },
    ] : [] } }) });
  });

  await page.goto("/scheduled");
  await expect(page.getByRole("heading", { name: "Repeat every week" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("rider-recurring-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("rider-recurring-390.png"), fullPage: true });

  const weeklySection = page.locator("section").filter({ hasText: "Repeat every week" }).first();
  await weeklySection.getByText("Enter pickup and drop-off coordinates").click();
  await weeklySection.getByLabel("Latitude for weekly pickup").fill("12.9716");
  await weeklySection.getByLabel("Longitude for weekly pickup").fill("77.5946");
  await weeklySection.getByLabel("Latitude for weekly destination").fill("12.9352");
  await weeklySection.getByLabel("Longitude for weekly destination").fill("77.6245");
  await weeklySection.getByLabel("Pickup address").fill("Central Hotel");
  await weeklySection.getByLabel("Drop-off address").fill("Airport");
  await weeklySection.getByRole("button", { name: "Create weekly trip" }).click();

  await expect(page.getByText("Weekly trip created.")).toBeVisible();
  await expect(page.getByText("Central Hotel → Airport")).toBeVisible();
});
