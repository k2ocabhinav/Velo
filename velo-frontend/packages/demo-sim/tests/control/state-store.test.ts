import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadState, saveState } from "../../src/control/state-store.ts";
import { defaultConfig, type ConfigContext, type SimConfig } from "../../src/control/runtime-config.ts";

const ctx: ConfigContext = {
  fleetSizes: { default: 6, "saffron-routes": 6 },
  poiIds: ["kia-t1", "kia-t2", "taj"],
  airportPoiIds: ["kia-t1", "kia-t2"],
  poiKinds: { "kia-t1": "airport", "kia-t2": "airport", taj: "hotel" },
  poiWeights: { "kia-t1": 1, "kia-t2": 1, taj: 20 },
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "demo-sim-state-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function statePath(name = "sim-state.json"): string {
  return join(dir, name);
}

function fallback(): SimConfig {
  return defaultConfig(ctx, 11);
}

describe("saveState / loadState", () => {
  it("round-trips a config", async () => {
    const path = statePath();
    const config = fallback();
    config.tenants["default"]!.onlineDrivers = 3;
    config.tenants["default"]!.pickupWaitSec = [20, 40];
    config.speedFactor = 4;

    await saveState(path, config);
    const loaded = await loadState(path, ctx, fallback());

    expect(loaded).toEqual(config);
  });

  it("writes pretty-printed JSON with a trailing newline", async () => {
    const path = statePath();
    await saveState(path, fallback());

    const raw = await readFile(path, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(fallback());
  });

  it("creates nested parent directories", async () => {
    const path = join(dir, "deep", "nested", "sim-state.json");
    await saveState(path, fallback());

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(fallback());
  });

  it("leaves no temp files behind", async () => {
    const path = statePath();
    await saveState(path, fallback());
    await saveState(path, fallback());

    expect(await readdir(dir)).toEqual(["sim-state.json"]);
  });

  it("atomically replaces an existing file", async () => {
    const path = statePath();
    const first = fallback();
    first.seed = 1;
    const second = fallback();
    second.seed = 2;

    await saveState(path, first);
    await saveState(path, second);

    expect((await loadState(path, ctx, fallback())).seed).toBe(2);
  });

  it("falls back when the file is missing", async () => {
    const fb = fallback();
    expect(await loadState(statePath("absent.json"), ctx, fb)).toBe(fb);
  });

  it("falls back on invalid JSON", async () => {
    const path = statePath();
    await writeFile(path, "{ not json", "utf8");

    const fb = fallback();
    expect(await loadState(path, ctx, fb)).toBe(fb);
  });

  it("merges a partial file over the fallback", async () => {
    const path = statePath();
    await writeFile(path, JSON.stringify({ speedFactor: 5, tenants: { default: { requestIntervalSec: 0 } } }), "utf8");

    const loaded = await loadState(path, ctx, fallback());

    expect(loaded.speedFactor).toBe(5);
    expect(loaded.tenants["default"]?.requestIntervalSec).toBe(0);
    expect(loaded.tenants["default"]?.onlineDrivers).toBe(6);
    expect(loaded.tenants["saffron-routes"]?.requestIntervalSec).toBe(75);
  });

  it("re-validates and clamps on read", async () => {
    const path = statePath();
    await writeFile(path, JSON.stringify({ speedFactor: 999 }), "utf8");

    expect((await loadState(path, ctx, fallback())).speedFactor).toBe(20);
  });

  it("falls back when the file has an unknown key", async () => {
    const path = statePath();
    await writeFile(path, JSON.stringify({ speedFactor: 5, bogus: true }), "utf8");

    const fb = fallback();
    expect(await loadState(path, ctx, fb)).toBe(fb);
  });

  it("falls back when the file names an unknown tenant", async () => {
    const path = statePath();
    await writeFile(path, JSON.stringify({ tenants: { ghost: { onlineDrivers: 1 } } }), "utf8");

    const fb = fallback();
    expect(await loadState(path, ctx, fb)).toBe(fb);
  });
});
