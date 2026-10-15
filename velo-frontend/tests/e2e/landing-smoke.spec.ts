import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const whatsappDigits = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";
const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim() ?? "";
const contactAction = process.env.NEXT_PUBLIC_CONTACT_FORM_ACTION?.trim() ?? "";
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";

test("primary navigation, mobile menu and demo links have working targets", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });

  await expect(navigation.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
  await expect(navigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "#pricing");
  await expect(navigation.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "#faq");
  await expect(navigation.locator(".nav-cta a")).toHaveAttribute("href", "#book-a-demo");
  await expect(page.locator('#top a[href="#book-a-demo"]')).toHaveAttribute("href", "#book-a-demo");
  expect((await navigation.locator(".nav-cta a").boundingBox())?.height).toBeGreaterThanOrEqual(48);
  await expect(page.locator("#verify").getByRole("link", { name: "Open" })).toHaveCount(0);
  await expect(page.locator("#verify")).toContainText("Checks run");
  await expect(page.locator("#verify")).toContainText(/6 landing checks passed · checked \d{1,2} \w{3} \d{4}/);
  await expect(page.locator("#verify")).toContainText("Browser and accessibility checks");
  await expect(page.locator("#verify")).toContainText("Velo Business");
  await expect(page.locator("#verify")).toContainText("Saffron Routes");
  await expect(page.locator("#pricing")).toContainText("We’ll confirm the active-vehicle count and monthly minimum with you before a pilot.");

  const fullSizeLinks = page.getByRole("link", { name: /View full-size .*dispatch screen/ });
  await expect(fullSizeLinks).toHaveCount(1);
  await expect(fullSizeLinks).toHaveAttribute("href", "/screens/velo-business-dispatch.webp");
  expect((await fullSizeLinks.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const saffronChoice = page.getByRole("radio", { name: "Saffron Routes" });
  await saffronChoice.focus();
  await page.keyboard.press("Space");
  await expect(fullSizeLinks).toHaveAttribute("href", "/screens/saffron-routes-dispatch.webp");
  await expect(page.getByRole("img", { name: "Saffron Routes dispatch console demonstration" })).toBeVisible();

  const videoLink = demoVideoUrl
    ? page.locator("#top").getByRole("link", { name: "Watch the 2-minute demo" })
    : page.locator("#top").getByRole("link", { name: "See how it works" });
  await expect(videoLink).toHaveAttribute("href", demoVideoUrl || "#how-it-works");

  const whatsappLink = page.getByRole("link", { name: "WhatsApp the founder" });
  if (whatsappDigits) {
    await expect(whatsappLink).toHaveAttribute("href", `https://wa.me/${whatsappDigits}`);
  } else {
    await expect(whatsappLink).toHaveCount(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const secondaryHeroCta = page.locator("#top").getByRole("link", { name: "See how it works" });
  const secondaryHeroCtaBounds = await secondaryHeroCta.boundingBox();
  expect(secondaryHeroCtaBounds?.height).toBeGreaterThanOrEqual(44);
  const menuButton = navigation.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(navigation.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(navigation.getByRole("link", { name: "FAQ" })).toBeVisible();
  await expect(navigation.locator(".nav-mobile-cta")).toHaveAttribute("href", "#book-a-demo");
  expect((await navigation.locator(".nav-mobile-cta").boundingBox())?.height).toBeGreaterThanOrEqual(48);

  const findings = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(findings.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);

  await navigation.getByRole("link", { name: "FAQ" }).click();
  await expect(page).toHaveURL(/#faq$/);
  await expect(navigation.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute("aria-expanded", "false");
});

test("contact form appears only when a demo request destination is configured", async ({ page }) => {
  await page.goto("/");
  const form = page.locator('form[name="demo-request"]');

  if (!contactAction && !contactEmail) {
    await expect(form).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send demo request" })).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    if (whatsappDigits) {
      await expect(page.getByRole("link", { name: "WhatsApp the founder" })).toBeVisible();
    } else {
      await expect(page.locator("#book-a-demo")).toContainText("No details were sent or saved");
      await expect(page.locator("#book-a-demo")).toContainText("Demo contact isn’t available yet");
      await expect(page.locator("footer .footer-links-group").filter({ hasText: "Contact" })).toHaveCount(0);
    }
    return;
  }

  await expect(form.getByLabel("Your name")).toBeVisible();
  await expect(form.getByLabel("Phone or WhatsApp")).toHaveAttribute("required", "");
  await expect(form.getByLabel("Fleet size")).toHaveAttribute("required", "");
  await expect(form.getByLabel("City (optional)")).not.toHaveAttribute("required", "");
  await expect(form.getByLabel("Preferred time and time zone (optional)")).not.toHaveAttribute("required", "");
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
    await form.getByLabel("Your name").fill("Alex Morgan");
    await form.getByLabel("Phone or WhatsApp").fill("+1 555 010 1234");
    await form.getByLabel("Fleet size").selectOption({ label: "10–25 vehicles" });
    await form.getByLabel("City").fill("Dublin");
    await form.getByLabel("Preferred time and time zone").fill("09:00–12:00 UTC");
    await form.getByRole("button", { name: "Send demo request" }).click();
    await expect(page.getByRole("status")).toContainText("Your request was sent");
  } else {
    // The email is shown both in the contact section and the footer.
    await expect(page.locator(`a[href="mailto:${contactEmail}"]`).first()).toBeVisible();
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

test("production LCP is the hero h1 and CLS is zero", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics: { lcp: Array<{ tag: string | null; id: string | null }>; cls: number } = { lcp: [], cls: 0 };
    Object.defineProperty(window, "__landingMetrics", { value: metrics });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const element = (entry as LargestContentfulPaint).element;
        metrics.lcp.push({ tag: element?.tagName ?? null, id: element?.id ?? null });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/");
  await page.waitForTimeout(1500);
  const metrics = await page.evaluate(() => (window as Window & {
    __landingMetrics?: { lcp: Array<{ tag: string | null; id: string | null }>; cls: number };
  }).__landingMetrics ?? { lcp: [], cls: -1 });

  expect(metrics.lcp.length, "the browser should report an LCP entry").toBeGreaterThan(0);
  expect(metrics.lcp.at(-1)?.tag, "the last LCP element should be the hero heading").toBe("H1");
  expect(metrics.lcp.at(-1)?.id, "the LCP heading should be the hero h1").toBe("hero-title");
  expect(metrics.cls, "cumulative layout shift should be zero").toBe(0);
});
