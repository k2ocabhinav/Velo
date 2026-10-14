import { describe, expect, it } from "vitest";
import { resolveTenantPrimaryStyle } from "../src/theme/tenant-resolver";

describe("tenant primary color override", () => {
  it("converts an accessible hex color to bounded HSL variables", () => {
    expect(resolveTenantPrimaryStyle("#0057B8")).toEqual({
      "--color-primary": "211.6 100% 36.1%",
      "--color-primary-hover": "211.5 100% 31.8%",
      "--color-primary-fg": "0 0% 100%",
    });
  });

  it("uses platform defaults when the color is invalid or fails white AA contrast", () => {
    const fallback = {
      "--color-primary": "220 75% 42%",
      "--color-primary-hover": "220 72% 50%",
      "--color-primary-fg": "0 0% 100%",
    };
    expect(resolveTenantPrimaryStyle("#FFFFFF")).toEqual(fallback);
    expect(resolveTenantPrimaryStyle("red; color: black")).toEqual(fallback);
  });
});
