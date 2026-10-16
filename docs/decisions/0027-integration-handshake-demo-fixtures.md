# 0027 — Integration handshake drives the local demo fixture profile

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

The `Frontend Backend Integration` workflow runs `velo-frontend/tests/integration/handshake.mjs` against the compose stack in `velo-frontend/docker-compose.e2e.yml`, which boots the backend on its default (`local`) profile. That profile seeds demo fixtures and then rewrites them on every startup (`DemoFixtureTimestampRefresher`) so a demo always starts from a known, quiet state: every presenter driver offline, one pending request offered to a presenter driver per fleet, and no dispatch-audit history.

The handshake asserts operator flows that need more than that starting state — a manual dispatch assignment requires an *available*, approved driver, a rider booking stays `PENDING` only while a driver can be matched, and the restart pass exists precisely to observe a mutation across a restart. Against the raw fixture state those assertions either fail (409 on assignment/booking) or become meaningless (the mutation is erased by the startup repair).

## Options considered

1. **Loosen the fixtures (seed a driver online, drop the repair on restart).**
   - Pros: the handshake needs no arrangement step.
   - Cons: changes the demo's rehearsed starting state and removes the self-healing that keeps demos reproducible.
2. **Let the smoke container arrange its own preconditions.**
   - Pros: fixtures stay intact; the handshake exercises the real operator path (driver goes online, then dispatch assigns).
   - Cons: the test needs to know which seeded accounts to use, and one extra driver identity.

## Decision

We will keep the demo fixtures as the demo needs them and have the handshake arrange its own preconditions: it signs in as a seeded presenter driver and takes them online before an assignment or a booking, books with a rider that has no active request, cancels that request again so the checks stay repeatable, and asserts the JWT stays out of the login response body. The workflow's restart pass sets `VELO_DEMO_FIXTURE_REFRESH=false` (backed by `app.demo.fixture-refresh-enabled`, both defaulting to the demo behaviour) so the fixture repair cannot erase the mutation it is about to verify.

## Consequences

- The handshake now proves the same flows a presenter performs instead of relying on a fixture accident.
- The driver-app checks sign in as an approved seeded driver (`bob.driver@example.com`); the seeded PENDING applicant (`eve.driver@example.com`) cannot go online, so it is not used.
- The demo self-healing remains on for everyone else; only the restart pass of the handshake turns it off.
- **Risks:** the handshake depends on seeded account emails; renaming them requires updating the compose env values. Reintroducing a login body token, seeding a driver online, or pointing the driver checks at an unapproved account would silently weaken these checks, so the expectations are asserted explicitly.

## Related

- Docs: `../DEPLOYMENT.md`, `../../velo-frontend/docker-compose.e2e.yml`
- Commits: —
