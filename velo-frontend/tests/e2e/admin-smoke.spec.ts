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
