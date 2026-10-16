import { expect, test } from "./fixtures";
import { tenantLabels } from "./tenant-labels";

const REQUEST_ID = 77;
const REQUESTED_TIME = new Date().toISOString();

function pendingRequest(expiresAt: string) {
  return {
    id: REQUEST_ID,
    rideRequestStatus: "PENDING",
    paymentMethod: "WALLET",
    requestedTime: REQUESTED_TIME,
    expiresAt,
  };
}

function pendingTracking() {
  return {
    rideId: null,
    rideRequestId: REQUEST_ID,
    status: "PENDING",
    canCancel: true,
    pickupLocation: { type: "Point", coordinates: [77.5946, 12.9716] },
    dropOffLocation: { type: "Point", coordinates: [77.6245, 12.9352] },
  };
}

async function signInAsRider(context: import("@playwright/test").BrowserContext, riderBaseURL: string) {
  await context.addCookies([
    { name: "velo_rider_token", value: "e2e-rider-token", url: riderBaseURL },
    { name: "velo_rider_role_hint", value: "RIDER", url: riderBaseURL },
  ]);
}

test.describe("rider pending request cancellation", () => {
  test("cancels a pending request from the home banner", async ({ baseURL, context, page }) => {
    const riderBaseURL = baseURL ?? "http://127.0.0.1:4102";
    await signInAsRider(context, riderBaseURL);

    let cancelled = false;
    const expiresAt = new Date(Date.now() + 90_000).toISOString();

    await page.route("**/api/backend/notifications/unread-count", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) });
    });
    await page.route("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { content: [], number: 0, totalPages: 0, totalElements: 0, size: 10 } }),
      });
    });
    await page.route("**/api/backend/riders/active-ride", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });
    await page.route("**/api/backend/riders/current-request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: cancelled ? null : pendingRequest(expiresAt) }),
      });
    });
    await page.route(`**/api/backend/riders/cancel-request/${REQUEST_ID}`, async (route) => {
      cancelled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: REQUEST_ID, rideRequestStatus: "CANCELLED" } }),
      });
    });

    await page.goto("/");

    await expect(page.locator(".trip-banner")).toBeVisible();
    await expect(page.getByText(/^Matching you with a nearby /)).toBeVisible();
    const cancelRequest = page.getByRole("button", { name: `Cancel ${tenantLabels.trip} request` });
    await expect(cancelRequest).toBeVisible();

    await cancelRequest.click();
    const dialog = page.getByRole("dialog", { name: `Cancel this ${tenantLabels.trip} request?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: `Cancel ${tenantLabels.trip} request` }).click();

    expect(cancelled).toBe(true);
    await expect(page.getByText(`${tenantLabels.trip} request cancelled.`)).toBeVisible();
    await expect(page.getByText(/^Matching you with a nearby /)).toHaveCount(0);
  });

  test("cancels a pending request from the active trip page", async ({ baseURL, context, page }) => {
    const riderBaseURL = baseURL ?? "http://127.0.0.1:4102";
    await signInAsRider(context, riderBaseURL);

    let cancelled = false;

    await page.route("**/api/backend/notifications/unread-count", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: 0 }) });
    });
    await page.route("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { content: [], number: 0, totalPages: 0, totalElements: 0, size: 10 } }),
      });
    });
    await page.route("**/api/backend/riders/current-request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: cancelled ? null : pendingRequest(new Date(Date.now() + 90_000).toISOString()) }),
      });
    });
    await page.route("**/api/backend/riders/active-ride", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: cancelled ? null : pendingTracking() }),
      });
    });
    await page.route(`**/api/backend/riders/cancel-request/${REQUEST_ID}`, async (route) => {
      cancelled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: REQUEST_ID, rideRequestStatus: "CANCELLED" } }),
      });
    });

    await page.goto("/ride/active");

    const cancelRequest = page.getByRole("button", { name: `Cancel ${tenantLabels.trip} request` });
    await expect(cancelRequest).toBeVisible();
    await cancelRequest.click();

    const dialog = page.getByRole("dialog", { name: `Cancel this ${tenantLabels.trip} request?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: `Cancel ${tenantLabels.trip} request` }).click();

    expect(cancelled).toBe(true);
    await expect(page.getByRole("heading", { name: `No active ${tenantLabels.tripWord}` })).toBeVisible();
  });
});
