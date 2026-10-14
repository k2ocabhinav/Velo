import { describe, expect, it } from "vitest";
// @ts-expect-error -- next.config.mjs is a JavaScript module without generated TypeScript declarations.
import nextConfig from "../next.config.mjs";
// @ts-expect-error -- next.config.mjs is a JavaScript module without generated TypeScript declarations.
import riderConfig from "../../rider/next.config.mjs";
// @ts-expect-error -- next.config.mjs is a JavaScript module without generated TypeScript declarations.
import driverConfig from "../../driver/next.config.mjs";
// @ts-expect-error -- next.config.mjs is a JavaScript module without generated TypeScript declarations.
import landingConfig from "../../landing/next.config.mjs";
import { createSecurityHeaders } from "@velo/config/security-headers";

describe("admin next config", () => {
  it("keeps standalone output enabled", () => {
    expect(nextConfig.output).toBe("standalone");
  });

  it.each([nextConfig, riderConfig, driverConfig, landingConfig])(
    "sets shared security headers for every app",
    async (config) => {
      const rules = await config.headers();
      expect(rules).toHaveLength(1);
      expect(rules[0].source).toBe("/:path*");
      expect(rules[0].headers).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "Content-Security-Policy" }),
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ]));
    }
  );

  it("allows the app map and API origins and adds HSTS only in production", () => {
    const headers = createSecurityHeaders({
      apiBaseUrl: "https://api.example.com/v1",
      environment: "production"
    });
    const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("https://api.example.com");
    expect(csp).toContain("wss://api.example.com");
    expect(csp).toContain("https://router.project-osrm.org");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains"
    });
    expect(createSecurityHeaders({ environment: "development" })).not.toContainEqual(
      expect.objectContaining({ key: "Strict-Transport-Security" })
    );
    expect(csp).not.toContain("nominatim");
  });
});
