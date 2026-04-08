import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "../src/redirect";

describe("sanitizeNextPath", () => {
  it("keeps safe internal redirects", () => {
    expect(sanitizeNextPath("/rides?tab=active")).toBe("/rides?tab=active");
  });

  it("blocks external redirects and malformed values", () => {
    expect(sanitizeNextPath("https://evil.example/phish")).toBe("/");
    expect(sanitizeNextPath("//evil.example/phish")).toBe("/");
    expect(sanitizeNextPath("   ")).toBe("/");
  });
});

