# Velo

Velo is a branded dispatch desk for small fleets running pre-booked business and hotel transfers. It is an India-first, white-label platform: each fleet gets its own name, color, and operating labels while using the same rider, driver, and dispatch workflows.

## Demo screenshots

These screens are captured from the local demo at their native viewport sizes.

| Dispatch desk | Rider booking | Driver home |
|---|---|---|
| ![Velo Business dispatch](docs/images/velo-business-admin-dispatch.jpg) | ![Rider booking](docs/images/rider-booking.jpg) | ![Driver home](docs/images/driver-home.jpg) |

| Second tenant dispatch | Second tenant branding settings |
|---|---|
| ![Saffron Routes dispatch](docs/images/saffron-routes-admin-dispatch.jpg) | ![Saffron Routes branding and labels](docs/images/saffron-routes-branding.jpg) |

| Landing page at 390 × 844 | Landing page at 1440 × 900 |
|---|---|
| ![Landing page on mobile](docs/images/landing-mobile-390x844.jpg) | ![Landing page on desktop](docs/images/landing-desktop-1440x900.jpg) |

## What works today

- Separate tenant data and branded workspaces with custom colors and rider, driver, and trip labels.
- Rider booking, fare estimates, scheduled trips, wallet, payment methods, and trip history.
- Driver availability, ride offers, pickup OTP, active-trip tracking, earnings, and payout requests.
- Admin dispatch and audit history, driver approvals, payouts, scheduled trips, promos, and revenue views.
- PostGIS-backed nearby-driver matching, live ride updates, and cookie-based BFF authentication.

## Architecture at a glance

- `velo-platform/`: Spring Boot API, PostgreSQL + PostGIS, Flyway schema and local demo data.
- `velo-frontend/`: Next.js landing, admin, rider, and driver apps with shared Turborepo packages.
- Tenant branding resolves from `default.localhost` or a tenant subdomain such as `saffron-routes.localhost`.
- Local services use ports 4100–4103; the API uses port 8080.

## Quick start

Requirements: Java 21+, Node.js 22+, npm, Python 3, and either local PostgreSQL with PostGIS or Docker.

```bash
./scripts/demo-up.sh
```

On its first run, the script installs frontend dependencies if needed. It starts PostGIS through the existing Compose file only when PostgreSQL is not already reachable, then starts the API and all four web apps. It defaults to ports 4100–4103 and 8080; if those are occupied, it uses 5700–5703 and the next available API port. It prints tenant URLs and demo logins. Stop only the services it started with:

```bash
./scripts/demo-down.sh
```

All demo accounts use `password123`.

| Tenant | Admin | Rider | Driver |
|---|---|---|---|
| Velo Business | `admin@velo-platform.com` | `henry@example.com` | `bob.driver@example.com` |
| Saffron Routes | `owner@saffronroutes.demo` | `guest@saffronroutes.demo` | `chauffeur1@saffronroutes.demo` |

Use `http://default.localhost:<port>` for Velo Business and `http://saffron-routes.localhost:<port>` for Saffron Routes. The landing page at `http://localhost:4100` uses the default tenant.

See [the two-minute demo storyboard](docs/DEMO_SCRIPT.md) for the click path and optional remote demo notes.

## Tests

Backend suite:

```bash
cd velo-platform
./mvnw -B clean test -Dspring.datasource.url=jdbc:postgresql://localhost:5432/testpostgres_ep5 -Dvelo.test.flyway.url=jdbc:postgresql://localhost:5432/testpostgres_flyway_ep5 -Dspring.datasource.hikari.maximum-pool-size=2
```

Frontend checks run separately:

```bash
cd velo-frontend
npm ci
npx turbo lint --cache-dir=.turbo-local
npx turbo typecheck --cache-dir=.turbo-local
npx turbo test:unit --cache-dir=.turbo-local
npx turbo test:contracts --cache-dir=.turbo-local
npx turbo build --cache-dir=.turbo-local
PLAYWRIGHT_ADMIN_BASE_URL=http://127.0.0.1:4101 PLAYWRIGHT_RIDER_BASE_URL=http://127.0.0.1:4102 PLAYWRIGHT_DRIVER_BASE_URL=http://127.0.0.1:4103 npx playwright test
```

Remove `.turbo-local` after running the checks. More detail is in the [docs index](docs/README.md), [architecture](docs/ARCHITECTURE.md), and [deployment guide](docs/DEPLOYMENT.md).
