import { expect, test } from "./fixtures";
import { tenantLabels } from "./tenant-labels";
import type { BrowserContext } from "@playwright/test";

async function signInAsAdmin(context: BrowserContext, baseURL?: string): Promise<void> {
  await context.addCookies([
    { name: "velo_admin_token", value: "e2e-admin-token", url: baseURL ?? "http://127.0.0.1:4101" },
    { name: "velo_admin_role_hint", value: "ADMIN", url: baseURL ?? "http://127.0.0.1:4101" },
  ]);
}

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

test("admin account menu signs out and protected routes redirect again", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  await page.route("**/api/proxy/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/stats/dashboard")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { totalUsers: 10, totalDrivers: 5, totalRides: 12, totalRevenue: 1000, activeRides: 2, pendingApprovals: 0, ridesByStatus: {}, revenueByDay: {} } }) });
      return;
    }
    if (url.includes("/stats/daily")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { totalRides: 4, totalRevenue: 220 } }) });
      return;
    }
    if (url.includes("/ops-health")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { redisAvailable: true, cacheErrors: 0, dispatchQueueDepth: 0, expiredOfferCount: 0 } }) });
      return;
    }
    if (url.includes("/tenant/branding") || url.includes("/admin/branding")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { brandName: "Velo" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [], totalPages: 1, number: 0, totalElements: 0, size: 10 } }) });
  });

  await page.goto("/");
  const accountMenu = page.getByRole("button", { name: "Account menu" });
  await expect(accountMenu).toBeVisible();
  await accountMenu.click();
  await page.getByRole("menuitem", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await accountMenu.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await page.goto("/");
  await page.waitForURL("**/login?next=%2F");
});

test("admin payout review approves a request after confirmation", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  let approveCount = 0;
  await page.route("**/api/proxy/api/v1/admin/payouts/pending*", async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const content = approveCount === 0 ? [{ id: 91, amount: 240.75, status: "PENDING", requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() }] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content, totalPages: 1, number: 0, totalElements: content.length, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/payouts/91/approve", async (route) => {
    approveCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: 91, amount: 240.75, status: "APPROVED", requestedAt: new Date().toISOString() } }) });
  });

  await page.goto("/payouts");
  await expect(page.getByRole("heading", { name: "Payouts" })).toBeVisible();
  await expect(page.getByText("$240.75")).toBeVisible();
  await page.getByRole("button", { name: "Payout actions" }).click();
  await page.getByRole("menuitem", { name: "Approve payout" }).click();
  await page.getByRole("button", { name: "Approve payout" }).click();
  await expect(page.getByText("Payout approved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No pending payouts" })).toBeVisible();
  expect(approveCount).toBe(1);
});

test("admin payouts show a retryable error when the session expires", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  await page.route("**/api/proxy/api/v1/admin/payouts/pending*", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Session expired. Please sign in again." }) });
  });
  await page.goto("/payouts");
  await expect(page.getByText("Session expired. Please sign in again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("admin revenue shows top drivers and changes the date range", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  await page.route("**/api/proxy/api/v1/admin/branding", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { tenantId: 1, brandName: "Velo", primaryColor: "220 72% 50%", riderLabel: "Rider", driverLabel: "Driver", tripLabel: "Trip", dispatchMode: "RIDE_HAILING", riderPortalEnabled: true } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/stats/revenue**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith("/top-drivers")) {
      const days = requestUrl.searchParams.get("days");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ driverId: 5, driverName: days === "7" ? "Recent Driver" : "Revenue Driver", trips: 8, gross: 500, commission: 75, net: 425 }] }),
      });
      return;
    }
    const startDate = requestUrl.searchParams.get("startDate") ?? new Date().toISOString().slice(0, 10);
    const endDate = requestUrl.searchParams.get("endDate") ?? startDate;
    const dailyRows: Array<{ date: string; grossRevenue: number; platformCommission: number; driverEarnings: number; rideCount: number }> = [];
    const date = new Date(`${startDate}T00:00:00Z`);
    const lastDate = new Date(`${endDate}T00:00:00Z`);
    while (date <= lastDate) {
      dailyRows.push({ date: date.toISOString().slice(0, 10), grossRevenue: 500, platformCommission: 75, driverEarnings: 425, rideCount: 8 });
      date.setUTCDate(date.getUTCDate() + 1);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: dailyRows }),
    });
  });

  await page.goto("/revenue");
  await expect(page.getByRole("heading", { name: "Revenue", exact: true })).toBeVisible();
  const driversTable = page.getByRole("table", { name: `Top ${tenantLabels.driversWord} by net earnings` });
  await expect(driversTable).toBeVisible();
  const revenueDriverRow = driversTable.getByRole("row").filter({ hasText: "Revenue Driver" });
  await expect(revenueDriverRow).toContainText("8");
  await expect(revenueDriverRow).toContainText("$500.00");
  await expect(revenueDriverRow).toContainText("$75.00");
  await expect(revenueDriverRow).toContainText("$425.00");

  await page.getByLabel(`Top ${tenantLabels.driversWord} date range`).selectOption("7");
  await expect(page.getByText("Recent Driver")).toBeVisible();
});

test("admin users can be deactivated from a row action", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  let listCount = 0;
  let deactivateCount = 0;
  await page.route("**/api/proxy/api/v1/admin/users?page=0&size=10", async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    listCount += 1;
    const active = listCount === 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [{ id: 101, firstName: "Eve", lastName: "Rider", email: "eve@example.com", active, roles: ["RIDER"] }], number: 0, totalPages: 1, totalElements: 1, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/users/101/deactivate", async (route) => {
    deactivateCount += 1;
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/users");
  await expect(page.getByRole("heading", { name: tenantLabels.riders, exact: true })).toBeVisible();
  await expect(page.getByText("Active")).toBeVisible();
  await page.getByRole("button", { name: "Actions for Eve Rider" }).click();
  await page.getByRole("menuitem", { name: "Deactivate" }).click();
  await page.getByRole("button", { name: "Deactivate user" }).click();
  await expect(page.getByText("Inactive")).toBeVisible();
  await expect(page.getByText("Account deactivated.")).toBeVisible();
  expect(deactivateCount).toBe(1);
});

test("admin drivers can approve a pending application", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  let approveCount = 0;
  await page.route("**/api/proxy/api/v1/admin/drivers?status=PENDING*", async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const content = approveCount === 0 ? [{ driverId: 77, userId: 88, name: "New Driver", email: "new.driver@example.com", phone: "9999999999", rating: 4.8, vehicleId: "KA09ZZ1234", appliedAt: new Date().toISOString() }] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content, number: 0, totalPages: 1, totalElements: content.length, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/drivers?status=APPROVED*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [], number: 0, totalPages: 1, totalElements: 0, size: 1 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/drivers?status=SUSPENDED*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [], number: 0, totalPages: 1, totalElements: 0, size: 1 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/drivers/77/approve", async (route) => {
    approveCount += 1;
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/drivers");
  await expect(page.getByRole("heading", { name: tenantLabels.drivers })).toBeVisible();
  await page.getByRole("button", { name: `Approve ${tenantLabels.driverWord}` }).click();
  await expect(page.getByText(`${tenantLabels.driver} approved.`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "No applications to review" })).toBeVisible();
  expect(approveCount).toBe(1);
});

test("admin dispatch shows offers and assigns a pending request", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  let assignCount = 0;
  await page.route("**/api/proxy/api/v1/admin/branding", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { tenantId: 1, brandName: "Velo", primaryColor: "#2563eb", riderLabel: "Rider", driverLabel: "Driver", tripLabel: "Trip", dispatchMode: "RIDE_HAILING", riderPortalEnabled: true } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/requests?page=0&size=10", async (route) => {
    const content = assignCount === 0 ? [{ rideRequestId: 311, riderId: 41, riderName: "Rider Demo", pickupAddress: "Market Street", dropOffAddress: "Central Station", status: "PENDING", fare: 180, requestedTime: new Date().toISOString(), offeredDriverCount: 2 }] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content, number: 0, totalPages: 1, totalElements: content.length, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/active-rides?page=0&size=10", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [{ rideId: 501, riderName: "Rider Demo", driverName: "Driver Demo", status: "ONGOING", createdTime: new Date().toISOString(), startedAt: new Date().toISOString() }], number: 0, totalPages: 1, totalElements: 1, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/audit?page=0&size=10", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [{ id: 1, actionType: "ASSIGN_REQUEST", actorUserId: 41, rideRequestId: 311, reason: "Initial assignment" , createdAt: new Date().toISOString() }], number: 0, totalPages: 1, totalElements: 1, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/requests/311/offers", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ offerId: 12, driverId: 2, driverName: "Driver Two", status: "OFFERED", expiresAt: new Date(Date.now() + 30_000).toISOString() }] }) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/requests/311/assign", async (route) => {
    assignCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: 810, rideStatus: "CONFIRMED", paymentMethod: "WALLET" } }) });
  });

  await page.goto("/dispatch");
  await expect(page.getByRole("heading", { name: "Dispatch", exact: true })).toBeVisible();
  await expect(page.getByText("Market Street")).toBeVisible();
  await page.getByRole("button", { name: "Actions for Rider Demo" }).first().click();
  await page.getByRole("menuitem", { name: "Show offers" }).click();
  await expect(page.getByText("Driver Two")).toBeVisible();
  await page.getByRole("button", { name: "Actions for Rider Demo" }).first().click();
  await page.getByRole("menuitem", { name: "Assign driver" }).click();
  await page.getByLabel("Driver ID").fill("12");
  await page.getByLabel("Reason").fill("Manual override from smoke test.");
  await page.getByRole("button", { name: "Assign driver" }).last().click();
  await expect(page.getByText("Driver assigned.")).toBeVisible();
  expect(assignCount).toBe(1);
});

test("admin new trip selects address suggestions with the keyboard", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  await page.route("**/api/proxy/api/v1/admin/branding", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { tenantId: 1, brandName: "Velo", riderLabel: "Rider", driverLabel: "Driver", tripLabel: "Trip", riderPortalEnabled: true } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/dispatch/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/recent-addresses")
      ? [{ label: "12.95000,77.60000", lat: 12.95, lon: 77.6, type: "Recent pickup" }]
      : path.endsWith("/dispatch/live")
        ? { generatedAt: new Date().toISOString(), drivers: [], rides: [] }
        : { content: [], number: 0, totalPages: 1, totalElements: 0, size: 10 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  let searchCount = 0;
  await page.route("**/api/proxy/geo/search?**", async (route) => {
    searchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [{ label: "City Library, Bengaluru", lat: 12.9716, lon: 77.5946, type: "library" }] }),
    });
  });
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/H1sAAAAASUVORK5CYII=", "base64") });
  });

  await page.goto("/dispatch");
  await page.getByRole("button", { name: "New trip" }).click();
  const sheet = page.getByRole("dialog", { name: "New trip" });
  const pickupInput = sheet.getByRole("combobox", { name: "Pickup address" });
  await pickupInput.focus();
  const recentPlaces = sheet.getByRole("listbox", { name: "Pickup address places" });
  await expect(recentPlaces).toContainText("Recent pickup");
  await pickupInput.fill("City Library");
  expect(searchCount).toBe(0);
  await sheet.locator(".address-search").first().getByRole("button", { name: "Search" }).click();
  const options = sheet.getByRole("listbox", { name: "Pickup address places" });
  await expect(options).toBeVisible();
  await pickupInput.press("ArrowDown");
  await pickupInput.press("Enter");
  await expect(pickupInput).toHaveValue("City Library, Bengaluru");
  await sheet.getByText("Enter coordinates", { exact: true }).click();
  await expect(sheet.getByLabel("Pickup latitude")).toHaveValue("12.9716");
  expect(searchCount).toBe(1);
});

test("admin rejects a driver application with a recorded reason", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  let rejected = false;
  let rejectionReason = "";
  await page.route("**/api/proxy/api/v1/admin/drivers?status=PENDING*", async (route) => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const content = rejected ? [] : [{ driverId: 78, userId: 89, name: "Mira Driver", email: "mira@example.com", phone: "9999999999", rating: 4.9, vehicleId: "KA10AA1234", appliedAt: new Date().toISOString() }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content, number: 0, totalPages: 1, totalElements: content.length, size: 10 } }) });
  });
  for (const status of ["APPROVED", "SUSPENDED"]) {
    await page.route(`**/api/proxy/api/v1/admin/drivers?status=${status}*`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: [], number: 0, totalPages: 1, totalElements: 0, size: 10 } }) });
    });
  }
  await page.route("**/api/proxy/api/v1/admin/drivers/78/reject", async (route) => {
    rejected = true;
    rejectionReason = route.request().postData() ?? "";
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/drivers");
  await expect(page.getByText("Mira Driver")).toBeVisible();
  await page.getByRole("button", { name: "Actions for Mira Driver" }).click();
  await page.getByRole("menuitem", { name: "Reject" }).click();
  const rejectSheet = page.getByRole("dialog", { name: "Reject application" });
  await rejectSheet.getByLabel("Reason").fill("Application documents could not be verified.");
  await rejectSheet.getByRole("button", { name: "Continue to confirmation" }).click();
  await page.getByRole("dialog", { name: `Reject ${tenantLabels.driverWord} application?` }).getByRole("button", { name: "Reject application" }).click();
  await expect(page.getByText(`${tenantLabels.driver} application rejected.`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "No applications to review" })).toBeVisible();
  expect(rejected).toBe(true);
  expect(rejectionReason).toBe("Application documents could not be verified.");
});

test("admin rejects a pending payout and processes an approved payout", async ({ baseURL, context, page }) => {
  await signInAsAdmin(context, baseURL);
  const payouts = [
    { id: 91, amount: 140.25, status: "PENDING", requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    { id: 92, amount: 260.5, status: "APPROVED", requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
  ];
  let rejected = false;
  let processed = false;
  await page.route("**/api/proxy/api/v1/admin/payouts/pending*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { content: payouts, totalPages: 1, number: 0, totalElements: payouts.length, size: 10 } }) });
  });
  await page.route("**/api/proxy/api/v1/admin/payouts/91/reject", async (route) => {
    rejected = true;
    payouts[0].status = "REJECTED";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payouts[0] }) });
  });
  await page.route("**/api/proxy/api/v1/admin/payouts/92/process", async (route) => {
    processed = true;
    payouts[1].status = "PROCESSED";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payouts[1] }) });
  });

  await page.goto("/payouts");
  const pendingRow = page.getByRole("row").filter({ hasText: "$140.25" });
  await pendingRow.getByRole("button", { name: "Payout actions" }).click();
  await page.getByRole("menuitem", { name: "Reject payout" }).click();
  await page.getByRole("dialog", { name: "Reject payout?" }).getByRole("button", { name: "Reject payout" }).click();
  await expect(page.getByText("Payout rejected.")).toBeVisible();
  await expect(pendingRow.getByText("Rejected")).toBeVisible();

  const approvedRow = page.getByRole("row").filter({ hasText: "$260.50" });
  await approvedRow.getByRole("button", { name: "Payout actions" }).click();
  await page.getByRole("menuitem", { name: "Process payout" }).click();
  await page.getByRole("dialog", { name: "Process payout?" }).getByRole("button", { name: "Process payout" }).click();
  await expect(page.getByText("Payout processed.")).toBeVisible();
  await expect(approvedRow.getByText("Processed")).toBeVisible();
  expect(rejected).toBe(true);
  expect(processed).toBe(true);
});
