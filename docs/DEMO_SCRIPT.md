# Two-minute founder demo

## Before recording

Run `./scripts/demo-up.sh` and wait for the launcher to report that the portals and simulator are ready. It prints the active ports; the default portal ports are 4100–4103. Keep a Velo Business Admin tab at `http://default.localhost:<admin-port>/dispatch`, a Saffron Routes Admin tab at `http://saffron-routes.localhost:<admin-port>/dispatch`, and the rider and driver portals ready on the printed ports. All demo accounts use `password123`.

Open the simulator panel with `./scripts/demo-sim.sh open` and set the speed to `8×`. For a controlled presenter trip, choose `quiet` in the panel or run `./scripts/demo-sim.sh preset quiet`; this leaves two simulated drivers online and pauses automatic requests. The presenter drivers start offline, so leave them that way until the storyboard's Go online beat.

| Tenant | Admin | Rider | Driver |
|---|---|---|---|
| Velo Business | `admin@velo-platform.com` | `henry@example.com` | `bob.driver@example.com` |
| Saffron Routes | `owner@saffronroutes.demo` | `guest@saffronroutes.demo` | `chauffeur1@saffronroutes.demo` |

Use `default.localhost` for Velo Business and `saffron-routes.localhost` for Saffron Routes. Both hostnames work on the same portal ports.

## Storyboard

| Time | Click and say |
|---|---|
| 0:00–0:20 | Open both Admin Dispatch tabs. Point out the `Live fleet` map and its `Available`, `To pickup`, `On trip`, and `Waiting requests` counts. Show the different brand colors and labels: Rider/Driver/Trip versus Guest/Chauffeur/Transfer. Say that the moving background fleet is simulated demo traffic. |
| 0:20–0:40 | In the Velo Business driver portal, sign in as `bob.driver@example.com` and click `Go online`. This is a real availability change: presenter drivers start offline. |
| 0:40–1:00 | In the Velo Business rider portal, sign in as `henry@example.com`. Choose a pickup and destination on the map or enter the airport transfer route, review the estimate, and request the trip. |
| 1:00–1:20 | Return to the driver portal. Accept Henry's offer and show the rider name, pickup and drop-off addresses, and offer countdown. |
| 1:20–1:40 | Return to Henry's active trip to show the driver and route. Enter the rider OTP in the driver trip screen, start the trip, and show the in-progress state. |
| 1:40–2:00 | Return to Admin Dispatch. Show Henry's trip on the live map and the counts beside it, then the three seeded assignment-history rows in the audit table. Reopen Saffron Routes Dispatch to reinforce that the second fleet has its own brand and operations. |

The seeded active and completed trips, scheduled transfers, driver records, and payouts let the presenter move directly to those views if a live action takes longer than the recording slot.

## Simulated background fleet

`./scripts/demo-up.sh` starts the simulator from `packages/demo-sim`. It drives dedicated simulated drivers and riders through the public API, so the map, lists, and rider and driver apps agree. There are six simulated drivers and ten simulated riders per tenant. Simulated riders match only simulated drivers; real riders match only real drivers.

- The panel and `./scripts/demo-sim.sh status` show driver/rider states, active and completed trip counts, and the current speed. The default is `8×`; use `speed <n>` to change it during a recording.
- `quiet` keeps two drivers online and disables automatic requests. Use `steady` for the default moving fleet: short city trips under 15 km with a 10% airport share. `busy` uses the full fleet and a 25-second mean request interval with the same short-trip bias. Use `airport-rush` for an 80% airport share.
- To show a simulated trip, use the panel's `Request trip` action or run `./scripts/demo-sim.sh do request-trip default`. At the recommended `8×` speed, short city trips usually finish within the two-minute fleet beat.
- Use `./scripts/demo-sim.sh preset <quiet|steady|busy|airport-rush> [tenant]`, `set <tenant> <key> <value>`, or `do <action> [tenant] [key=value ...]`. Examples: `do decline-next default count=1`, `do traffic-delay default seconds=60`, and `do reset-fleet saffron-routes`.
- When no guest is idle, the panel and CLI show `All simulated guests are on transfers — try again in a moment`. Ten riders give each tenant room for overlapping transfers while its six drivers are busy.
- `reset-fleet` cancels pending, assigned, and in-progress bot trips through the rider API, then parks the fleet at hotspots. It reports any request it cannot close by rider and request id.
- The loopback-only control panel binds to `127.0.0.1` and does not require authentication. Open it with `./scripts/demo-sim.sh open`; the CLI reads its port from `.demo-runtime/sim.port`.
- Runtime config persists at `.demo-runtime/sim-state.json` across `demo-down` and the next `demo-up`. Run `VELO_DEMO_SIM=0 ./scripts/demo-up.sh` to start without bots.

## Optional Cloudflare Quick Tunnel

`cloudflared` is optional. To expose individual local apps for a temporary walkthrough, replace the example ports with the ports printed by the launcher, start one command per terminal, and share the generated `trycloudflare.com` URLs:

```bash
cloudflared tunnel --url http://localhost:4100
cloudflared tunnel --url http://localhost:4101
cloudflared tunnel --url http://localhost:4102
cloudflared tunnel --url http://localhost:4103
```

Quick Tunnel URLs are separate hostnames, so they use the configured default tenant. Showing multiple tenants remotely requires a named tunnel with host routing for each tenant subdomain; local `*.localhost` resolution is intended for the laptop demo.
