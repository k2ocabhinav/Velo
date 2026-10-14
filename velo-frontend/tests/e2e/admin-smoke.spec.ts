import { expect, test } from "@playwright/test";

test("admin app redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/");

  await page.waitForURL("**/login?next=%2F");

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/login");
  expect(currentUrl.searchParams.get("next")).toBe("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /register|create account/i })).toHaveCount(0);
});

test("admin logout clears session and re-blocks protected routes", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4101";
  await context.addCookies([
    {
      name: "velo_admin_token",
      value: "e2e-admin-token",
      url: appBaseUrl,
    },
    {
      name: "velo_admin_role_hint",
      value: "ADMIN",
      url: appBaseUrl,
    },
  ]);

  await page.route("**/api/proxy/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/stats/dashboard")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            totalUsers: 10,
            totalDrivers: 5,
            totalRides: 12,
            totalRevenue: 1000,
            activeRides: 2,
            pendingApprovals: 0,
            ridesByStatus: { CONFIRMED: 1, ONGOING: 1, COMPLETED: 8, CANCELLED: 2 },
            revenueByDay: {
              [new Date().toISOString().slice(0, 10)]: 220,
            },
          },
        }),
      });
      return;
    }

    if (url.includes("/stats/daily")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            date: new Date().toISOString().slice(0, 10),
            totalRides: 4,
            completedRides: 3,
            cancelledRides: 1,
            totalRevenue: 220,
            platformCommission: 40,
            totalUsers: 10,
            newUsers: 1,
            activeDrivers: 3,
            pendingDriverApprovals: 0,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          content: [],
          totalPages: 1,
          number: 0,
          totalElements: 0,
          size: 10,
        },
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await page.getByRole("button", { name: "Logout" }).click();

  await page.waitForURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

  await page.goto("/");
  await page.waitForURL("**/login?next=%2F");
});

test("admin payouts page supports action smoke flow", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4101";
  await context.addCookies([
    {
      name: "velo_admin_token",
      value: "e2e-admin-token",
      url: appBaseUrl
    }
  ]);
  page.on("dialog", (dialog) => dialog.accept());

  let payoutsRequestCount = 0;
  let actionCount = 0;

  await page.route("**/api/proxy/api/v1/admin/payouts/pending*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    payoutsRequestCount += 1;
    const body =
      payoutsRequestCount === 1
        ? {
            content: [
              {
                id: 91,
                amount: 240.75,
                status: "PENDING",
                requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
              }
            ],
            totalPages: 1,
            number: 0
          }
        : {
            content: [],
            totalPages: 1,
            number: 0
          };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });

  await page.route("**/api/proxy/api/v1/admin/payouts/91/approve", async (route) => {
    actionCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: 91,
          amount: 240.75,
          status: "APPROVED",
          requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        }
      })
    });
  });

  await page.goto("/payouts");

  await expect(page.getByRole("heading", { name: "Payouts" })).toBeVisible();
  await expect(page.getByText("Payout #91")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Approve", exact: true }).click();

  await expect(page.getByText("Payout approved.")).toBeVisible();
  await expect(page.getByText("No pending payouts found.")).toBeVisible();
  expect(actionCount).toBe(1);
});

test("admin payouts page surfaces readable auth expiry errors", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4101";
  await context.addCookies([
    {
      name: "velo_admin_token",
      value: "expired-admin-token",
      url: appBaseUrl
    }
  ]);

  await page.route("**/api/proxy/api/v1/admin/payouts/pending*", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Session expired. Please sign in again."
      })
    });
  });

  await page.goto("/payouts");

  await expect(page.getByText("Session expired. Please sign in again.")).toBeVisible();
});

test("admin users page toggles user active status", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4101";
  await context.addCookies([
    {
      name: "velo_admin_token",
      value: "e2e-admin-token",
      url: appBaseUrl
    }
  ]);

  let listRequestCount = 0;
  let deactivateCount = 0;
  page.on("dialog", (dialog) => dialog.accept());

  await page.route("**/api/proxy/api/v1/admin/users?page=0&size=10", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    listRequestCount += 1;
    const active = listRequestCount === 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: [
          {
            id: 101,
            firstName: "Eve",
            lastName: "Rider",
            email: "eve@example.com",
            active
          }
        ],
        number: 0,
        totalPages: 1,
        totalElements: 1,
        size: 10
      })
    });
  });

  await page.route("**/api/proxy/api/v1/admin/users/101/deactivate", async (route) => {
    deactivateCount += 1;
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/users");

  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByText("Active")).toBeVisible();

  await page.getByRole("button", { name: "Deactivate" }).click();

  await expect(page.getByText("Inactive")).toBeVisible();
  await expect(page.getByText("User deactivated.")).toBeVisible();
  expect(deactivateCount).toBe(1);
});

test("admin drivers page approves pending applications", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4101";
  await context.addCookies([
    {
      name: "velo_admin_token",
      value: "e2e-admin-token",
      url: appBaseUrl
    }
  ]);

  let listRequestCount = 0;
  let approveCount = 0;
  page.on("dialog", (dialog) => dialog.accept());

  await page.route("**/api/proxy/api/v1/admin/drivers?status=PENDING&page=0&size=10", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    listRequestCount += 1;
    const body =
      listRequestCount === 1
        ? {
            content: [
              {
                driverId: 77,
                userId: 88,
                name: "New Driver",
                email: "new.driver@example.com",
                phone: "9999999999",
                rating: 0.2,
                vehicleId: "KA09ZZ1234",
                appliedAt: new Date().toISOString()
              }
            ],
            number: 0,
            totalPages: 1,
            totalElements: 1,
            size: 10
          }
        : {
            content: [],
            number: 0,
            totalPages: 1,
            totalElements: 0,
            size: 10
          };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });

  await page.route("**/api/proxy/api/v1/admin/drivers/77/approve", async (route) => {
    approveCount += 1;
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/drivers");

  await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Approve", exact: true }).click();

  await expect(page.getByText("Driver approved.")).toBeVisible();
  await expect(page.getByText("No drivers found for this status.")).toBeVisible();
  expect(approveCount).toBe(1);
});

test("admin dispatch console supports offer visibility and assign action", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:4101";
  await context.addCookies([
    {
      name: "velo_admin_token",
      value: "e2e-admin-token",
      url: appBaseUrl,
    },
    {
      name: "velo_admin_role_hint",
      value: "ADMIN",
      url: appBaseUrl,
    },
  ]);

  let assignCount = 0;

  page.on("dialog", (dialog) => {
    if (dialog.type() !== "prompt") {
      dialog.accept();
      return;
    }

    if (/driver id/i.test(dialog.message())) {
      dialog.accept("12");
      return;
    }
    dialog.accept("Manual override from smoke test.");
  });

  await page.route("**/api/proxy/api/v1/admin/ops-health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        redisAvailable: true,
        cacheHits: 12,
        cacheMisses: 3,
        cacheErrors: 0,
        totalRides: 18,
        totalDrivers: 4,
        totalRiders: 9,
        pendingRideRequests: 1,
        dispatchQueueDepth: 2,
        expiredOfferCount: 0,
        updatedAt: new Date().toISOString(),
      }),
    });
  });

  await page.route("**/api/proxy/api/v1/admin/branding", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantId: 1,
        brandName: "Velo",
        primaryColor: "#2563eb",
        logoUrl: null,
        riderLabel: "Requester",
        driverLabel: "Driver",
        tripLabel: "Trip",
        dispatchMode: "RIDE_HAILING",
        riderPortalEnabled: true,
      }),
    });
  });

  await page.route("**/api/proxy/api/v1/admin/dispatch/requests?page=0&size=10", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const content =
      assignCount === 0
        ? [
            {
              rideRequestId: 311,
              riderId: 41,
              riderName: "Rider Demo",
              status: "PENDING",
              fare: 180,
              requestedTime: new Date().toISOString(),
              offeredDriverCount: 2,
            },
          ]
        : [];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content,
        number: 0,
        totalPages: 1,
        totalElements: content.length,
        size: 10,
      }),
    });
  });

  await page.route("**/api/proxy/api/v1/admin/dispatch/active-rides?page=0&size=10", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: [
          {
            rideId: 501,
            riderName: "Rider Demo",
            driverName: "Driver Demo",
            status: "ONGOING",
            createdTime: new Date().toISOString(),
            startedAt: new Date().toISOString(),
          },
        ],
        number: 0,
        totalPages: 1,
        totalElements: 1,
        size: 10,
      }),
    });
  });

  await page.route("**/api/proxy/api/v1/admin/dispatch/audit?page=0&size=10", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: [
          {
            id: 1,
            actionType: "ASSIGN_REQUEST",
            actorUserId: 41,
            rideRequestId: 311,
            reason: "Initial seeded assignment history entry.",
            createdAt: new Date().toISOString(),
          },
        ],
        number: 0,
        totalPages: 1,
        totalElements: 1,
        size: 10,
      }),
    });
  });

  await page.route("**/api/proxy/api/v1/admin/dispatch/requests/311/offers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          offerId: 12,
          driverId: 2,
          driverName: "Driver Two",
          status: "OFFERED",
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
        },
      ]),
    });
  });

  await page.route("**/api/proxy/api/v1/admin/dispatch/requests/311/assign", async (route) => {
    assignCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 810,
        rideStatus: "CONFIRMED",
        paymentMethod: "WALLET",
      }),
    });
  });

  await page.goto("/dispatch");

  await expect(page.getByRole("heading", { name: /Dispatch Console/i })).toBeVisible();
  await expect(page.locator(".list-item").filter({ hasText: "Request #311" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Show offers" }).click();
  await expect(page.getByText("#12 · Driver #2 (Driver Two)")).toBeVisible();

  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Trip request #311 assigned to driver #12.")).toBeVisible();
  expect(assignCount).toBe(1);
});
