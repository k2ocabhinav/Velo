import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePolyline } from "./polyline.ts";
import type { Poi, RouteCatalogue, RouteEntry } from "../types.ts";

const POI_KINDS = new Set(["airport", "hotel", "station", "business", "landmark"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parsePois(value: unknown): Poi[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("POI catalogue must contain at least one place");
  }
  const ids = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new TypeError(`POI ${index} must be an object`);
    }
    const { id, name, kind, lat, lng, weight } = candidate;
    if (typeof id !== "string" || !id || ids.has(id) || typeof name !== "string" || !name) {
      throw new TypeError(`POI ${index} must have a unique id and name`);
    }
    if (!POI_KINDS.has(String(kind))) {
      throw new TypeError(`POI ${id} has an unsupported kind`);
    }
    if (typeof lat !== "number" || lat < -90 || lat > 90 || typeof lng !== "number" || lng < -180 || lng > 180) {
      throw new TypeError(`POI ${id} has invalid coordinates`);
    }
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      throw new TypeError(`POI ${id} must have a positive weight`);
    }
    ids.add(id);
    return { id, name, kind: kind as Poi["kind"], lat, lng, weight };
  });
}

function parseRoutes(value: unknown): Record<string, RouteEntry> {
  if (!isRecord(value) || !isRecord(value.routes)) {
    throw new TypeError("Route catalogue must contain a routes object");
  }
  const routes: Record<string, RouteEntry> = {};
  for (const [key, candidate] of Object.entries(value.routes)) {
    if (!isRecord(candidate)) {
      throw new TypeError(`Route ${key} must be an object`);
    }
    const { distanceM, durationS, polyline } = candidate;
    if (typeof distanceM !== "number" || !Number.isFinite(distanceM) || distanceM <= 0
      || typeof durationS !== "number" || !Number.isFinite(durationS) || durationS <= 0
      || typeof polyline !== "string" || !polyline) {
      throw new TypeError(`Route ${key} must have positive distance and duration and a polyline`);
    }
    if (decodePolyline(polyline).length < 2) {
      throw new TypeError(`Route ${key} must contain at least two coordinates`);
    }
    routes[key] = { distanceM, durationS, polyline };
  }
  return routes;
}

export async function loadRouteCatalogue(directory?: string): Promise<RouteCatalogue> {
  const baseDirectory = directory ?? fileURLToPath(new URL("../../data/bengaluru/", import.meta.url));
  const [poisJson, routesJson] = await Promise.all([
    readFile(resolve(baseDirectory, "pois.json"), "utf8"),
    readFile(resolve(baseDirectory, "routes.json"), "utf8"),
  ]);
  const poisValue: unknown = JSON.parse(poisJson);
  const routesValue: unknown = JSON.parse(routesJson);
  const pois = parsePois(poisValue);
  const routes = parseRoutes(routesValue);
  const poiIds = new Set(pois.map((poi) => poi.id));
  for (const key of Object.keys(routes)) {
    const [from, to, ...rest] = key.split(">");
    if (!from || !to || rest.length > 0 || !poiIds.has(from) || !poiIds.has(to) || from === to) {
      throw new TypeError(`Route key is not a valid ordered POI pair: ${key}`);
    }
  }
  for (const from of poiIds) {
    for (const to of poiIds) {
      if (from !== to && !routes[`${from}>${to}`]) {
        throw new TypeError(`Route catalogue is missing ordered pair ${from}>${to}`);
      }
    }
  }
  return { pois, routes };
}

export function getRoute(catalogue: RouteCatalogue, fromId: string, toId: string): RouteEntry {
  if (fromId === toId) {
    throw new RangeError("A route requires different origin and destination POIs");
  }
  const route = catalogue.routes[`${fromId}>${toId}`];
  if (!route) {
    throw new Error(`Route catalogue is missing ${fromId}>${toId}`);
  }
  return route;
}
