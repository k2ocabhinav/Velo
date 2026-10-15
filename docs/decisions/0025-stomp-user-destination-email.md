# 0025 — STOMP user destinations are keyed by email

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Per-user push uses Spring's `/user/**` destinations (0010) and authenticates sessions with a WebSocket ticket whose subject is the user's email (0016). The simple broker keys user destinations by the STOMP session principal name, and `UserPrincipal#getName()` returns that email. `RideRealtimeServiceImpl` published rider ride updates with the user *id* (`convertAndSendToUser(userId.toString(), …)`), so `/user/{userId}/queue/ride-updates` matched no session: driver-location and status events for the rider's active trip were dropped, and the rider map silently fell back to polling. Notifications were unaffected because `NotificationServiceImpl` already sent to `user.getEmail()`.

## Options considered

1. **Send to the email at each call site.**
   - Pros: no new type.
   - Cons: the convention lives in memory; it was already broken once.
2. **One small shared helper, `UserDestinations.resolve(user)`, returning the email.**
   - Pros: the contract is stated once and shared by every publisher.
   - Cons: an indirection for a one-line lookup.
3. **Key sessions by user id instead** (change `UserPrincipal#getName()`).
   - Pros: ids are stable and not user-editable.
   - Cons: changes session identity for every WebSocket client and the ticket claims of 0016, for no present benefit.

## Decision

We will resolve every user destination through `com.velo.platform.utils.UserDestinations`, which returns the email so it matches `UserPrincipal#getName()`. `RideRealtimeServiceImpl` and `NotificationServiceImpl` both use it, and a publisher with no email sends nothing.

## Consequences

- Rider ride updates and notifications reach the subscribed session; the active-trip map updates without polling.
- Destination names are covered by unit tests for every event type and by a WebSocket integration test that connects a real STOMP client through the ticket flow.
- **Risks:** the email is the routing key, so every session of an account receives the event (intended — it is how two devices are reached); if the principal name ever changes, `UserPrincipal` and `UserDestinations` must change together.

## Related

- Docs: [`0010-stomp-websocket-notifications.md`](0010-stomp-websocket-notifications.md), [`0016-websocket-ticket-auth.md`](0016-websocket-ticket-auth.md)
