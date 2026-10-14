# 0010 — STOMP over SockJS for real-time updates

- **Status:** Accepted (backfilled)
- **Date:** 2026-04-07

## Context

Riders and drivers need live push—new ride requests, ride status changes, driver location—without polling. The backend must also persist notifications so a user who was offline can still see them.

## Options considered

1. **HTTP polling** — Pros: simplest. Cons: latency and unnecessary load; no true push.
2. **Raw WebSocket** — Pros: full control. Cons: no messaging semantics; hand-rolled routing and auth.
3. **Spring WebSocket with STOMP over SockJS and the native client (`@stomp/stompjs`)** — Pros: per-user destinations and built-in semantics; documented rationale: "Spring Boot uses STOMP over SockJS. Using the native protocol client avoids translation layers." Cons: reconnect/resubscribe handling is on the client.
4. **Socket.io on the frontend** — rejected: it would require a translation layer to talk to STOMP.

## Decision

Use Spring WebSocket (STOMP over SockJS at `/ws`) with the JWT supplied in `connectHeaders`. Services publish events; a listener persists each `Notification` and pushes to per-user destinations (`/user/queue/notifications`, `/user/queue/ride-updates`). The frontend uses `@stomp/stompjs` + `sockjs-client` with a subscription registry for reconnect safety.

## Consequences

- Real-time push with persisted history and typed events.
- **Risks:** reconnection correctness (mitigated by the subscription registry and a REST refresh fallback); cross-instance delivery needs Redis pub/sub at scale.

## Related

- Docs: [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md)
- Commits: `499fbc3`, `6d3a004`, `9d65d3c`
