import { expect, test, type Page } from "@playwright/test";

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

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
    await page.getByRole("button", { name: "Logout" }).click();

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

    await expect(page.getByRole("heading", { name: "Plan future trips" })).toBeVisible();
    await expect(page.getByText("No scheduled rides yet.")).toBeVisible();

    const scheduledTime = formatDateTimeLocal(new Date(Date.now() + 90 * 60 * 1000));
    await page.getByLabel("Scheduled time").fill(scheduledTime);
    await page.getByRole("button", { name: "Schedule ride" }).click();

    await expect(page.getByText("Ride scheduled successfully.")).toBeVisible();
    await expect(page.getByText("Ride #91")).toBeVisible();
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

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Request your next/i })).toBeVisible();

    // Verify booking map and selection controls are visible
    await expect(page.locator(".booking-map")).toBeVisible();
    await expect(page.getByRole("button", { name: "Set pickup" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Set drop-off" })).toBeVisible();
    const mapCanvas = page.locator(".booking-map .leaflet-container");
    await mapCanvas.click({ position: { x: 120, y: 110 } });
    await expect(page.getByLabel("Pickup latitude")).not.toHaveValue("");
    await expect(page.getByLabel("Pickup longitude")).not.toHaveValue("");
    await mapCanvas.click({ position: { x: 230, y: 170 } });
    await expect(page.getByLabel("Drop-off latitude")).not.toHaveValue("");
    await expect(page.getByLabel("Drop-off longitude")).not.toHaveValue("");

    // Manual inputs still work as fallback
    await page.getByText("Advanced coordinates").click();
    await page.getByLabel("Pickup latitude").fill("12.9716");
    await page.getByLabel("Pickup longitude").fill("77.5946");
    await page.getByLabel("Drop-off latitude").fill("12.9352");
    await page.getByLabel("Drop-off longitude").fill("77.6245");
    await expect(page.getByRole("button", { name: "Estimate to unlock request" })).toBeDisabled();
    await page.getByRole("button", { name: "Estimate fare" }).click();
    await expect(page.getByText("$210.00")).toBeVisible();

    await page.getByRole("button", { name: /Request (ride|trip)/i }).click();
    await expect(page.getByText(/requested\. We are now matching you with a nearby/i)).toBeVisible();
    await expect(page.getByText("Request #501").first()).toBeVisible();
    await expect(page.getByText(/Matching nearby/i)).toBeVisible();
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

    await page.goto("/rides");

    await expect(page.getByRole("heading", { name: "Your ride history" })).toBeVisible();
    await expect(page.getByText("Ride #55")).toBeVisible();
    await expect(page.getByText(/^Status: ONGOING$/)).toBeVisible();
    await expect(page.getByText("Ride #77")).toBeVisible();
    await expect(page.getByText(/^Status: ENDED$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel ride" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel ride" }).first().click();
    await expect(page.getByText("Ride #55 canceled.")).toBeVisible();
    await expect(page.getByText(/^Status: CANCELLED$/)).toBeVisible();

    const endedRideCard = page.locator("article.list-item").filter({ hasText: "Ride #77" });
    await endedRideCard.getByRole("button", { name: "Rate driver" }).click();
    await expect(page.getByText("Driver rated 5 stars for ride #77.")).toBeVisible();
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
    await expect(page.getByText("Live trip continuity")).toBeVisible();
    await expect(page.getByText("Ride #501 • Request #—")).toBeVisible();
    await expect(page.locator(".active-ride-map")).toBeVisible();

    activeRideVisible = false;
    await page.getByRole("button", { name: "Refresh now" }).click();
    await expect(page.getByText("No active trip right now.")).toBeVisible();
    await expect(page.getByText("Trip summary and rating")).toBeVisible();

    await page.getByRole("button", { name: "Submit rating" }).click();
    await expect(page.getByText("Rated ride #777 with 5 stars.")).toBeVisible();
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
    await expect(page.getByText("Live trip continuity")).toBeVisible();
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
