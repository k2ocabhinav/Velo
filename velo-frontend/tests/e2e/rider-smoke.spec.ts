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
  test("rider scheduled flow supports happy-path scheduling", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:3001";
    await context.addCookies([
      {
        name: "velo_token",
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

  test("rider booking supports fare estimate and request ride", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:3001";
    await context.addCookies([
      {
        name: "velo_token",
        value: "e2e-rider-token",
        url: riderBaseUrl,
      },
    ]);
    await mockUnreadCount(page);

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

    await page.route("**/api/backend/riders/requestRide", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: 501,
            rideRequestStatus: "PENDING",
            paymentMethod: "WALLET",
          },
        }),
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Request your next ride" })).toBeVisible();

    await page.getByRole("button", { name: "Estimate fare" }).click();
    await expect(page.getByText("$210.00")).toBeVisible();

    await page.getByRole("button", { name: "Request ride" }).click();
    await expect(page.getByText("Ride request created successfully.")).toBeVisible();
    await expect(page.getByText("Request #501")).toBeVisible();
  });

  test("rider ride history keeps active ride continuity and accepts rating API calls", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:3001";
    await context.addCookies([
      {
        name: "velo_token",
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

  test("rider session expiry redirects protected routes to login", async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/scheduled");
    await page.waitForURL("**/login?next=%2Fscheduled");

    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/login");
    expect(currentUrl.searchParams.get("next")).toBe("/scheduled");
  });

  test("rider pages surface readable backend errors", async ({ baseURL, context, page }) => {
    const riderBaseUrl = baseURL ?? "http://127.0.0.1:3001";
    await context.addCookies([
      {
        name: "velo_token",
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
