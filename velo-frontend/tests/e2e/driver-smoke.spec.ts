import { expect, test, type Page } from "@playwright/test";

async function mockUnreadCount(page: Page): Promise<void> {
  await page.route("**/api/backend/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: 1 }),
    });
  });
}

test("driver app redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/login?next=%2F");

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/login");
  expect(currentUrl.searchParams.get("next")).toBe("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("driver home supports availability toggle and ride acceptance flow", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:3002";
  await context.addCookies([
    {
      name: "velo_token",
      value: "e2e-driver-token",
      url: appBaseUrl,
    },
  ]);

  await mockUnreadCount(page);

  let profileReads = 0;
  let acceptedRide = false;

  await page.route("**/api/backend/drivers/getMyProfile", async (route) => {
    profileReads += 1;
    const available = profileReads > 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 2,
          vehicleId: "KA01AB1234",
          available,
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/availability", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 2,
          vehicleId: "KA01AB1234",
          available: true,
        },
      }),
    });
  });

  await page.route("**/api/backend/notifications?page=0&size=25", async (route) => {
    const body = acceptedRide
      ? { data: { content: [] } }
      : {
          data: {
            content: [
              {
                id: 11,
                title: "New Ride Request",
                message: "A nearby rider is waiting for pickup.",
                type: "RIDE_REQUESTED",
                read: false,
                referenceId: 311,
                createdTime: new Date().toISOString(),
              },
            ],
          },
        };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/backend/drivers/acceptRide/311", async (route) => {
    acceptedRide = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 911,
          rideStatus: "CONFIRMED",
          paymentMethod: "WALLET",
          fair: 180,
          createdTime: new Date().toISOString(),
          otp: "1234",
        },
      }),
    });
  });

  await page.route("**/api/backend/notifications/11/read", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 11,
          read: true,
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=50", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content: [
            {
              id: 911,
              rideStatus: "CONFIRMED",
              paymentMethod: "WALLET",
              fair: 180,
              otp: "1234",
              createdTime: new Date().toISOString(),
              startedAt: null,
              endedAt: null,
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/startRide/911", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 911,
          rideStatus: "ONGOING",
          paymentMethod: "WALLET",
          fair: 180,
          otp: "1234",
          createdTime: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/endRide/911", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 911,
          rideStatus: "ENDED",
          paymentMethod: "WALLET",
          fair: 180,
          otp: "1234",
          createdTime: new Date().toISOString(),
          startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          endedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stay available and respond to rides quickly" })).toBeVisible();
  await page.getByRole("button", { name: "Go online" }).click();
  await expect(page.getByText("You are now online.")).toBeVisible();

  await page.getByRole("button", { name: "Accept" }).click();
  await page.waitForURL("**/ride/911");

  await page.getByPlaceholder("Enter 4-digit OTP").fill("1234");
  await page.getByRole("button", { name: "Start ride" }).click();
  await expect(page.getByText("Ride started.")).toBeVisible();

  await page.getByRole("button", { name: "End ride" }).click();
  await expect(page.getByText("Ride ended successfully.")).toBeVisible();
});

test("driver home shows availability conflict errors", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:3002";
  await context.addCookies([
    {
      name: "velo_token",
      value: "e2e-driver-token",
      url: appBaseUrl,
    },
  ]);

  await mockUnreadCount(page);

  await page.route("**/api/backend/drivers/getMyProfile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 2,
          vehicleId: "KA01AB1234",
          available: true,
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/availability", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Cannot go offline with active rides. Please complete or cancel active rides first.",
      }),
    });
  });

  await page.route("**/api/backend/notifications?page=0&size=25", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { content: [] } }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Go offline" }).click();

  await expect(
    page.getByText("Cannot go offline with active rides. Please complete or cancel active rides first."),
  ).toBeVisible();
});

test("driver earnings and notifications flows show happy and failure states", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:3002";
  await context.addCookies([
    {
      name: "velo_token",
      value: "e2e-driver-token",
      url: appBaseUrl,
    },
  ]);

  await mockUnreadCount(page);

  let payoutRequested = false;
  let markReadCount = 0;

  await page.route("**/api/backend/drivers/earnings/summary?period=DAILY", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          totalGross: 420,
          totalCommission: 84,
          totalNet: 336,
          rideCount: 6,
          period: "DAILY",
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/earnings/balance", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: 250 }),
    });
  });

  await page.route("**/api/backend/drivers/earnings?pageOffset=0&pageSize=8", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content: [
            {
              id: 1,
              rideId: 91,
              grossFare: 140,
              platformCommission: 28,
              netEarning: 112,
              createdTime: new Date().toISOString(),
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/earnings/payouts?pageOffset=0&pageSize=8", async (route) => {
    const payoutContent = payoutRequested
      ? [
          {
            id: 8,
            amount: 100,
            status: "PENDING",
            requestedAt: new Date().toISOString(),
          },
        ]
      : [];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content: payoutContent,
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/earnings/payout?amount=100", async (route) => {
    payoutRequested = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 8,
          amount: 100,
          status: "PENDING",
          requestedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route("**/api/backend/notifications?page=0&size=25", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content: [
            {
              id: 51,
              title: "Ride ended",
              message: "Ride #911 ended successfully.",
              type: "RIDE_ENDED",
              read: false,
              createdTime: new Date().toISOString(),
            },
            {
              id: 52,
              title: "Payout pending",
              message: "Your payout request is under review.",
              type: "PAYMENT_PROCESSED",
              read: false,
              createdTime: new Date().toISOString(),
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/backend/notifications/51/read", async (route) => {
    markReadCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 51,
          read: true,
        },
      }),
    });
  });

  await page.route("**/api/backend/notifications/read-all", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Unable to mark all notifications right now.",
      }),
    });
  });

  await page.goto("/earnings");
  await expect(page.getByRole("heading", { name: "Track earnings and request payouts" })).toBeVisible();

  await page.getByPlaceholder("100.00").fill("100");
  await page.getByRole("button", { name: "Request payout" }).click();
  await expect(page.getByText("Payout request submitted.")).toBeVisible();
  await expect(page.getByText("Payout #8")).toBeVisible();

  await page.goto("/notifications");
  await page.getByRole("button", { name: "Mark read" }).first().click();
  await expect(page.getByText("Marked notification #51 as read.")).toBeVisible();
  expect(markReadCount).toBe(1);

  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("Unable to mark all notifications right now.")).toBeVisible();
});
