# Velo — Documentation Index

Single source of truth for the Velo project.

## Core

| Document | Purpose |
|---|---|
| [PRODUCT_VISION.md](PRODUCT_VISION.md) | What Velo is, who it's for, and where it's going |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Codebase structure, patterns, conventions, database setup |
| [SWAGGER.md](SWAGGER.md) | API inventory — 60 endpoints across 8 groups |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local dev, Docker Compose, AWS production architecture |

## Frontend

| Document | Purpose |
|---|---|
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Visual language, theming architecture, animations, loading states, accessibility |
| [FRONTEND_PLAN.md](FRONTEND_PLAN.md) | Tech stack, monorepo structure, build phases, auth flow, WebSocket |

## Process

| Document | Purpose |
|---|---|
| [BRANCHING.md](BRANCHING.md) | Branch naming, merge rules, parallel work |
| [PROGRESS.md](PROGRESS.md) | Shared checklist — what's done, what's not |
| [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md) | Dependency vulnerability tracking and remediation policy |
| [ADMIN_DEMO_SCRIPT.md](ADMIN_DEMO_SCRIPT.md) | Step-by-step demo for dispatch race, persistence, and ops health |

## Decisions

| Document | Purpose |
|---|---|
| [decisions/README.md](decisions/README.md) | Decision ledger — what an ADR is, the rules, the template, and the index of decisions |

## How To Use

- **Starting fresh?** Read `PRODUCT_VISION.md` then `ARCHITECTURE.md`.
- **Building backend?** Read `ARCHITECTURE.md` for conventions, `SWAGGER.md` for API surface.
- **Building frontend?** Read `DESIGN_SYSTEM.md` first, then `FRONTEND_PLAN.md`.
- **Deploying?** Read `DEPLOYMENT.md`.
- **Checking progress?** Read `PROGRESS.md`.
- **Asking "why is it built this way?"** Read `decisions/`.
- **Creating a branch?** Read `BRANCHING.md`.
- **Preparing an admin demo?** Read `ADMIN_DEMO_SCRIPT.md`.

## Current State

- Backend: Spring Boot 3.3.1 / Java 22 on PostgreSQL + PostGIS, 197 tests passing.
- Frontend: Turborepo monorepo (landing, admin, requester, driver) with shared packages and cookie-based BFF auth.
- Multi-tenant foundations are in place (tenant scoping + branding); production AWS deployment is not yet provisioned.
- See `PROGRESS.md` for what's done and `decisions/` for why it's built that way.

## Documentation Rules

- Living docs are edited **in place**; superseded text is deleted (git keeps history).
- Keep each doc under **200 lines**.
- Decisions go in the [decision ledger](decisions/README.md), never in prose docs.
- Progress goes **only** in `PROGRESS.md`.
- Never append dated "status update" or "snapshot" blocks to any doc.
