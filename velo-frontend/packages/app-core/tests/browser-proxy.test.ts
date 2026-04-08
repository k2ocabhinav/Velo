import { afterEach, describe, expect, it, vi } from "vitest";
import { requestProxyData, unwrapPageItems } from "../src/browser-proxy";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("requestProxyData", () => {
  it("unwraps envelope data by default", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ data: { id: 7 } })) as typeof fetch;

    const payload = await requestProxyData<{ id: number }>("resource", undefined, {
      pathPrefix: "/api/backend"
    });

    expect(payload).toEqual({ id: 7 });
  });

  it("throws readable error for failed responses", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ error: "Conflict" }, 409)) as typeof fetch;

    await expect(
      requestProxyData("resource", undefined, {
        pathPrefix: "/api/backend"
      })
    ).rejects.toThrow("Conflict");
  });
});

describe("unwrapPageItems", () => {
  it("supports both content and items payloads", () => {
    expect(unwrapPageItems<{ id: number }>({ data: { content: [{ id: 1 }] } })).toEqual([{ id: 1 }]);
    expect(unwrapPageItems<{ id: number }>({ data: { items: [{ id: 2 }] } })).toEqual([{ id: 2 }]);
    expect(unwrapPageItems<{ id: number }>({ data: {} })).toEqual([]);
  });
});

