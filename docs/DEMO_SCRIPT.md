# Two-minute founder demo

## Before recording

Run `./scripts/demo-up.sh` and use the printed ports. Keep one Velo Business Admin tab at `http://default.localhost:<admin-port>/dispatch`, one Saffron Routes Admin tab at `http://saffron-routes.localhost:<admin-port>/dispatch`, and the rider and driver portals ready on the printed ports. The default ports are 4100–4103. All accounts use `password123`.

| Tenant | Admin | Rider | Driver |
|---|---|---|---|
| Velo Business | `admin@velo-platform.com` | `henry@example.com` | `bob.driver@example.com` |
| Saffron Routes | `owner@saffronroutes.demo` | `guest@saffronroutes.demo` | `chauffeur1@saffronroutes.demo` |

Use `default.localhost` for Velo Business and `saffron-routes.localhost` for the second tenant. Each hostname works on the same portal ports.

## Storyboard

| Time | Click and say |
|---|---|
| 0:00–0:20 | Open the two Admin Dispatch tabs. Point out the Velo Business and Saffron Routes names, different primary colors, and different labels: Rider/Driver/Trip versus Guest/Chauffeur/Transfer. The records in each desk belong to that fleet. |
| 0:20–0:45 | In the Velo Business rider portal, sign in as `henry@example.com`. Choose pickup and destination on the map or enter the airport transfer route, review the estimate, and request the trip. |
| 0:45–1:10 | In the Velo Business driver portal, sign in as `bob.driver@example.com`, go online if prompted, and accept Henry's waiting trip. Show the assigned trip and the pickup OTP. |
| 1:10–1:35 | Return to the rider's active trip to show the driver and live route. Enter the rider's OTP in the driver trip screen, start the trip, and show the in-progress state. |
| 1:35–2:00 | Return to Admin Dispatch. Show Henry's active transfer and the seeded assignment history in the audit table. Explain that dispatch actions are recorded there, then reopen Saffron Routes Dispatch to reinforce that the second fleet keeps its own brand and operations. |

The seeded active and completed trips, upcoming transfers, driver records, and payouts let the presenter move directly to those views if a live action takes longer than the recording slot.

## Optional Cloudflare Quick Tunnel

`cloudflared` is optional. To expose individual local apps for a temporary walkthrough, replace the example ports with the ports printed by the launcher, start one command per terminal, and share the generated `trycloudflare.com` URLs:

```bash
cloudflared tunnel --url http://localhost:4100
cloudflared tunnel --url http://localhost:4101
cloudflared tunnel --url http://localhost:4102
cloudflared tunnel --url http://localhost:4103
```

Quick Tunnel URLs are separate hostnames, so they use the configured default tenant. Showing multiple tenants remotely requires a named tunnel with host routing for each tenant subdomain; local `*.localhost` resolution is intended for the laptop demo.
