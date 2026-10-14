# 0016 — Short-lived WebSocket ticket authentication

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The BFF stores the backend JWT in an httpOnly cookie, but login responses also exposed it to browser JavaScript for STOMP authentication. A normal REST JWT grants broader access and lives longer than a WebSocket connection needs. WebSocket authentication must continue to identify the same user without making the access JWT readable by frontend code.

## Options considered

1. **Keep passing the access JWT to STOMP.**
   - Pros: no extra endpoint or token type.
   - Cons: exposes the long-lived REST credential to browser JavaScript.
2. **Issue a short-lived WebSocket-only ticket through the authenticated BFF.**
   - Pros: browser code receives only a 60-second credential that REST rejects.
   - Cons: adds a ticket request on every WebSocket connection and reconnect.

## Decision

We will keep the REST JWT in the httpOnly cookie and have the authenticated BFF request a 60-second WebSocket-only ticket for each STOMP connection. The STOMP interceptor accepts only that ticket type, while REST authentication rejects it.

## Consequences

- Login response bodies no longer expose the access JWT to JavaScript.
- Reconnects require a BFF request and briefly expose a narrowly scoped ticket to the browser.
- **Risks:** A stolen ticket can open a WebSocket connection until its 60-second expiry.

## Related

- Docs: `../FRONTEND_PLAN.md`, `../decisions/0010-stomp-websocket-notifications.md`
