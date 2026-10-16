import { expect, test } from "./fixtures";
import { tenantLabels } from "./tenant-labels";
import type { Page } from "@playwright/test";

async function mockUnreadCount(page: Page): Promise<void> {
  await page.route("**/api/backend/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: 1 }),
    });
  });
}

function buildRideResponse(status: "CONFIRMED" | "ONGOING" | "ENDED") {
  const now = new Date();
  return {
    id: 911,
    rideStatus: status,
    paymentMethod: "WALLET",
    fare: 180,
    otp: "1234",
    createdTime: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    startedAt: status === "CONFIRMED" ? null : new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
    endedAt: status === "ENDED" ? now.toISOString() : null,
    pickupLocation: {
      type: "Point",
      coordinates: [77.5946, 12.9716],
    },
    dropOffLocation: {
      type: "Point",
      coordinates: [77.6401, 12.9352],
    },
    rider: {
      id: 41,
      user: {
        name: "Rider Demo",
        email: "rider.demo@velo.test",
      },
    },
  };
}

test("driver app redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/login?next=%2F");

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/login");
  expect(currentUrl.searchParams.get("next")).toBe("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("driver registration exposes labelled account and vehicle fields", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Apply to drive" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByLabel("Vehicle ID")).toBeVisible();
  await expect(page.getByLabel("Referral code (optional)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit application", exact: true })).toBeVisible();
});

test("driver navigation fits mobile and desktop layouts", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([{ name: "velo_driver_token", value: "e2e-driver-token", url: appBaseUrl }]);
  await mockUnreadCount(page);
  await page.route("**/api/backend/drivers/getMyProfile", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: 2, available: false } }) });
  });
  await page.route("**/api/backend/notifications?page=0&size=25", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [] } }) });
  });
  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=20", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [] } }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".driver-bottom-nav")).toBeVisible();
  await expect(page.locator(".driver-desktop-nav")).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".driver-desktop-nav")).toBeVisible();
  await expect(page.locator(".driver-bottom-nav")).toBeHidden();
});

test("driver logout clears ws session token and blocks protected routes", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([
    {
      name: "velo_driver_token",
      value: "e2e-driver-token",
      url: appBaseUrl,
    },
    {
      name: "velo_driver_role_hint",
      value: "DRIVER",
      url: appBaseUrl,
    },
  ]);

  await page.route("**/api/auth/ws-ticket", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ticket: "driver-logout-ticket" } }) });
  });
  await mockUnreadCount(page);
  await page.route("**/api/backend/drivers/getMyProfile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 2,
          vehicleId: "KA01AB1234",
          available: false,
        },
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
  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=20", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { content: [] } }),
    });
  });

  await page.goto("/");
  await Promise.all([
    page.waitForURL("**/me"),
    page.getByRole("link", { name: "Me", exact: true }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Switch to (dark|light) mode/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.waitForURL("**/login");

  await page.goto("/rides");
  await page.waitForURL("**/login?next=%2Frides");
});

test("driver home supports availability toggle and ride acceptance flow", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([
    {
      name: "velo_driver_token",
      value: "e2e-driver-token",
      url: appBaseUrl,
    },
  ]);

  await mockUnreadCount(page);

  let profileReads = 0;
  let acceptedRide = false;
  let rideStatus: "CONFIRMED" | "ONGOING" | "ENDED" = "CONFIRMED";

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

  await page.route("**/api/backend/drivers/ride-requests/311", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 311,
          rideRequestStatus: "PENDING",
          paymentMethod: "WALLET",
          pickupLocation: {
            type: "Point",
            coordinates: [77.5946, 12.9716],
          },
          dropOffLocation: {
            type: "Point",
            coordinates: [77.6401, 12.9352],
          },
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/acceptRide/311", async (route) => {
    acceptedRide = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: buildRideResponse("CONFIRMED"),
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

  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=20", async (route) => {
    const content = acceptedRide ? [buildRideResponse(rideStatus)] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content,
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
          content: [buildRideResponse(rideStatus)],
        },
      }),
    });
  });

  await page.route("**/api/backend/drivers/startRide/911", async (route) => {
    rideStatus = "ONGOING";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: buildRideResponse("ONGOING"),
      }),
    });
  });

  await page.route("**/api/backend/drivers/endRide/911", async (route) => {
    rideStatus = "ENDED";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: buildRideResponse("ENDED"),
      }),
    });
  });

  await page.route("**/api/backend/drivers/rateRider", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 41,
          rating: 5,
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: `Ready for your next ${tenantLabels.tripWord}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: `No active ${tenantLabels.tripWord}` })).toBeVisible();
  await page.getByRole("switch", { name: "Go online" }).click();
  await expect(page.getByText("You are now online.")).toBeVisible();

  await page.getByRole("button", { name: `Accept ${tenantLabels.tripWord}` }).click();
  await page.waitForURL("**/ride/911");

  await expect(page.getByRole("button", { name: `Start ${tenantLabels.tripWord}` })).toBeDisabled();
  await page.getByLabel(`4-digit ${tenantLabels.riderWord} OTP`).fill("1234");
  await expect(page.getByRole("button", { name: `Start ${tenantLabels.tripWord}` })).toBeEnabled();
  await page.getByRole("button", { name: `Start ${tenantLabels.tripWord}` }).click();
  await expect(page.getByText(`${tenantLabels.trip} started.`)).toBeVisible();
  await expect(page.getByText("Live map")).toBeVisible();

  await page.getByRole("button", { name: `Complete ${tenantLabels.tripWord}` }).click();
  await expect(page.getByText(`${tenantLabels.trip} completed. Please rate the ${tenantLabels.riderWord}.`)).toBeVisible();
  await page.getByRole("button", { name: "Submit rating" }).click();
  await expect(page.getByText(`${tenantLabels.rider} rating submitted.`)).toBeVisible();
});

test("driver home shows availability conflict errors", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([
    {
      name: "velo_driver_token",
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
  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=20", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { content: [] } }),
    });
  });

  await page.goto("/");
  await page.getByRole("switch", { name: "Go offline" }).click();

  await expect(
    page.getByText("Cannot go offline with active rides. Please complete or cancel active rides first."),
  ).toBeVisible();
});

test("driver can decline an offer without changing the notification read flow", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([{ name: "velo_driver_token", value: "e2e-driver-token", url: appBaseUrl }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await mockUnreadCount(page);

  let declined = false;
  await page.route("**/api/backend/drivers/getMyProfile", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: 2, available: true } }) });
  });
  await page.route("**/api/backend/notifications?page=0&size=25", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { content: declined ? [] : [{ id: 11, title: "New trip offer", message: "A trip is waiting.", type: "RIDE_REQUESTED", read: false, referenceId: 311, createdTime: new Date().toISOString() }] } }),
    });
  });
  await page.route("**/api/backend/drivers/ride-requests/311", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 311,
          rideRequestStatus: "PENDING",
          pickupAddress: "Kempegowda Airport, Terminal 1",
          dropOffAddress: "MG Road",
          fare: 70.32,
          expiresAt: new Date(Date.now() + 90_000).toISOString(),
          rider: { user: { name: "Henry Walsh" } },
          pickupLocation: { coordinates: [77.5946, 12.9716] },
        },
      }),
    });
  });
  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=20", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [] } }) });
  });
  await page.route("**/api/backend/notifications/11/read", async (route) => {
    declined = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: 11, read: true } }) });
  });

  await page.goto("/");
  const offer = page.locator(".driver-offer");
  await expect(offer.getByText("Henry")).toBeVisible();
  await expect(offer.getByText("Kempegowda Airport, Terminal 1")).toBeVisible();
  await expect(offer.getByText("MG Road")).toBeVisible();
  await expect(offer.getByText(/^Offer expires in/)).toBeVisible();

  const acceptButton = offer.getByRole("button", { name: /^Accept/ });
  const declineButton = offer.getByRole("button", { name: "Decline" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const acceptLabelFits = await acceptButton.locator(".ui-button-content").evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(acceptLabelFits).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(acceptButton).toBeInViewport();
  await expect(declineButton).toBeInViewport();
  const actions = await Promise.all([acceptButton, declineButton].map(async (button) => {
    const box = await button.boundingBox();
    return { bottom: (box?.y ?? Infinity) + (box?.height ?? 0) };
  }));
  const bottomNavigationTop = await page.locator(".driver-bottom-nav").evaluate((element) => element.getBoundingClientRect().top);
  expect(actions.every(({ bottom }) => bottom < bottomNavigationTop)).toBe(true);

  await declineButton.click();
  await expect(page.getByRole("status").getByText("Offer declined.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^No .* offers yet$/ })).toBeVisible();
  expect(declined).toBe(true);
});

test("driver trip history filters active and past trips", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([{ name: "velo_driver_token", value: "e2e-driver-token", url: appBaseUrl }]);
  await mockUnreadCount(page);
  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=10", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { content: [buildRideResponse("CONFIRMED"), { ...buildRideResponse("ENDED"), id: 810 }], number: 0, totalPages: 1 } }),
    });
  });

  await page.goto("/rides");
  await expect(page.getByRole("heading", { name: `Your ${tenantLabels.tripWord} history` })).toBeVisible();
  await expect(page.locator(".driver-trip-row").getByText(`${tenantLabels.trip} 911`)).toBeVisible();
  await page.getByRole("radio", { name: "Past, 1" }).click();
  await expect(page.locator(".driver-trip-row").getByText(`${tenantLabels.trip} 810`)).toBeVisible();
  await expect(page.locator(".driver-trip-row")).toHaveCount(1);
});

test("driver confirms trip cancellation before the existing cancel action runs", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([{ name: "velo_driver_token", value: "e2e-driver-token", url: appBaseUrl }]);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });
  await mockUnreadCount(page);

  let cancelled = false;
  await page.route("**/api/backend/drivers/getMyRides?pageOffset=0&pageSize=50", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [buildRideResponse("CONFIRMED")] } }) });
  });
  await page.route("**/api/backend/drivers/cancelRide/911", async (route) => {
    cancelled = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ...buildRideResponse("CONFIRMED"), rideStatus: "CANCELLED" } }) });
  });
  await page.route("**/api/backend/drivers/location", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/ride/911");
  const followButton = page.getByRole("button", { name: `Follow ${tenantLabels.driverWord}` });
  await expect(followButton).toBeEnabled();
  await expect(followButton).toHaveCSS("min-height", "44px");
  await followButton.click();
  await expect(page.getByRole("button", { name: "Stop following" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: `Cancel ${tenantLabels.tripWord}` }).click();
  const confirmation = page.getByRole("dialog", { name: `Cancel this ${tenantLabels.tripWord}?` });
  await expect(confirmation).toBeVisible();
  expect(cancelled).toBe(false);
  await confirmation.getByRole("button", { name: `Cancel ${tenantLabels.tripWord}` }).click();
  await expect(page.getByText(`${tenantLabels.trip} cancelled.`)).toBeVisible();
  expect(cancelled).toBe(true);
});

test("driver earnings and notifications flows show happy and failure states", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4103";
  await context.addCookies([
    {
      name: "velo_driver_token",
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
  await expect(page.getByRole("heading", { name: "Your earnings", exact: true, level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Request payout" }).first().click();
  const payoutSheet = page.getByRole("dialog", { name: "Request a payout" });
  await payoutSheet.getByLabel("Amount").fill("100");
  await payoutSheet.getByRole("button", { name: "Request payout" }).click();
  await expect(page.getByText("Payout request submitted.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Payout history" }).getByText("Pending").first()).toBeVisible();

  await page.goto("/notifications");
  await page.getByRole("button", { name: "Mark read" }).first().click();
  await expect(page.getByText("Notification marked as read.")).toBeVisible();
  expect(markReadCount).toBe(1);

  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("Unable to mark all notifications right now.")).toBeVisible();
});
