import { expect, test } from "@playwright/test";

test("landing footer follows the demo portal ports", async ({ baseURL, page }) => {
  const landingPort = Number(new URL(baseURL ?? "http://127.0.0.1:4100").port);
  const footer = page.locator("footer");

  await page.goto("/");

  await expect(footer.getByRole("link", { name: "Admin" }))
    .toHaveAttribute("href", `http://localhost:${landingPort + 1}`);
  await expect(footer.getByRole("link", { name: "Rider" }))
    .toHaveAttribute("href", `http://localhost:${landingPort + 2}`);
  await expect(footer.getByRole("link", { name: "Driver" }))
    .toHaveAttribute("href", `http://localhost:${landingPort + 3}`);
});
