import { describe, expect, it } from "vitest";
import { VeloHttpClient } from "../src/api/http-client.ts";

describe("Velo HTTP client", () => {
  it("uses backend auth and ride routes, rotates refresh tokens, and scopes identity by tenant branding", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    let now = 0;
    const fetcher: typeof fetch = async (input, init = {}) => {
      const url = String(input);
      requests.push({ url, init });
      let payload: unknown;
      if (url.endsWith("/auth/login")) {
        payload = envelope({ token: "access-old", refreshToken: "refresh-old", expiresInSeconds: 10, userId: 5, email: "rider1@sim.velobusiness.demo", role: "RIDER", tenantId: 7 });
      } else if (url.includes("/api/v1/public/tenant/branding?tenant=default")) {
        payload = envelope({ tenantId: 7, brandName: "Velo Business" });
      } else if (url.endsWith("/auth/refresh")) {
        payload = envelope({ token: "access-new", refreshToken: "refresh-new", expiresInSeconds: 900, userId: 5, email: "rider1@sim.velobusiness.demo", role: "RIDER", tenantId: 7 });
      } else if (url.endsWith("/riders/getMyProfile")) {
        payload = envelope({ id: 2, user: { name: "Priya Nair", email: "rider1@sim.velobusiness.demo", roles: ["RIDER"] }, rating: 5 });
      } else if (url.endsWith("/auth/ws-ticket")) {
        payload = envelope({ ticket: "ticket-1", expiresInSeconds: 60 });
      } else if (url.endsWith("/auth/logout")) {
        payload = envelope({ message: "Logged out" });
      } else {
        return new Response("{}", { status: 404 });
      }
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    };
    const client = new VeloHttpClient({ apiBaseUrl: "http://localhost:8080", fetcher, now: () => now });

    const identity = await client.login("rider1@sim.velobusiness.demo", "password123");
    const branding = await client.getTenantBranding("default");
    expect(identity.tenantId).toBe(7);
    expect(branding.tenantId).toBe(identity.tenantId);

    now = 1_000;
    const profile = await client.getRiderProfile();
    expect(profile.user.roles).toContain("RIDER");
    const ticket = await client.getWebSocketTicket();
    expect(ticket.ticket).toBe("ticket-1");
    await client.logout();

    const refreshRequest = requests.find((request) => request.url.endsWith("/auth/refresh"));
    expect(JSON.parse(String(refreshRequest?.init.body))).toEqual({ refreshToken: "refresh-old" });
    const profileRequest = requests.find((request) => request.url.endsWith("/riders/getMyProfile"));
    expect(new Headers(profileRequest?.init.headers).get("authorization")).toBe("Bearer access-new");
    expect(new Headers(profileRequest?.init.headers).get("x-tenant-id")).toBeNull();
    expect(requests.map((request) => new URL(request.url).pathname)).toContain("/riders/getMyProfile");
    const logoutRequest = requests.find((request) => request.url.endsWith("/auth/logout"));
    expect(JSON.parse(String(logoutRequest?.init.body))).toEqual({ refreshToken: "refresh-new" });
  });
});

function envelope<T>(data: T): { data: T; error: string; statusCode: number } {
  return { data, error: "", statusCode: 200 };
}
