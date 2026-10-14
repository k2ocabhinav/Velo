import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

function formatDateTimeLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function mockUnreadCount(page: Page): Promise<void> {
  await page.route("**/api/backend/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: 0 }),
    });
  });
}

async function mockRideHistory(
  page: Page,
  getRides: () => Array<Record<string, unknown>>,
): Promise<void> {
  await page.route("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10", async (route) => {
    const rides = getRides();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content: rides,
          number: 0,
          totalPages: 1,
          totalElements: rides.length,
          size: 10,
        },
      }),
    });
  });
}

test.describe("rider smoke", () => {
  test("rider login and registration expose labelled account fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel("Referral code (optional)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  });

  test("rider logout clears the session and blocks protected routes", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
      {
        name: "velo_rider_role_hint",
        value: "RIDER",
        url: riderBaseUrl,
      },
    ]);

    await mockUnreadCount(page);
    await page.route("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            content: [],
            number: 0,
            totalPages: 1,
            totalElements: 0,
            size: 10,
          },
        }),
      });
    });

    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Velo home" })).toContainText("VELO");
    await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Offers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Scheduled trips" })).toBeVisible();
    const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });
    await expect(mainNavigation.getByRole("link", { name: "Book" })).toBeVisible();
    await expect(mainNavigation.getByRole("link", { name: "Trips" })).toBeVisible();
    await expect(mainNavigation.getByRole("link", { name: "Wallet" })).toBeVisible();
    await expect(mainNavigation.getByRole("link", { name: "Me" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Sign out" }).click();

    await page.waitForURL("**/login");

    await page.goto("/scheduled");
    await page.waitForURL("**/login?next=%2Fscheduled");
  });

  test("rider scheduled flow supports happy-path scheduling", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);

    let hasScheduledRide = false;

    await page.route("**/api/backend/riders/scheduled-rides*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            content: hasScheduledRide
              ? [
                  {
                    id: 91,
                    scheduledTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
                    status: "SCHEDULED",
                    paymentMethod: "WALLET",
                  },
                ]
              : [],
          },
        }),
      });
    });

    await page.route("**/api/backend/riders/schedule-ride", async (route) => {
      hasScheduledRide = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: 91 } }),
      });
    });

    await page.goto("/scheduled");

    await expect(page.getByRole("heading", { name: "Scheduled trips", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No scheduled trips yet" })).toBeVisible();

    const scheduledTime = formatDateTimeLocal(new Date(Date.now() + 90 * 60 * 1000));
    await page.getByLabel("Scheduled time").fill(scheduledTime);
    await page.getByText("Enter coordinates").click();
    await page.getByLabel("Pickup latitude").fill("12.9716");
    await page.getByLabel("Pickup longitude").fill("77.5946");
    await page.getByLabel("Destination latitude").fill("12.9352");
    await page.getByLabel("Destination longitude").fill("77.6245");
    await page.getByRole("button", { name: "Schedule trip" }).click();

    await expect(page.getByText("Trip scheduled.")).toBeVisible();
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
  });

  test("rider booking supports fare estimate and request ride with map visible", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);
    await page.route("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            content: [],
            number: 0,
            totalPages: 1,
            totalElements: 0,
            size: 10,
          },
        }),
      });
    });

    await page.route("https://router.project-osrm.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 5200,
              duration: 960,
              geometry: {
                coordinates: [
                  [77.5946, 12.9716],
                  [77.61, 12.955],
                  [77.6245, 12.9352],
                ],
              },
            },
          ],
        }),
      });
    });

    await page.route("**/api/backend/riders/fare-estimate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            estimatedFare: 210,
            baseFare: 180,
            surgeMultiplier: 1.1,
            discountAmount: 15,
            distanceKm: 7.2,
            durationMinutes: 19,
          },
        }),
      });
    });

    const requestedRide = { id: 501, rideRequestStatus: "PENDING", paymentMethod: "WALLET" };
    let rideRequested = false;

    await page.route("**/api/backend/riders/current-request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: rideRequested ? requestedRide : null }),
      });
    });

    await page.route("**/api/backend/riders/requestRide", async (route) => {
      rideRequested = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: requestedRide }),
      });
    });

    await page.route("**/api/backend/riders/active-ride", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Plan a trip" })).toBeVisible();

    // Verify booking map and selection controls are visible
    await expect(page.locator(".booking-map")).toBeVisible();
    await expect(page.locator(".booking-sheet-launcher")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pickup", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Where to?", exact: true })).toBeVisible();
    const mapCanvas = page.locator(".booking-map .leaflet-container");
    await mapCanvas.click({ position: { x: 120, y: 110 } });
    await page.getByRole("button", { name: "Choose on map" }).nth(1).click();
    await mapCanvas.click({ position: { x: 230, y: 170 } });
    await page.getByText("Enter coordinates").click();
    await expect(page.getByLabel("Pickup latitude")).not.toHaveValue("");
    await expect(page.getByLabel("Pickup longitude")).not.toHaveValue("");
    await expect(page.getByLabel("Destination latitude")).not.toHaveValue("");
    await expect(page.getByLabel("Destination longitude")).not.toHaveValue("");

    // Manual inputs still work as fallback
    await page.getByLabel("Pickup latitude").fill("12.9716");
    await page.getByLabel("Pickup longitude").fill("77.5946");
    await page.getByLabel("Destination latitude").fill("12.9352");
    await page.getByLabel("Destination longitude").fill("77.6245");
    await expect(page.getByRole("button", { name: "Request trip" })).toBeDisabled();
    await page.getByRole("button", { name: "Estimate fare" }).click();
    await expect(page.getByText("$210.00")).toBeVisible();

    await page.getByRole("button", { name: "Request trip" }).click();
    await expect(page.getByText(/requested\. We are now matching you with a nearby/i)).toBeVisible();
    await expect(page.getByText("Matching you with a nearby driver", { exact: true })).toBeVisible();
    expect(rideRequested).toBe(true);
  });

  test("rider home hides the in-progress banner after a completed trip", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([{ name: "velo_rider_token", value: "e2e-rider-token", url: riderBaseUrl }]);
    await mockUnreadCount(page);
    await mockRideHistory(page, () => [{ id: 777, rideStatus: "ENDED", paymentMethod: "WALLET", fare: 205, endedAt: new Date().toISOString() }]);
    await page.route("**/api/backend/riders/current-request", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });
    await page.route("**/api/backend/riders/active-ride", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });

    const ridesLoaded = page.waitForResponse("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10");
    const requestLoaded = page.waitForResponse("**/api/backend/riders/current-request");
    await page.goto("/");
    await Promise.all([ridesLoaded, requestLoaded]);
    await expect(page.getByRole("button", { name: "Plan a trip" })).toBeVisible();
    await expect(page.locator(".trip-banner")).toHaveCount(0);
    await expect(page.getByText("Your trip is underway")).toHaveCount(0);
  });

  test("rider wallet adds, selects, and removes saved payment methods", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([{ name: "velo_rider_token", value: "e2e-rider-token", url: riderBaseUrl }]);
    await mockUnreadCount(page);

    await page.route("**/api/backend/riders/wallet*", async (route) => {
      const requestUrl = new URL(route.request().url());
      const pageIndex = Number(requestUrl.searchParams.get("page") ?? "0");
      const transaction = pageIndex === 0
        ? { id: 16, type: "DEBIT", amount: "18.00", method: "RIDE", rideReference: 810, timestamp: new Date().toISOString() }
        : { id: 17, type: "CREDIT", amount: "50.00", method: "BANKING", rideReference: 811, timestamp: new Date(Date.now() - 86_400_000).toISOString() };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            balance: "125.50",
            currency: "USD",
            transactions: { content: [transaction], number: pageIndex, size: 10, totalElements: 2, totalPages: 2 },
          },
        }),
      });
    });

    let methods = [
      { id: 4, type: "CARD", lastFourDigits: "1111", expiryDate: "10/28", isDefault: true },
    ];
    await page.route("**/api/backend/payment-methods", async (route) => {
      if (route.request().method() === "POST") {
        methods = [...methods, { id: 5, type: "CARD", lastFourDigits: "4242", expiryDate: "08/29", isDefault: false }];
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: methods }) });
    });
    await page.route("**/api/backend/payment-methods/5/default", async (route) => {
      methods = methods.map((method) => ({ ...method, isDefault: method.id === 5 }));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: methods[1] }) });
    });
    await page.route("**/api/backend/payment-methods/5", async (route) => {
      methods = methods.filter((method) => method.id !== 5);
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible();
    await expect(page.getByText("$125.50")).toBeVisible();
    await expect(page.getByText("Used from wallet")).toBeVisible();
    await expect(page.getByText("$18.00")).toBeVisible();
    await expect(page.getByText("Trip #810")).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Trip #811")).toBeVisible();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Add method" }).first().click();
    const addDialog = page.getByRole("dialog", { name: "Add payment method" });
    await addDialog.getByLabel("Last four digits").fill("4242");
    await addDialog.getByLabel("Expiry date").fill("08/29");
    await addDialog.getByRole("button", { name: "Add method" }).click();
    await expect(page.getByText("Ending in 4242")).toBeVisible();

    const addedMethod = page.locator(".payment-method-row").filter({ hasText: "Ending in 4242" });
    await addedMethod.getByRole("button", { name: "Set default" }).click();
    await expect(addedMethod.getByText("Default", { exact: true })).toBeVisible();

    await addedMethod.getByRole("button", { name: "Remove" }).click();
    const removeDialog = page.getByRole("dialog", { name: "Remove this payment method?" });
    await removeDialog.getByRole("button", { name: "Remove method" }).click();
    await expect(page.getByText("Ending in 4242")).toHaveCount(0);
  });

  test("rider wallet offers retry and explains an empty transaction history", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:5302";
    await context.addCookies([{ name: "velo_rider_token", value: "e2e-rider-token", url: riderBaseUrl }]);
    await mockUnreadCount(page);

    let walletRequestCount = 0;
    await page.route("**/api/backend/riders/wallet*", async (route) => {
      walletRequestCount += 1;
      if (walletRequestCount === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Wallet temporarily unavailable." } }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { balance: "0.00", currency: "USD", transactions: { content: [], number: 0, size: 10, totalElements: 0, totalPages: 1 } } }),
      });
    });
    await page.route("**/api/backend/payment-methods", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
    });

    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "Couldn't load wallet" })).toBeVisible();
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("$0.00")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No wallet transactions yet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No saved payment methods" })).toBeVisible();
    expect(walletRequestCount).toBe(2);
  });

  test("rider offers copy codes and notifications support read actions", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([{ name: "velo_rider_token", value: "e2e-rider-token", url: riderBaseUrl }]);
    await mockUnreadCount(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (text: string) => { window.sessionStorage.setItem("e2e-copied-code", text); } },
      });
    });

    await page.route("**/api/backend/promo-codes/active", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: 12, code: "RIDE15", discountType: "PERCENTAGE", discountValue: 15, active: true, currentUses: 2, maxUses: 20, description: "A saving on your next trip" }] }),
      });
    });
    await page.goto("/promos");
    await expect(page.getByRole("heading", { name: "Offers", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Copy code" }).click();
    await expect(page.getByText("Offer code copied.")).toBeVisible();
    expect(await page.evaluate(() => window.sessionStorage.getItem("e2e-copied-code"))).toBe("RIDE15");

    let notifications = [
      { id: 3, title: "Trip update", message: "Your driver accepted the request.", type: "RIDE_ACCEPTED", read: false, createdTime: new Date().toISOString() },
      { id: 4, title: "Payment update", message: "Your payment was received.", type: "PAYMENT_RECEIVED", read: false, createdTime: new Date(Date.now() - 60_000).toISOString() },
    ];
    await page.route("**/api/backend/notifications?page=0&size=25", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: notifications } }) });
    });
    await page.route("**/api/backend/notifications/3/read", async (route) => {
      notifications = notifications.map((item) => item.id === 3 ? { ...item, read: true } : item);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: notifications[0] }) });
    });
    await page.route("**/api/backend/notifications/read-all", async (route) => {
      notifications = notifications.map((item) => ({ ...item, read: true }));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    const firstNotification = page.locator(".notification-row").filter({ hasText: "Trip update" });
    await firstNotification.getByRole("button", { name: "Mark read" }).click();
    await expect(page.getByText("Notification marked as read.")).toBeVisible();
    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByText("All notifications marked as read.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  });

  test("rider ride history keeps active ride continuity and accepts rating API calls", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);

    let cancelledRide = false;
    let ratingCalled = false;

    await mockRideHistory(page, () => [
      {
        id: 55,
        rideStatus: cancelledRide ? "CANCELLED" : "ONGOING",
        paymentMethod: "WALLET",
        createdTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        endedAt: null,
        fare: 275,
      },
      {
        id: 77,
        rideStatus: "ENDED",
        paymentMethod: "CASH",
        createdTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        endedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        fare: 180,
      },
    ]);

    await page.route("**/api/backend/riders/cancelRide/55", async (route) => {
      cancelledRide = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: 55,
            rideStatus: "CANCELLED",
            paymentMethod: "WALLET",
          },
        }),
      });
    });

    await page.route("**/api/backend/riders/rateDriver", async (route) => {
      const payload = route.request().postDataJSON() as { rideId?: number; rating?: number };
      if (payload.rideId !== 77 || payload.rating !== 5) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unexpected rating payload." }),
        });
        return;
      }

      ratingCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: 9001,
            rating: 5,
          },
        }),
      });
    });
    await page.route("**/api/backend/riders/active-ride", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: null }) });
    });

    await page.goto("/rides");

    await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
    await expect(page.getByText("Trip in progress", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel trip" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel trip" }).click();
    const cancelDialog = page.getByRole("dialog", { name: "Cancel this trip?" });
    await cancelDialog.getByRole("button", { name: "Cancel trip" }).click();
    await expect(page.getByText("Trip cancelled.")).toBeVisible();

    await page.getByRole("radio", { name: "Past" }).click();
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    const endedRideCard = page.getByTestId("trip-row").last();
    await endedRideCard.getByRole("button", { name: "Rate driver" }).click();
    await expect(page.getByText("Thanks for your rating.")).toBeVisible();
    expect(ratingCalled).toBe(true);
  });

  test("rider active-trip page shows map continuity and rating fallback after completion", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);

    let activeRideVisible = true;
    let ratingSubmitted = false;

    await page.route("**/api/backend/riders/active-ride", async (route) => {
      const payload = activeRideVisible
        ? {
            data: {
              rideId: 501,
              status: "ONGOING",
              canCancel: false,
              pickupLocation: { type: "Point", coordinates: [77.5946, 12.9716] },
              dropOffLocation: { type: "Point", coordinates: [77.6245, 12.9352] },
              driver: { id: 31, name: "Driver One", vehicleId: "KA01AB1234" },
              lastDriverLocation: {
                lat: 12.9651,
                lng: 77.6022,
                speedKph: 30,
                capturedAt: new Date().toISOString(),
              },
            },
          }
        : {
            data: null,
          };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    await page.route("https://router.project-osrm.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 1200,
              duration: 480,
              geometry: {
                coordinates: [
                  [77.5946, 12.9716],
                  [77.61, 12.955],
                  [77.6245, 12.9352],
                ],
              },
            },
          ],
        }),
      });
    });

    await page.route("**/api/backend/riders/getMyRides?pageOffset=0&pageSize=10", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            content: activeRideVisible
              ? []
              : [
                  {
                    id: 777,
                    rideStatus: "ENDED",
                    paymentMethod: "WALLET",
                    endedAt: new Date().toISOString(),
                    fare: 205,
                  },
                ],
          },
        }),
      });
    });

    await page.route("**/api/backend/riders/rateDriver", async (route) => {
      ratingSubmitted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: 1 } }),
      });
    });

    await page.goto("/ride/active");
    await expect(page.getByRole("heading", { name: "Your trip", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your trip is in progress" })).toBeVisible();
    await expect(page.locator(".active-ride-map")).toBeVisible();
    const followButton = page.getByRole("button", { name: "Follow driver" });
    await expect(followButton).toHaveCSS("min-height", "44px");
    await page.getByRole("button", { name: "Follow driver" }).click();
    await expect(page.getByRole("button", { name: "Stop following" })).toHaveAttribute("aria-pressed", "true");

    activeRideVisible = false;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No active trip" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rate your last trip" })).toBeVisible();

    await page.getByRole("button", { name: "Submit rating" }).click();
    await expect(page.getByText("Thanks for rating your driver.")).toBeVisible();
    expect(ratingSubmitted).toBe(true);
  });

  test("rider booking/history/scheduled routes auto-redirect to active trip when in-flight ride exists", async ({
    baseURL,
    context,
    page,
  }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);

    await page.route("**/api/backend/riders/active-ride", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            rideId: 910,
            status: "CONFIRMED",
            canCancel: true,
            pickupLocation: { type: "Point", coordinates: [77.5946, 12.9716] },
            dropOffLocation: { type: "Point", coordinates: [77.6245, 12.9352] },
          },
        }),
      });
    });
    await page.route("**/api/backend/riders/scheduled-rides*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { content: [] } }),
      });
    });
    await page.route("https://router.project-osrm.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: "Ok",
          routes: [{ geometry: { coordinates: [[77.5946, 12.9716], [77.6245, 12.9352]] } }],
        }),
      });
    });

    await page.goto("/scheduled");
    await page.waitForURL("**/ride/active");
    await expect(page.getByRole("heading", { name: "Your trip", exact: true })).toBeVisible();
  });

  test("rider session expiry redirects protected routes to login", async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/scheduled");
    await page.waitForURL("**/login?next=%2Fscheduled");

    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/login");
    expect(currentUrl.searchParams.get("next")).toBe("/scheduled");
  });

  test("rider pages surface readable backend errors", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:4102";
    await context.addCookies([
      {
        name: "velo_rider_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);

    await page.route("**/api/backend/riders/scheduled-rides*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Service temporarily unavailable." }),
      });
    });

    await page.goto("/scheduled");
    await expect(page.getByText("Service temporarily unavailable.")).toBeVisible();
  });
});
