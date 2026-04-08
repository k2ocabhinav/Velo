# Velo — Product Vision

## What Is Velo?

Velo is a **white-label dispatch platform**. It is infrastructure that lets any business run their own branded ride, shuttle, or delivery service.

A hospital signs up and gets patient transport. A university gets a campus shuttle. A courier company gets modern dispatch. A restaurant chain gets their own delivery fleet. Each customer (tenant) gets their own drivers, their own customers, their own fare rules, their own admin dashboard — all powered by the same engine.

**Velo is not a ride-hailing app.** It is the engine that powers them — for other businesses.

## The Name

"Velo" comes from "velocity" — swift, purposeful movement. Short, clean, international.

- Package: `com.velo.platform`
- Maven: `com.velo:velo-platform`
- Tagline idea: *"Velocity, simplified."*

## Who Is It For?

| Customer Type | What They Get |
|---|---|
| Hospitals / healthcare systems | Patient transport scheduling, vehicle capability matching, compliance logging |
| Universities / corporate campuses | Campus shuttle with fixed routes or on-demand rides, subsidized (free) fares |
| Courier / delivery companies | Package dispatch, proof of delivery, driver fleet management |
| Ride-hailing startups | Full ride-hailing service without building the backend from scratch |
| Any business with a fleet | Configurable dispatch, matching, fare rules, and driver management |

## Product Roadmap

### Phase 1: Rebrand
Remove all "Uber clone" identity. New package names, new repo, fresh git history. No new features — just a clean identity. See [REBRAND_PLAN.md](REBRAND_PLAN.md).

### Phase 2: Multi-Tenancy
The core architectural change. Every entity gains a `tenant_id`. Each API request is scoped to a tenant. Tenants are isolated.

Key additions:
- `Tenant` entity (id, name, slug, config, active, createdTime)
- Tenant-aware security filter (extract tenant from JWT or subdomain)
- All repositories gain tenant scoping
- Per-tenant configuration: fare rules, matching strategies, branding
- Tenant admin role (distinct from platform super-admin)

### Phase 3: Configurable Dispatch
Extend the strategy pattern so each tenant can configure:
- Fare calculation: flat rate, per-km, zone-based, free/subsidized
- Driver matching: nearest, highest-rated, round-robin, manual assignment
- Surge pricing: enable/disable, custom rules
- Vehicle types: sedan, van, wheelchair-accessible, bike courier

### Phase 4: Frontend & API
- OpenAPI spec becomes the product interface
- Tenant admin dashboard (web) — manage fleet, view analytics, configure
- Driver app (mobile-first) — accept rides, navigate, track earnings
- Customer app — book rides, track driver, pay

### Phase 5: Vertical Expansions
Each vertical is a configuration of the same platform:

**NEMT (Non-Emergency Medical Transportation):**
- Scheduled medical rides with recurring templates (dialysis 3x/week)
- Vehicle capability matching (wheelchair, stretcher, oxygen)
- Insurance billing integration (authorization codes replace promo codes)
- Trip attestation for compliance (pickup/dropoff timestamps + signatures)
- Coordinator role (hospital staff books on behalf of patients)

**Campus Shuttles:**
- Fixed routes with timetables
- Free rides (subsidized by institution)
- Geofenced service areas

**Last-Mile Delivery:**
- Package dispatch with proof of delivery
- Merchant dashboard
- Multi-stop optimization

## What Already Exists

The codebase is a **fully working Spring Boot 3.3.1 / Java 22 backend** with:

- Ride lifecycle (request -> accept with OTP -> start -> end -> payment)
- Strategy-based driver matching (nearest, highest-rated)
- Strategy-based fare calculation (default, surge pricing)
- Cash and wallet payment strategies
- Promo code engine (flat/percentage discounts, usage limits, admin CRUD)
- Scheduled rides with auto-dispatch
- Real-time WebSocket notifications (STOMP/SockJS) + persistent history
- Driver earnings dashboard with payout system
- Admin panel (stats, revenue, driver approval, payout management)
- JWT authentication, role-based access (RIDER, DRIVER, ADMIN)
- PostgreSQL + PostGIS for geospatial queries
- 158 tests passing (unit + integration)

This is a strong foundation. The platform already has the hard parts — real-time dispatch, matching strategies, payment processing, scheduling. Multi-tenancy and configuration are the main additions needed.
