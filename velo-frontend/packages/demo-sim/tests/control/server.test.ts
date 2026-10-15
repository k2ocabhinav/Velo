import { afterEach, describe, expect, it } from "vitest";
import { request as httpRequest } from "node:http";
import { ControlServer } from "../../src/control/server.ts";
import { EventHub } from "../../src/control/event-hub.ts";
import type { SimConfig } from "../../src/control/runtime-config.ts";
import type { ControlStatus, Poi } from "../../src/types.ts";
import { ControlRequestError } from "../../src/control/errors.ts";

const servers: ControlServer[] = [];
const JSON_HEADERS = { "content-type": "application/json", "x-velo-sim": "1" };

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function setup() {
  const events = new EventHub();
  const config: SimConfig = {
    paused: false,
    speedFactor: 4,
    seed: 42,
    tenants: { default: { onlineDrivers: 1, requestIntervalSec: 75, airportShare: 0.4, declineProbability: 0.15, pickupWaitSec: [15, 30], idleRepositionProbability: 0.3, hotspots: ["kia-t1"] } },
  };
  const status: ControlStatus = {
    ready: true,
    paused: false,
    speedFactor: 4,
    uptimeSec: 12,
    tenants: [{
      slug: "default",
      name: "Velo Business",
      currency: "INR",
      drivers: [{ email: "driver1@sim.velobusiness.demo", name: "Arjun Rao", state: "idle", poi: "ITC Gardenia", rideId: null, delayedUntil: null }],
      riders: [{ email: "rider1@sim.velobusiness.demo", name: "Priya Nair", state: "idle", rideRequestId: null }],
      pendingRequests: 0,
      activeTrips: 0,
      completedTrips: 0,
    }],
    recentErrors: [],
  };
  const pois: Poi[] = [{ id: "kia-t1", name: "KIA T1", kind: "airport", lat: 13, lng: 77, weight: 1 }];
  const server = new ControlServer(0, {
    status: () => status,
    pois: () => pois,
    getConfig: () => structuredClone(config),
    patchConfig: (patch) => {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ok: false, error: "config patch must be an object" };
      return { ok: true, config, changed: ["paused"] };
    },
    applyPreset: () => ({ ok: true, config, changed: ["tenants.default.requestIntervalSec"] }),
    executeAction: async (name) => {
      if (name === "bad") throw new ControlRequestError(400, "unknown action \"bad\"");
      return { summary: "Priya Nair requested ITC Gardenia → KIA T1", refs: { rideRequestId: 52 } };
    },
    events,
  });
  servers.push(server);
  return { server, events, config, status, pois };
}

describe("control HTTP routes", () => {
  it("serves the panel, §8.1 status, POIs, config, presets, actions, and clear 400s", async () => {
    const { server, status, config, pois } = setup();
    await server.listen();
    const base = `http://127.0.0.1:${server.listeningPort}`;

    const panel = await fetch(`${base}/`);
    expect(panel.status).toBe(200);
    expect(panel.headers.get("content-type")).toContain("text/html");
      expect(await panel.text()).toContain("Fleet simulator");
    expect(await (await fetch(`${base}/status`)).json()).toEqual(status);
    expect(await (await fetch(`${base}/pois`)).json()).toEqual(pois.map(({ id, name, kind, lat, lng }) => ({ id, name, kind, lat, lng })));
    expect(await (await fetch(`${base}/config`)).json()).toEqual({ config });

    const patched = await fetch(`${base}/config`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ paused: true }) });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ config, changed: ["paused"] });
    const preset = await fetch(`${base}/preset`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name: "quiet", tenant: "default" }) });
    expect(preset.status).toBe(200);
    const action = await fetch(`${base}/actions/request-trip`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ tenant: "default" }),
    });
    expect(action.status).toBe(202);
    expect(await action.json()).toMatchObject({ accepted: true, refs: { rideRequestId: 52 } });

    const invalidConfig = await fetch(`${base}/config`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify([]) });
    expect(invalidConfig.status).toBe(400);
    expect(await invalidConfig.json()).toEqual({ error: "Request body must be a JSON object." });
    const invalidJson = await fetch(`${base}/preset`, { method: "POST", headers: JSON_HEADERS, body: "{" });
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toMatchObject({ error: "Request body must be valid JSON." });
    const invalidAction = await fetch(`${base}/actions/bad`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ tenant: "default" }) });
    expect(invalidAction.status).toBe(400);
    expect(await invalidAction.json()).toEqual({ error: 'unknown action "bad"' });
    expect((await fetch(`${base}/not-found`)).status).toBe(404);
  });

  it("rejects rebinding hosts, foreign origins, and non-JSON or headerless writes", async () => {
    const { server } = setup();
    await server.listen();
    const base = `http://127.0.0.1:${server.listeningPort}`;
    const port = server.listeningPort;

    expect(await requestWithHost(base, `attacker.example:${port}`)).toBe(403);
    expect((await fetch(`${base}/status`, { headers: { origin: `http://attacker.example:${port}` } })).status).toBe(403);
    expect((await fetch(`${base}/config`, {
      method: "PATCH", headers: { "content-type": "text/plain", "x-velo-sim": "1" }, body: "{}",
    })).status).toBe(403);
    expect((await fetch(`${base}/config`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paused: true }),
    })).status).toBe(403);
    expect((await fetch(`${base}/config`, {
      method: "PATCH",
      headers: { ...JSON_HEADERS, origin: base },
      body: JSON.stringify({ paused: true }),
    })).status).toBe(200);
  });

  it("streams named SSE events through the HTTP route", async () => {
    const { server, events } = setup();
    await server.listen();
    const abort = new AbortController();
    const response = await fetch(`http://127.0.0.1:${server.listeningPort}/events`, { signal: abort.signal });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain(": connected");

    events.publish({ tenant: "default", type: "trip.requested", message: "request 52" });
    const frame = await reader.read();
    const text = new TextDecoder().decode(frame.value);
    expect(text).toContain("event: trip.requested");
    expect(text).toContain('"message":"request 52"');
    abort.abort();
    await reader.cancel().catch(() => undefined);
  });
});

function requestWithHost(url: string, host: string): Promise<number> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: Number(target.port),
      path: target.pathname,
      headers: { host },
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    });
    request.once("error", reject);
    request.end();
  });
}
