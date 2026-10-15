# Velo demo fleet simulator

`@velo/demo-sim` runs dedicated rider and driver accounts through Velo's local REST and STOMP APIs. Drivers move along the checked-in Bengaluru OSRM route catalogue; requests, offers, ride lifecycle, payments, and rider updates use the same backend paths as the demo portals. The admin Dispatch map reads the resulting backend locations.

## Safety

The simulator fails closed unless `VELO_SIM_ALLOW=1`, the API host is loopback (`localhost`, `127.0.0.1`, `::1`, or `*.localhost`), and tenants are `default` or `saffron-routes`. It checks each account's logged-in role, email, and tenant before starting fleet traffic. The matching service only pairs simulated riders with simulated drivers.

The control panel binds to `127.0.0.1` and has no authentication because it is loopback-only. Do not expose its port or point the simulator at a shared or production API. Simulated accounts use `password123` in the local demo.

## Start and stop

From the repository root, run `./scripts/demo-up.sh`. It starts the backend, portals, and simulator; the launcher waits until all 20 accounts have logged in and the fleet is ready. The default simulator speed is 4×. Set `VELO_DEMO_SIM=0` to run the portals without bots.

The simulator can also be started directly from this package:

```sh
VELO_SIM_ALLOW=1 node src/main.ts --api http://localhost:8080 --control-port 8790 --speed 4
```

Options are `--api`, `--control-port`, `--seed`, `--speed` (1–20), `--paused`, `--state-file`, and `--tenants` (`default,saffron-routes`). Use `node src/main.ts --help` for the defaults. `./scripts/demo-down.sh` stops the simulator first and keeps its persisted configuration for the next launch.

## Control panel and CLI

Open the panel with `./scripts/demo-sim.sh open` or visit the printed loopback URL. It shows per-tenant bot state and trip counts, editable configuration, presets, actions, and the live event log. The CLI reads the active port from `.demo-runtime/sim.port`:

```sh
./scripts/demo-sim.sh status
./scripts/demo-sim.sh pause
./scripts/demo-sim.sh resume
./scripts/demo-sim.sh speed 4
./scripts/demo-sim.sh preset airport-rush saffron-routes
./scripts/demo-sim.sh set default onlineDrivers 2
./scripts/demo-sim.sh set default requestIntervalSec 0
./scripts/demo-sim.sh set default pickupWaitSec '[15,30]'
./scripts/demo-sim.sh set default hotspots '["kia-t1","itc-gardenia"]'
./scripts/demo-sim.sh do request-trip default from=itc-gardenia to=kia-t1
./scripts/demo-sim.sh do burst saffron-routes count=3 near=oberoi
./scripts/demo-sim.sh do decline-next default count=1
```

`set` accepts global keys `paused`, `speedFactor`, and `seed`, plus tenant keys `onlineDrivers` (0–6), `requestIntervalSec` (0 or 10–900), `airportShare` (0–1), `declineProbability` (0–1), `pickupWaitSec` ([min,max], 5–300 seconds), `idleRepositionProbability` (0–1), and `hotspots` (JSON array of POI ids). Config changes apply immediately and persist atomically to `.demo-runtime/sim-state.json` across `demo-down` and `demo-up`.

Presets can target one tenant or both: `quiet` keeps two drivers online and disables automatic requests; `steady` restores the baseline; `busy` uses the full fleet with a 25-second mean request interval; `airport-rush` weights airport trips and hotspots.

Actions are `request-trip` (`from`, `to`, `rider`), `burst` (`count` 2–8, `near`), `driver-offline` / `driver-online` (`driver`), `decline-next` (`count` 1–5), `traffic-delay` (`driver`, `seconds` 10–600), `rider-cancel` (`rideRequestId`), `driver-cancel` (`rideId`), and `reset-fleet`. Omit the optional tenant to use `default`; omit optional action fields for a random eligible bot or POI. `rider-cancel` cancels either a still-pending request or an assigned ride through the rider API. `driver-cancel` returns a clear conflict when no assigned ride can be cancelled.

## Troubleshooting

- If startup refuses to run, check the allow flag, API loopback URL, tenant list, and that the API seeds the simulator accounts.
- If `demo-up` reports simulator startup failure, inspect `.demo-runtime/sim.log` and confirm the configured API port is healthy before retrying.
- If a control action returns 409, check `/status`: its rider or driver may already be busy, offline, or no longer own that request.
- If the map is empty, confirm the sim is ready, drivers are online, and `GET /api/v1/admin/dispatch/live` succeeds for the tenant admin.
- If the panel is unreachable, check the port printed by `demo-up`; the CLI reads it from `.demo-runtime/sim.port`.
