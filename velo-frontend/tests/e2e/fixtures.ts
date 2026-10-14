import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";

export { expect };

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    type AxeFinding = { url: string; id: string; impact: string; summary: string };
    const audits: Array<Promise<AxeFinding[]>> = [];
    const auditByUrl = new Map<string, Promise<AxeFinding[]>>();
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
          results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
        } catch (error) {
          // A user-triggered navigation can replace the document while axe is
          // evaluating it. The destination's load event schedules its own audit.
          if (page.isClosed() || page.url() !== visitedUrl) return [];
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
