# Velo Frontend

This workspace holds the Velo frontend monorepo scaffold.

## Structure

- `apps/admin` - phase 1 admin app
- `apps/rider` - rider shell
- `apps/driver` - driver shell
- `packages/*` - shared packages to be added alongside the apps

## Prerequisites

- Node 22+
- npm 11+
- Backend API running with CORS enabled for local frontend origins

## Setup

```bash
cd velo-frontend
npm install
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:contracts
npm run test:e2e
npm run start
```

## Quality Gates

- `npm run lint` - ESLint across the workspace
- `npm run test:unit` - workspace unit tests via Turbo
- `npm run test:contracts` - backend handshake and API contract checks
- `npm run test:e2e` - Playwright smoke test for the admin shell

`npm run test` runs all of the above in sequence.

The backend handshake contracts use `VELO_API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` when set. If neither is set, the contract suite skips cleanly so local UI work remains usable without the backend.

## Apps

- Admin: `http://localhost:4101`
- Rider: `http://localhost:4102`
- Driver: `http://localhost:4103`

## Environment

The admin app expects a backend base URL for auth proxying:

- `VELO_API_BASE_URL`
- fallback: `NEXT_PUBLIC_API_BASE_URL`

## Current State

This branch starts the frontend foundation:

- workspace metadata
- admin app shell with protected routes
- login BFF proxy
- rider and driver placeholder shells
