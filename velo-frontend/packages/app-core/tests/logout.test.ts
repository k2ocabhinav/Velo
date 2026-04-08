import { afterEach, describe, expect, it, vi } from "vitest";
import { performClientLogout } from "../src/logout";

const originalFetch = global.fetch;
const originalWindow = globalThis.window;

function installWindowHarness() {
  const storage = new Map<string, string>();
  const removeItem = vi.fn((key: string) => {
    storage.delete(key);
  });
  const assign = vi.fn();

  const windowHarness = {
    sessionStorage: {
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      removeItem,
    },
    location: {
      assign,
    },
  };

  vi.stubGlobal("window", windowHarness);
  return {
    storage,
    removeItem,
    assign,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  if (typeof originalWindow === "undefined") {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    globalThis.window = originalWindow;
  }
});

describe("performClientLogout", () => {
  it("calls logout route, clears session storage keys, and redirects to login", async () => {
    const { storage, removeItem, assign } = installWindowHarness();
    storage.set("velo_ws_token", "abc");
    storage.set("other", "123");

    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;

    await performClientLogout({
      logoutPath: "/api/auth/logout",
      loginPath: "/login",
      sessionStorageKeysToClear: ["velo_ws_token"],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(removeItem).toHaveBeenCalledWith("velo_ws_token");
    expect(storage.get("velo_ws_token")).toBeUndefined();
    expect(storage.get("other")).toBe("123");
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("still performs local cleanup when logout request fails", async () => {
    const { storage, assign } = installWindowHarness();
    storage.set("velo_ws_token", "abc");

    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    await performClientLogout({
      sessionStorageKeysToClear: ["velo_ws_token"],
      loginPath: "/login",
    });

    expect(storage.get("velo_ws_token")).toBeUndefined();
    expect(assign).toHaveBeenCalledWith("/login");
  });
});
