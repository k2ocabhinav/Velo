import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";

export { expect };

const SETTLE_STYLE_ID = "velo-a11y-settle";
const SETTLE_ATTRIBUTE = "data-velo-a11y-settled";

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    type AxeFinding = { url: string; id: string; impact: string; summary: string };
    const audits: Array<Promise<AxeFinding[]>> = [];
    const auditByUrl = new Map<string, Promise<AxeFinding[]>>();

    // Page-transition and reveal animations render content at partial opacity, so a
    // snapshot taken mid-animation reports colours blended towards the backdrop as
    // contrast failures that do not exist once the page settles. Give the entrance
    // motion a moment to finish, then pin whatever is still mid-fade to its end state
    // for the duration of the audit: a CSS override outranks the inline opacity the
    // animation keeps writing, so the measurement no longer depends on how fast the
    // runner schedules animation frames. Fully transparent elements are left alone
    // (they are not on screen yet), and map tiles are IMGs with their own fade.
    const settleEntranceMotion = async (): Promise<void> => {
      const midFadeInPage = () => {
        const midFade = (element: HTMLElement) => {
          const value = Number.parseFloat(element.style.opacity || "1");
          if (!Number.isFinite(value) || value <= 0 || value >= 1 || element.tagName === "IMG") return false;
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
        };
        return !Array.from(document.querySelectorAll<HTMLElement>("[style*='opacity']")).some(midFade);
      };
      // Best effort: settling must never turn a passing test into a failing one.
      await page
        .waitForFunction(midFadeInPage, undefined, { timeout: 1_500, polling: 100 })
        .catch(() => undefined);
      if (page.isClosed()) return;
      await page
        .evaluate(({ styleId, attribute }) => {
          const midFade = (element: HTMLElement) => {
            const value = Number.parseFloat(element.style.opacity || "1");
            if (!Number.isFinite(value) || value <= 0 || value >= 1 || element.tagName === "IMG") return false;
            const box = element.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
          };
          document.getElementById(styleId)?.remove();
          document.querySelectorAll(`[${attribute}]`).forEach((element) => element.removeAttribute(attribute));
          const faded = Array.from(document.querySelectorAll<HTMLElement>("[style*='opacity']")).filter(midFade);
          faded.forEach((element) => element.setAttribute(attribute, ""));
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `[${attribute}] { opacity: 1 !important; }
            *, *::before, *::after { transition: none !important; animation: none !important; }`;
          document.head.append(style);
        }, { styleId: SETTLE_STYLE_ID, attribute: SETTLE_ATTRIBUTE })
        .catch(() => undefined);
    };

    const releaseEntranceMotion = async (): Promise<void> => {
      if (page.isClosed()) return;
      await page
        .evaluate(
          ({ styleId, attribute }) => {
            document.getElementById(styleId)?.remove();
            document.querySelectorAll(`[${attribute}]`).forEach((element) => element.removeAttribute(attribute));
          },
          { styleId: SETTLE_STYLE_ID, attribute: SETTLE_ATTRIBUTE },
        )
        .catch(() => undefined);
    };

    const auditCurrentDocument = async (): Promise<AxeFinding[]> => {
      if (page.isClosed()) return [];
      const visitedUrl = page.url();
      const previous = auditByUrl.get(visitedUrl);
      if (previous) return previous;

      const audit = (async () => {
        await page.waitForTimeout(450);
        if (page.isClosed() || page.url() !== visitedUrl) return [];
        let results;
        try {
          await settleEntranceMotion();
          if (page.isClosed() || page.url() !== visitedUrl) return [];
          try {
            results = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
              .analyze();
          } finally {
            await releaseEntranceMotion();
          }
        } catch (error) {
          // A user-triggered navigation can replace the document while axe is
          // evaluating it. The destination's load event schedules its own audit.
          const message = error instanceof Error ? error.message : String(error);
          if (
            page.isClosed()
            || page.url() !== visitedUrl
            || /execution context was destroyed|cannot find context|frame was detached/i.test(message)
          ) return [];
          throw error;
        }
        return results.violations
          .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
          .flatMap((violation) => violation.nodes.map((node) => ({
            url: visitedUrl,
            id: violation.id,
            impact: violation.impact ?? "unknown",
            summary: `${node.target.join(", ")}: ${node.failureSummary ?? violation.help}`,
          })));
      })();
      auditByUrl.set(visitedUrl, audit);
      audits.push(audit);
      return audit;
    };

    // Audit full-document navigations initiated by controls, while keeping
    // each page.goto call blocked until its audit completes.
    page.on("load", () => { void auditCurrentDocument().catch(() => undefined); });
    const originalGoto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await originalGoto(url, options);
      await auditCurrentDocument();
      return response;
    };

    await use(page);

    const findings = (await Promise.all(audits)).flat();
    const byRule = new Map<string, number>();
    for (const finding of findings) byRule.set(finding.id, (byRule.get(finding.id) ?? 0) + 1);
    const summary = [...byRule].map(([rule, count]) => `${rule}=${count}`).join(", ") || "none";
    console.log(`[axe] ${testInfo.project.name} · ${testInfo.title}: ${findings.length} serious/critical findings (${summary})`);
    if (findings.length) console.error(findings.map(({ url, id, summary: detail }) => `${url} [${id}] ${detail}`).join("\n"));
    expect(findings, "axe WCAG 2.1 AA serious/critical violations").toEqual([]);
  },
});
