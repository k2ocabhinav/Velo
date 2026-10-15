import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "./fixtures";

const shotsDirectory = "/private/tmp/claude-501/velo-wt/out/sim-p2/shots";

function recent(secondsAgo: number): string {
  const date = new Date(Date.now() - secondsAgo * 1_000);
  const part = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
}

const snapshot = {
  generatedAt: recent(0),
  drivers: [
    { driverId: 11, name: "Arjun Rao", vehiclePlate: "KA01SV1001", rating: 4.9, status: "AVAILABLE", lat: 12.9716, lng: 77.5946, heading: 85, speedKph: 26, locationUpdatedAt: recent(4), stale: false, simulated: true, rideId: null },
    { driverId: 12, name: "Meera Iyer", vehiclePlate: "KA01SV1002", rating: 4.8, status: "AVAILABLE", lat: 12.9791, lng: 77.5913, heading: 12, speedKph: 0, locationUpdatedAt: recent(305), stale: true, simulated: true, rideId: null },
    { driverId: 13, name: "Kabir Shah", vehiclePlate: "KA01SV1003", rating: 4.7, status: "EN_ROUTE_TO_PICKUP", lat: 12.9698, lng: 77.6017, heading: 196, speedKph: 32, locationUpdatedAt: recent(10), stale: false, simulated: true, rideId: 102 },
    { driverId: 14, name: "Nikhil Menon", vehiclePlate: "KA01SV1004", rating: 4.9, status: "ON_TRIP", lat: 12.962, lng: 77.584, heading: 260, speedKph: 22, locationUpdatedAt: recent(6), stale: false, simulated: false, rideId: 103 },
    { driverId: 15, name: "Sana Qureshi", vehiclePlate: "KA01SV1005", rating: 4.8, status: "ON_TRIP", lat: 12.991, lng: 77.603, heading: 42, speedKph: 28, locationUpdatedAt: recent(18), stale: false, simulated: true, rideId: 103 },
    { driverId: 16, name: "Rohit Kulkarni", vehiclePlate: "KA01SV1006", rating: 4.6, status: "AVAILABLE", lat: 12.954, lng: 77.612, heading: 145, speedKph: 18, locationUpdatedAt: recent(20), stale: false, simulated: false, rideId: null },
    { driverId: 17, name: "Imran Sheikh", vehiclePlate: "KA03SS2001", rating: 4.9, status: "EN_ROUTE_TO_PICKUP", lat: 12.984, lng: 77.571, heading: 315, speedKph: 35, locationUpdatedAt: recent(8), stale: false, simulated: false, rideId: 102 },
    { driverId: 18, name: "Lakshmi Prasad", vehiclePlate: "KA03SS2002", rating: 4.7, status: "AVAILABLE", lat: 12.966, lng: 77.577, heading: 5, speedKph: 12, locationUpdatedAt: recent(45), stale: false, simulated: false, rideId: null },
  ],
  rides: [
    { rideId: null, rideRequestId: 201, status: "REQUESTED", riderName: "Aisha Khan", driverId: null, pickup: { lat: 12.9352, lng: 77.6245, address: "Koramangala Social" }, dropOff: { lat: 12.9756, lng: 77.605, address: "MG Road" }, requestedAt: recent(40), startedAt: null, fare: 420, simulated: false },
    { rideId: 102, rideRequestId: 202, status: "CONFIRMED", riderName: "Daniel Brooks", driverId: 13, pickup: { lat: 12.971, lng: 77.599, address: "Church Street" }, dropOff: { lat: 12.978, lng: 77.591, address: "Brigade Gateway" }, requestedAt: recent(180), startedAt: null, fare: 260, simulated: true },
    { rideId: 103, rideRequestId: 203, status: "ONGOING", riderName: "Priya Nair", driverId: 14, pickup: { lat: 12.962, lng: 77.584, address: "Cubbon Park" }, dropOff: { lat: 12.991, lng: 77.603, address: "Indiranagar" }, requestedAt: recent(520), startedAt: recent(310), fare: 690, simulated: true },
  ],
};

const pageOf = { content: [], number: 0, totalPages: 1, totalElements: 0, size: 10 };
const envelope = (data: unknown) => ({ data, error: "", statusCode: 200 });

async function waitForMapTiles(page: Page): Promise<void> {
  await expect.poll(async () => page.locator(".leaflet-tile-pane img.leaflet-tile").evaluateAll((tiles) => (
    tiles.length > 0 && tiles.every((tile) => {
      const image = tile as HTMLImageElement;
      return image.complete
        && image.naturalWidth > 0
        && image.classList.contains("leaflet-tile-loaded")
        && Number.parseFloat(getComputedStyle(image).opacity) >= 0.98;
    })
  )), { timeout: 20_000, message: "visible map tiles finish loading before the capture" }).toBe(true);
}

test("admin dispatch shows a live fleet map, supports row focus, and remains polished across themes and widths", async ({ baseURL, context, page }) => {
  const consoleErrors: string[] = [];
  const resourceFailures: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) resourceFailures.push(`${response.status()} ${response.url()}`);
  });
  await context.addCookies([
    { name: "velo_admin_token", value: "live-fleet-admin", url: baseURL ?? "http://127.0.0.1:4101" },
    { name: "velo_admin_role_hint", value: "ADMIN", url: baseURL ?? "http://127.0.0.1:4101" },
  ]);
  await page.route("**/api/proxy/**", async (route) => {
    const pathName = new URL(route.request().url()).pathname;
    let data: unknown = pageOf;
    if (pathName.endsWith("/promo-codes")) data = [];
    else if (pathName.endsWith("/attention/count")) data = 0;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(data)) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/live", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(snapshot)) });
  });
  await page.route("**/api/proxy/api/v1/admin/branding", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope({ tenantId: 1, brandName: "Velo Business", primaryColor: "224 100% 55%", riderLabel: "Passenger", driverLabel: "Courier", tripLabel: "Journey", currency: "USD", dispatchMode: "RIDE_HAILING", riderPortalEnabled: true })),
    });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/**", async (route) => {
    const pathName = new URL(route.request().url()).pathname;
    const data = pathName.endsWith("/dispatch/live") ? snapshot : pageOf;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(data)) });
  });
  await page.goto("/dispatch");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("heading", { name: "Live fleet Couriers" })).toBeVisible();
  await expect(page.getByTestId("fleet-driver-marker")).toHaveCount(8);
  await expect(page.getByTestId("fleet-request-marker")).toHaveCount(1);
  await expect(page.getByText("Includes 4 simulated drivers")).toBeVisible();
  const fleetPanel = page.getByRole("complementary", { name: "Fleet status and open trips" });
  await expect(fleetPanel.getByRole("button", { name: /Meera Iyer/ })).toContainText("Stale");
  await expect(page.getByTestId("fleet-count-available")).toContainText("4");
  await expect(page.getByTestId("fleet-count-to-pickup")).toContainText("2");
  await expect(page.getByTestId("fleet-count-on-trip")).toContainText("2");
  await expect(page.getByTestId("fleet-count-waiting-requests")).toContainText("1");

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);

  await mkdir(shotsDirectory, { recursive: true });
  const fleetPanelScreenshot = page.locator("section[aria-labelledby='live-fleet-heading']");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Recenter fleet map" }).click();
  await waitForMapTiles(page);
  await fleetPanelScreenshot.screenshot({ path: path.join(shotsDirectory, "live-fleet-light-1440.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Recenter fleet map" }).click();
  await waitForMapTiles(page);
  await fleetPanelScreenshot.screenshot({ path: path.join(shotsDirectory, "live-fleet-light-390.png") });

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Recenter fleet map" }).click();
  await waitForMapTiles(page);
  await fleetPanelScreenshot.screenshot({ path: path.join(shotsDirectory, "live-fleet-dark-390.png") });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Recenter fleet map" }).click();
  await waitForMapTiles(page);
  await fleetPanelScreenshot.screenshot({ path: path.join(shotsDirectory, "live-fleet-dark-1440.png") });

  await fleetPanel.getByRole("button", { name: /Arjun Rao/ }).click();
  await expect(page.locator(".leaflet-popup-content")).toContainText("Arjun Rao");
  await expect(fleetPanel.getByRole("button", { name: /Arjun Rao/ })).toHaveAttribute("data-selected", "true");
  expect(consoleErrors).toEqual([]);
  expect(resourceFailures).toEqual([]);
});
