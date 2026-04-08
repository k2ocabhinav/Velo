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
| [BRANCHING.md](BRANCHING.md) | Branch naming, merge rules, parallel agent work |
| [PROGRESS.md](PROGRESS.md) | Shared checklist — what's done, what's not |
| [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md) | Dependency vulnerability tracking and remediation policy |

## How To Use

- **Starting fresh?** Read `PRODUCT_VISION.md` then `ARCHITECTURE.md`.
- **Building backend?** Read `ARCHITECTURE.md` for conventions, `SWAGGER.md` for API surface.
- **Building frontend?** Read `DESIGN_SYSTEM.md` first, then `FRONTEND_PLAN.md`.
- **Deploying?** Read `DEPLOYMENT.md`.
- **Checking progress?** Read `PROGRESS.md`.
- **Creating a branch?** Read `BRANCHING.md`.

## Current State

- Backend: 158 tests passing, BUILD SUCCESS
- Frontend: Turborepo monorepo with admin/rider/driver API-backed flows, explicit session logout controls, and full frontend-connected integration handshake coverage. See `PROGRESS.md` for details.
