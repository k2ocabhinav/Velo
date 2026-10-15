/**
 * Builds the Bengaluru route catalogue for the demo simulator.
 *
 * Reads `data/bengaluru/pois.json` and writes `data/bengaluru/routes.json`, a
 * lookup of every ordered POI pair (`<fromId>><toId>`) to its driving distance,
 * duration and precision-5 encoded polyline.
 *
 * Routes come from the public OSRM server. The script is deliberately polite:
 * at least {@link MIN_REQUEST_INTERVAL_MS} between requests, a descriptive
 * User-Agent, and bounded retries with backoff on 429/5xx. Every POI and every
 * route is validated before it is accepted.
 *
 * Usage: `node scripts/build-route-catalogue.ts [--resume]`
 *   Node 23+ runs this TypeScript file directly (erasable syntax only).
 *   `--resume` keeps entries already present in routes.json and only fetches
 *   the missing pairs.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const USER_AGENT =
  'velo-demo-route-catalogue/1.0 (Velo platform demo simulator; contact: engineering@velo.example)';

/** OSRM's public instance asks for <= 1 request per second; leave headroom. */
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 2000;

/** A POI must sit on the road network: its nearest road is closer than this. */
const POI_SNAP_LIMIT_M = 60;
/** OSRM snaps route endpoints; reject a route whose endpoints drifted further. */
const ROUTE_SNAP_LIMIT_M = 150;
/** Persist partial progress every N pairs so an interrupted run can resume. */
const PERSIST_EVERY_PAIRS = 10;

type PoiKind = 'airport' | 'hotel' | 'station' | 'business' | 'landmark';

interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  weight: number;
}

interface RouteEntry {
  distanceM: number;
  durationS: number;
  polyline: string;
}

interface RouteCatalogue {
  city: string;
  generatedAt: string;
  source: string;
  attribution: string;
  routes: Record<string, RouteEntry>;
}

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'bengaluru');
const POIS_PATH = join(DATA_DIR, 'pois.json');
const ROUTES_PATH = join(DATA_DIR, 'routes.json');
const CITY = 'bengaluru';
const SOURCE = `${OSRM_BASE_URL} (car)`;
const ATTRIBUTION = '© OpenStreetMap contributors, ODbL; routing by OSRM';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const round1 = (value: number): number => Math.round(value * 10) / 10;

let lastRequestAt = 0;

/** Suspends until at least MIN_REQUEST_INTERVAL_MS has passed since the last request. */
async function waitForRequestSlot(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) {
    await sleep(wait);
  }
  lastRequestAt = Date.now();
}

async function fetchWithRetry<T>(url: string, describe: string): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await waitForRequestSlot();
    let message = '';
    let retryable = false;
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.ok) {
        return (await response.json()) as T;
      }
      message = `${describe}: HTTP ${response.status}`;
      retryable = response.status === 429 || response.status >= 500;
    } catch (error) {
      message = `${describe}: ${error instanceof Error ? error.message : String(error)}`;
      retryable = true;
    }
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(message);
    }
    const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    console.warn(`  ${message}; retrying in ${delay} ms (attempt ${attempt + 1})`);
    await sleep(delay);
  }
  throw new Error('unreachable');
}

async function readPois(): Promise<Poi[]> {
  const pois = JSON.parse(await readFile(POIS_PATH, 'utf8')) as Poi[];
  if (!Array.isArray(pois) || pois.length === 0) {
    throw new Error(`${POIS_PATH}: expected a non-empty array of POIs`);
  }
  return pois;
}

interface OsrmNearest {
  code: string;
  waypoints: { distance: number }[];
}

/** Confirms a POI sits at the drivable entrance of its venue (< POI_SNAP_LIMIT_M). */
async function verifyPoiSnap(poi: Poi): Promise<void> {
  const url = `${OSRM_BASE_URL}/nearest/v1/car/${poi.lng},${poi.lat}?number=1`;
  const result = await fetchWithRetry<OsrmNearest>(url, `nearest ${poi.id}`);
  const distance = result.waypoints?.[0]?.distance;
  if (result.code !== 'Ok' || typeof distance !== 'number') {
    throw new Error(`nearest ${poi.id}: unexpected OSRM response ${result.code}`);
  }
  if (distance > POI_SNAP_LIMIT_M) {
    throw new Error(
      `POI ${poi.id} snaps ${distance.toFixed(1)} m from the road network ` +
        `(limit ${POI_SNAP_LIMIT_M} m). Move it to the venue entrance.`,
    );
  }
  console.log(`  ${poi.id.padEnd(18)} snap ${distance.toFixed(1).padStart(5)} m`);
}

interface OsrmRoute {
  code: string;
  routes?: { distance: number; duration: number; geometry: string }[];
  waypoints?: { distance: number }[];
}

async function fetchRoute(from: Poi, to: Poi): Promise<RouteEntry> {
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE_URL}/route/v1/car/${coordinates}?overview=full&geometries=polyline&alternatives=false&steps=false`;
  const key = `${from.id}>${to.id}`;
  const result = await fetchWithRetry<OsrmRoute>(url, `route ${key}`);
  const route = result.routes?.[0];
  const snapDistances = result.waypoints?.map((waypoint) => waypoint.distance) ?? [];
  if (result.code !== 'Ok' || !route) {
    throw new Error(`route ${key}: OSRM returned ${result.code}`);
  }
  if (route.distance <= 0) {
    throw new Error(`route ${key}: non-positive distance ${route.distance}`);
  }
  if (typeof route.geometry !== 'string' || route.geometry.length === 0) {
    throw new Error(`route ${key}: empty geometry`);
  }
  if (snapDistances.length !== 2 || snapDistances.some((d) => d > ROUTE_SNAP_LIMIT_M)) {
    throw new Error(
      `route ${key}: endpoint snapped ${snapDistances.join('/')} m (limit ${ROUTE_SNAP_LIMIT_M} m)`,
    );
  }
  return {
    distanceM: round1(route.distance),
    durationS: round1(route.duration),
    polyline: route.geometry,
  };
}

/** Serialises the catalogue with sorted keys and a trailing newline. */
function serialise(catalogue: RouteCatalogue): string {
  const sortedRoutes: Record<string, RouteEntry> = {};
  for (const key of Object.keys(catalogue.routes).sort()) {
    sortedRoutes[key] = catalogue.routes[key];
  }
  return `${JSON.stringify({ ...catalogue, routes: sortedRoutes }, null, 2)}\n`;
}

async function loadExistingRoutes(): Promise<Record<string, RouteEntry>> {
  try {
    const existing = JSON.parse(await readFile(ROUTES_PATH, 'utf8')) as RouteCatalogue;
    return existing.routes ?? {};
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const resume = process.argv.includes('--resume');
  const pois = await readPois();
  const pairs: { key: string; from: Poi; to: Poi }[] = [];
  for (const from of pois) {
    for (const to of pois) {
      if (from.id !== to.id) {
        pairs.push({ key: `${from.id}>${to.id}`, from, to });
      }
    }
  }

  console.log(`Verifying ${pois.length} POIs snap within ${POI_SNAP_LIMIT_M} m of a road...`);
  for (const poi of pois) {
    await verifyPoiSnap(poi);
  }

  const routes = resume ? await loadExistingRoutes() : {};
  const catalogue: RouteCatalogue = {
    city: CITY,
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    attribution: ATTRIBUTION,
    routes,
  };

  console.log(`\nRouting ${pairs.length} ordered pairs via ${OSRM_BASE_URL}...`);
  let fetched = 0;
  for (let index = 0; index < pairs.length; index += 1) {
    const { key, from, to } = pairs[index];
    if (routes[key]) {
      continue;
    }
    routes[key] = await fetchRoute(from, to);
    fetched += 1;
    if (fetched % PERSIST_EVERY_PAIRS === 0) {
      await writeFile(ROUTES_PATH, serialise(catalogue));
    }
    const done = index + 1;
    if (done % PERSIST_EVERY_PAIRS === 0 || done === pairs.length) {
      console.log(`  ${done}/${pairs.length} pairs (${Object.keys(routes).length} stored)`);
    }
  }

  catalogue.generatedAt = new Date().toISOString();
  await writeFile(ROUTES_PATH, serialise(catalogue));
  console.log(`\nWrote ${Object.keys(routes).length} routes to ${ROUTES_PATH}`);
}

await main();
