# Bengaluru route catalogue

Curated data for the demo simulator. It fixes where the simulated fleet moves
and the road routes between those places, so no routing service is called at
runtime. Both files are committed.

## Files

- **`pois.json`** — a JSON array of the 16 real Bengaluru places used as trip
  endpoints, each `{ id, name, kind, lat, lng, weight }`:
  - `kind` is one of `airport`, `hotel`, `station`, `business`, `landmark`.
  - `lat`/`lng` are the venue's drivable entrance or forecourt.
  - `weight` is the relative chance of being picked as an endpoint (airport legs
    are chosen separately by the simulator engine, see spec §5).
- **`routes.json`** — `{ city, generatedAt, source, attribution, routes }`.
  `routes` maps every ordered pair `<fromId>><toId>` (e.g. `kia-t1>oberoi`) to
  `{ distanceM, durationS, polyline }`, where `polyline` is a precision-5
  encoded polyline (`overview=full`). Keys are sorted; the file is 2-space
  indented and deterministic apart from `generatedAt`.

The set covers both KIA terminals and the seeded demo area (central Bengaluru
hotels, business districts and the city station), so the simulated fleet
overlaps the scripted demo trips.

## Provenance and licence

- Routing: the public **OSRM** server, `https://router.project-osrm.org`
  (car profile).
- Map data: © **OpenStreetMap contributors**, licensed **ODbL**.
- Coordinates were researched from OpenStreetMap (Nominatim) and validated with
  OSRM `/nearest` — every POI snaps to the road network within 60 m.

## Regenerating

```sh
cd velo-frontend/packages/demo-sim
node scripts/build-route-catalogue.ts            # full rebuild
node scripts/build-route-catalogue.ts --resume   # keep existing pairs, fetch missing
```

Node 23+ runs the TypeScript directly (no build step). The script uses the
public OSRM politely: at least 1.1 s between requests, a descriptive
User-Agent, and bounded retries with backoff on 429/5xx. A full rebuild is 16
`/nearest` and 240 `/route` requests (a few minutes). It validates that every
POI and every route endpoint sits on the road network before writing.

## Adding or moving a POI

Edit `pois.json`, re-run the builder, and commit both files. Keep `id`s
kebab-case and unique; the builder refuses to run if a POI does not sit at a
drivable entrance.
