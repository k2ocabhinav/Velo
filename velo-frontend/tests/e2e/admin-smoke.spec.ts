import { expect, test } from "@playwright/test";

test("admin app redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/");

  await page.waitForURL("**/login?next=%2F");

  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/login");
  expect(currentUrl.searchParams.get("next")).toBe("/");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("admin payouts page supports action smoke flow", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:3000";
  await context.addCookies([
    {
      name: "velo_token",
      value: "e2e-admin-token",
      url: appBaseUrl
    }
  ]);

  let payoutsRequestCount = 0;
  let actionCount = 0;

  await page.route("**/api/proxy/api/v1/admin/payouts/pending*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    payoutsRequestCount += 1;
    const status = payoutsRequestCount === 1 ? "PENDING" : "APPROVED";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: [
          {
            id: 91,
            amount: 240.75,
            status,
            requestedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
          }
        ],
        totalPages: 1,
        number: 0
      })
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
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("APPROVED")).toBeVisible();
  expect(actionCount).toBe(1);
});

test("admin payouts page surfaces readable auth expiry errors", async ({ baseURL, context, page }) => {
  const appBaseUrl = baseURL ?? "http://127.0.0.1:3000";
  await context.addCookies([
    {
      name: "velo_token",
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
