# Two-minute founder demo

## Before recording

Run `./scripts/demo-up.sh` and use the printed ports. The launcher builds the production frontends before starting the portals, so allow the build to finish before opening the tabs. It also starts the fleet simulator and prints its control URL once the fleet is up. Keep one Velo Business Admin tab at `http://default.localhost:<admin-port>/dispatch`, one Saffron Routes Admin tab at `http://saffron-routes.localhost:<admin-port>/dispatch`, and the rider and driver portals ready on the printed ports. The default ports are 4100–4103. All accounts use `password123`.

Sign the presenter's driver in and take them online **before** the rider requests the trip, so the request is offered to that driver instead of a simulated one.

| Tenant | Admin | Rider | Driver |
|---|---|---|---|
| Velo Business | `admin@velo-platform.com` | `henry@example.com` | `bob.driver@example.com` |
| Saffron Routes | `owner@saffronroutes.demo` | `guest@saffronroutes.demo` | `chauffeur1@saffronroutes.demo` |

Use `default.localhost` for Velo Business and `saffron-routes.localhost` for the second tenant. Each hostname works on the same portal ports.

## Storyboard

| Time | Click and say |
|---|---|
| 0:00–0:20 | Open the two Admin Dispatch tabs. Point out the Velo Business and Saffron Routes names, different primary colors, and different labels: Rider/Driver/Trip versus Guest/Chauffeur/Transfer. The records in each desk belong to that fleet. The live fleet map is already moving: say plainly that the background fleet is simulated demo traffic. |
| 0:20–0:40 | In the Velo Business driver portal, sign in as `bob.driver@example.com` and go online. |
| 0:40–1:00 | In the Velo Business rider portal, sign in as `henry@example.com`. Choose pickup and destination on the map or enter the airport transfer route, review the estimate, and request the trip. |
| 1:00–1:20 | Back in the driver portal, accept Henry's waiting trip. Show the assigned trip and the pickup OTP. |
| 1:20–1:40 | Return to the rider's active trip to show the driver and live route. Enter the rider's OTP in the driver trip screen, start the trip, and show the in-progress state. |
| 1:40–2:00 | Return to Admin Dispatch. Show Henry's trip on the live fleet map with the counts beside it, then the seeded assignment history in the audit table. Explain that dispatch actions are recorded there, then reopen Saffron Routes Dispatch to reinforce that the second fleet keeps its own brand and operations. |

The seeded active and completed trips, upcoming transfers, driver records, and payouts let the presenter move directly to those views if a live action takes longer than the recording slot.

## Simulated background fleet

`./scripts/demo-up.sh` starts the fleet simulator from `packages/demo-sim`. It drives dedicated simulated drivers and riders through the public API, so the map, the lists, and the rider and driver apps all agree with each other.

- Simulated riders are only matched with simulated drivers, and real riders with real drivers, so the background fleet can never take the presenter's trip.
- Open the control panel with `./scripts/demo-sim.sh open`; it shows each tenant's bot states, counts, live events, presets, and runtime controls. The loopback-only panel does not require authentication.
- `./scripts/demo-sim.sh status` shows the live fleet. `pause` stops new simulated requests while trips already underway finish, `resume` restarts them, and `speed <n>` scales simulation time (1–20).
- Apply `preset <quiet|steady|busy|airport-rush> [tenant]` or update one value with `set <tenant> <key> <value>`. For example, `set default onlineDrivers 2` takes excess drivers offline after their current rides, and `set default requestIntervalSec 0` stops automatic requests.
- Direct a scene with `do <action> [tenant] [key=value ...]`. Examples: `do request-trip default from=itc-gardenia to=kia-t1`, `do decline-next default count=1`, `do traffic-delay default seconds=60`, and `do reset-fleet saffron-routes`. Available actions are `request-trip`, `burst`, `driver-offline`, `driver-online`, `decline-next`, `traffic-delay`, `rider-cancel`, `driver-cancel`, and `reset-fleet`.
- Runtime config is saved at `.demo-runtime/sim-state.json` and restored after `demo-down` and the next `demo-up`. The launcher resets simulated rides and driver availability in the local database on startup.
- Start without it by running `VELO_DEMO_SIM=0 ./scripts/demo-up.sh`.
- The map's side panel reports how many simulated drivers are online. Mention it when the fleet is on screen — it is a simulator, not a second fleet of staff.
- The simulated accounts (`driver1@sim.velobusiness.demo`, `chauffeur1@sim.saffronroutes.demo`, …) use `password123` too, if you want to sign in as one and show the driver side of the background fleet.

## Optional Cloudflare Quick Tunnel

`cloudflared` is optional. To expose individual local apps for a temporary walkthrough, replace the example ports with the ports printed by the launcher, start one command per terminal, and share the generated `trycloudflare.com` URLs:

```bash
cloudflared tunnel --url http://localhost:4100
cloudflared tunnel --url http://localhost:4101
cloudflared tunnel --url http://localhost:4102
cloudflared tunnel --url http://localhost:4103
```

Quick Tunnel URLs are separate hostnames, so they use the configured default tenant. Showing multiple tenants remotely requires a named tunnel with host routing for each tenant subdomain; local `*.localhost` resolution is intended for the laptop demo.
