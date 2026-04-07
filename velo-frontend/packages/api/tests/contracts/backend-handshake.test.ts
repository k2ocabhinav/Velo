import { describe, expect, it } from "vitest";

const baseUrl = process.env.VELO_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
const contractSuite = baseUrl ? describe : describe.skip;

contractSuite("backend handshake", () => {
  it("returns an openapi document", async () => {
    const response = await fetch(`${baseUrl}/v3/api-docs`);

    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");

    const payload = (await response.json()) as { openapi?: string; info?: { title?: string } };
    expect(payload.openapi).toBeDefined();
    expect(payload.info?.title).toBe("Velo Platform API");
  });

  it("responds to auth login with structured json for invalid credentials", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "__invalid__", password: "__invalid__" })
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");

    const payload = (await response.json()) as { error?: string; statusCode?: number };
    expect(typeof payload.error === "string" || typeof payload.statusCode === "number").toBe(true);
  });
});
