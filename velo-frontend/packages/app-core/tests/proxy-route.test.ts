import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxyBackendRequest } from "../src/proxy-route";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VELO_AUTH_COOKIE_SECURE", "false");
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function createRequest() {
  return new NextRequest("https://rider.velo.test/api/backend/api/v1/rides", {
    method: "POST",
    headers: {
      cookie: "velo_rider_token=access-old; velo_rider_refresh=refresh-old",
      "content-type": "application/json"
    },
    body: JSON.stringify({ pickup: "A" })
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("BFF proxy refresh", () => {
  it("refreshes once for concurrent 401s, retries, and rotates httpOnly cookies", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse({
          data: {
            token: "access-new",
            refreshToken: "refresh-new",
            userId: 7,
            role: "RIDER",
            expiresInSeconds: 900
          }
        });
      }
      if (authorization === "Bearer access-old") {
        return jsonResponse({ error: { message: "Expired" } }, 401);
      }
      expect(authorization).toBe("Bearer access-new");
      return jsonResponse({ data: { id: 12 } });
    });
    global.fetch = fetchMock;

    const options = {
      tokenCookieName: "velo_rider_token",
      refreshCookieName: "velo_rider_refresh",
      userIdCookieName: "velo_rider_user_id",
      roleCookieName: "velo_rider_role_hint"
    };
    const [first, second] = await Promise.all([
      proxyBackendRequest(createRequest(), { params: Promise.resolve({ path: ["api", "v1", "rides"] }) }, options),
      proxyBackendRequest(createRequest(), { params: Promise.resolve({ path: ["api", "v1", "rides"] }) }, options)
    ]);

    expect(refreshCalls).toBe(1);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.cookies.get("velo_rider_token")?.value).toBe("access-new");
    expect(first.cookies.get("velo_rider_refresh")).toEqual(
      expect.objectContaining({ value: "refresh-new", path: "/api", httpOnly: true, secure: false })
    );
    await expect(first.json()).resolves.toEqual({ data: { id: 12 } });
  });
});
