import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const whatsappDigits = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim() ?? "";
const contactAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION?.trim() ?? "";

test("primary navigation, mobile menu and demo links have working targets", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });

  await expect(navigation.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
  await expect(navigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#pricing");
  await expect(navigation.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "#faq");
  await expect(navigation.getByRole("link", { name: "Book a demo" })).toHaveAttribute("href", "#contact");

  const videoLink = demoVideoUrl
    ? page.getByRole("link", { name: "Watch the 2-minute demo" })
    : page.getByRole("link", { name: "See how it works" });
  await expect(videoLink).toHaveAttribute("href", demoVideoUrl || "#how-it-works");

  const whatsappLink = page.getByRole("link", { name: "WhatsApp the founder" });
  if (whatsappDigits) {
    await expect(whatsappLink).toHaveAttribute("href", new RegExp(`^https://wa\\.me/${whatsappDigits}\\?`));
  } else {
    await expect(whatsappLink).toHaveCount(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const menuButton = navigation.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(navigation.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link", { name: "FAQ" })).toBeVisible();

  const findings = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(findings.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);

  await navigation.getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveURL(/#faq$/);
  await expect(navigation.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
});

test("contact form asks only for demo details and exposes the configured route", async ({ page }) => {
  await page.goto("/");
  const form = page.locator("form.contact-form");
  await expect(form.getByLabel("Name")).toBeVisible();
  await expect(form.getByLabel("Phone or WhatsApp")).toHaveAttribute("required", "");
  await expect(form.getByLabel("Fleet size")).toHaveAttribute("required", "");
  await expect(form.getByLabel("City")).toHaveAttribute("required", "");
  await expect(form.getByLabel("Preferred time")).toHaveAttribute("required", "");
  await expect(form.getByLabel("Email (optional)")).not.toHaveAttribute("required", "");
  await expect(form.getByLabel("Company")).toHaveCount(0);
  await expect(form.getByLabel("Message")).toHaveCount(0);

  if (contactAction) {
    await page.route("**/_velo/contact", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: "{}",
    }));
    await form.getByLabel("Name").fill("Alex Morgan");
    await form.getByLabel("Phone or WhatsApp").fill("+1 555 010 1234");
    await form.getByLabel("Fleet size").selectOption({ label: "10–25 vehicles" });
    await form.getByLabel("City").fill("Dublin");
    await form.getByLabel("Preferred time").fill("09:00–12:00 UTC");
    await form.getByRole("button", { name: "Book a demo" }).click();
    await expect(page.getByRole("status")).toContainText("demo request has been sent");
  } else {
    await expect(page.locator('a[href^="mailto:"]')).toContainText(/hello@velo\.dev/);
  }
});

test("privacy and terms pages are reachable", async ({ page }) => {
  await page.goto("/privacy/");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms/");

  await page.goto("/terms/");
  await expect(page.getByRole("heading", { name: "Terms", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
});

test("production largest contentful paint is the hero h1", async ({ page }) => {
  await page.addInitScript(() => {
    const entries: Array<{ tag: string | null; id: string | null }> = [];
    Object.defineProperty(window, "__landingLcp", { value: entries });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const element = (entry as LargestContentfulPaint).element;
        entries.push({ tag: element?.tagName ?? null, id: element?.id ?? null });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto("/");
  await page.waitForTimeout(1500);
  const entries = await page.evaluate(() => (window as Window & {
    __landingLcp?: Array<{ tag: string | null; id: string | null }>;
  }).__landingLcp ?? []);

  expect(entries.length, "the browser should report an LCP entry").toBeGreaterThan(0);
  expect(entries.at(-1)?.tag, "the last LCP element should be the hero heading").toBe("H1");
});
