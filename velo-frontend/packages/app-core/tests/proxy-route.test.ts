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

const RIDER_OPTIONS = {
  tokenCookieName: "velo_rider_token",
  refreshCookieName: "velo_rider_refresh",
  userIdCookieName: "velo_rider_user_id",
  roleCookieName: "velo_rider_role_hint"
};

function createPassthroughRequest(method: string, accept?: string): NextRequest {
  const headers = new Headers({ cookie: "velo_rider_token=access-1" });
  if (accept) {
    headers.set("accept", accept);
  }
  return new NextRequest("https://rider.velo.test/api/backend/api/v1/resource", { method, headers });
}

function pathContext(...segments: string[]): { params: Promise<{ path: string[] }> } {
  return { params: Promise.resolve({ path: segments }) };
}

describe("BFF proxy response passthrough", () => {
  it("returns a valid 204 with no body or content-type for deletions", async () => {
    global.fetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

    const response = await proxyBackendRequest(
      createPassthroughRequest("DELETE"),
      pathContext("api", "v1", "riders", "saved-places", "3"),
      RIDER_OPTIONS
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("content-type")).toBeNull();
    await expect(response.text()).resolves.toBe("");
  });

  it("streams non-JSON downloads with their content type and disposition", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("accept")).toBe("text/csv");
      return new Response("date,time\r\n2026-10-17,09:15\r\n", {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition": 'attachment; filename="trip-sheet-2026-10-17.csv"'
        }
      });
    });
    global.fetch = fetchMock;

    const response = await proxyBackendRequest(
      createPassthroughRequest("GET", "text/csv"),
      pathContext("api", "v1", "admin", "trip-sheet", "export"),
      RIDER_OPTIONS
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="trip-sheet-2026-10-17.csv"');
    await expect(response.text()).resolves.toBe("date,time\r\n2026-10-17,09:15\r\n");
  });

  it("defaults to JSON when the client sends no Accept header", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("accept")).toBe("application/json");
      return new Response(JSON.stringify({ data: { id: 5 } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    global.fetch = fetchMock;

    const response = await proxyBackendRequest(
      createPassthroughRequest("GET"),
      pathContext("api", "v1", "riders", "getMyRides"),
      RIDER_OPTIONS
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ data: { id: 5 } });
  });

  it("does not attach a body to HEAD responses", async () => {
    global.fetch = vi.fn<typeof fetch>(
      async () => new Response("ignored", { status: 200, headers: { "content-type": "application/json" } })
    );

    const response = await proxyBackendRequest(
      createPassthroughRequest("HEAD"),
      pathContext("api", "v1", "admin", "stats"),
      RIDER_OPTIONS
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("");
  });
});
