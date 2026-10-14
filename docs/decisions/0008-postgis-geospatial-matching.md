# 0008 — PostGIS geography for geospatial matching

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-07

## Context

Driver matching and fare/ETA work need distances between pickup, drop-off, and driver locations. Computing those in application code means loading rows and running haversine math per row.

## Options considered

1. **Application-side distance calculation** — Pros: no database extension. Cons: scans rows, slow, duplicates geometry math.
2. **PostGIS with `geometry`** — Pros: spatial indexes, SQL-side queries. Cons: planar distance is wrong for latitude/longitude.
3. **PostGIS with `geography`** — Pros: correct spheroidal distance on lat/lon plus spatial indexes. Cons: requires the PostGIS extension and spatial types (Hibernate Spatial).

## Decision

Use PostgreSQL + PostGIS (via Hibernate Spatial) and store/match driver locations as `geography`, so matching queries compute correct distances in the database.

## Consequences

- Matching and admin aggregates run as indexed spatial queries (hot-path indexes were added in `0bfc7c5`).
- PostGIS must be available in every environment: the compose image, the CI PostgreSQL service, and RDS.
- **Risks:** the Apple Silicon compose image needs a native arm build to avoid amd64 emulation.
- Rationale not recorded at the time; the `geography` choice is visible only in the "use geography for driver matching" commit.

## Related

- Docs: [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md)
- Commits: `499fbc3`, `302c42f`, `0bfc7c5`
