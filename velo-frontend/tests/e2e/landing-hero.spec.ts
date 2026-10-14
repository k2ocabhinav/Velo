import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing dispatch hero", () => {
  test("keeps the SVG fallback complete and supports keyboard trip selection", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?dispatch=svg");

    const illustration = page.getByRole("group", { name: "Interactive sample dispatch" });
    await expect(illustration).toHaveAttribute("data-renderer", "svg");
    await expect(illustration.locator("[data-dispatch-fallback='true']")).toBeVisible();
    await expect(illustration).toContainText("Grand Hotel to Business park");
    await expect(illustration).toContainText("On trip");

    const map = illustration.locator("[data-dispatch-fallback='true']");
    const mapBounds = await map.boundingBox();
    const docketBounds = await illustration.locator("article").boundingBox();
    expect(mapBounds?.width).toBeGreaterThanOrEqual(330);
    expect(mapBounds?.width).toBeLessThanOrEqual(350);
    expect(mapBounds?.height).toBe(200);
    expect(docketBounds?.y).toBeGreaterThanOrEqual((mapBounds?.y ?? 0) + (mapBounds?.height ?? 0));
    for (const button of await illustration.getByRole("button", { name: /^(05:40|09:15|18:30)$/ }).all()) {
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }

    const airportTrip = illustration.getByRole("button", { name: "05:40" });
    await airportTrip.focus();
    await page.keyboard.press("Enter");
    await expect(illustration).toContainText("Airport to Grand Hotel");
    await expect(illustration).toContainText("Completed");

    const hotelTrip = illustration.getByRole("button", { name: "09:15" });
    await hotelTrip.focus();
    await page.keyboard.press("Enter");
    await expect(hotelTrip).toHaveAttribute("aria-pressed", "true");
    await expect(illustration).toContainText("Grand Hotel to Business park");
    await expect(illustration).toContainText("Sofia Duarte");

    await illustration.getByRole("button", { name: "Preview dispatch" }).click();
    await expect(illustration.getByRole("button", { name: "Pause preview" })).toBeVisible();
    await illustration.getByRole("button", { name: "Pause preview" }).click();
    await expect(illustration.getByRole("button", { name: "Resume preview" })).toBeVisible();
    await illustration.getByRole("button", { name: "Resume preview" }).click();
    await expect(illustration.getByRole("button", { name: "Replay preview" })).toBeVisible({ timeout: 5_000 });
    await illustration.getByRole("button", { name: "Replay preview" }).click();
    await expect(illustration.getByRole("button", { name: "Pause preview" })).toBeVisible();

    const axe = await new AxeBuilder({ page }).include('[aria-label="Interactive sample dispatch"]').analyze();
    expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  });

  test("settles without frames and switches to SVG when reduced motion is enabled", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const illustration = page.getByRole("group", { name: "Interactive sample dispatch" });
    const canvas = illustration.locator('canvas[data-webgl-ready="true"]');
    const rendered = await canvas.waitFor({ state: "attached", timeout: 12_000 }).then(() => true).catch(() => false);
    test.skip(!rendered, "This browser does not provide eligible WebGL 2 with the major-performance-caveat guard.");

    await expect(illustration).toHaveAttribute("data-webgl-ready", "true");
    await page.waitForTimeout(500);
    const settledCount = await page.evaluate(() => (
      window as Window & { __VELO_DISPATCH_DEBUG__?: { frames: number } }
    ).__VELO_DISPATCH_DEBUG__?.frames ?? -1);
    expect(settledCount).toBeGreaterThan(0);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (
      window as Window & { __VELO_DISPATCH_DEBUG__?: { frames: number } }
    ).__VELO_DISPATCH_DEBUG__?.frames ?? -2)).toBe(settledCount);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(illustration).toHaveAttribute("data-renderer", "svg");
    await expect(illustration).toHaveAttribute("data-webgl-ready", "false");
    await expect(illustration.locator("canvas")).toHaveCount(0);
    await expect(illustration.locator("[data-dispatch-fallback='true']")).toBeVisible();
  });

  test("theme toggle switches data-theme, persists across reload, and passes axe in both themes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "night");

    const nightAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(nightAxe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

    const toDay = page.getByRole("button", { name: "Switch to day view" });
    await toDay.focus();
    await page.keyboard.press("Enter");

    await expect(html).toHaveAttribute("data-theme", "day");
    await expect(page.getByRole("button", { name: "Switch to night view" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("velo-theme"))).toBe("day");

    const dayAxe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(dayAxe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
    await expect(page.getByRole("button", { name: "Switch to night view" })).toBeVisible();
  });
});
