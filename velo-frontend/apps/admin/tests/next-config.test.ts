import { describe, expect, it } from "vitest";
// @ts-expect-error -- next.config.mjs is a JavaScript module without generated TypeScript declarations.
import nextConfig from "../next.config.mjs";

describe("admin next config", () => {
  it("keeps standalone output enabled", () => {
    expect(nextConfig.output).toBe("standalone");
  });
});
