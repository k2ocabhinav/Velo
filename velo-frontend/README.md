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
npm run typecheck
npm run start
```

## Apps

- Admin: `http://localhost:3000`
- Rider: `http://localhost:3001`
- Driver: `http://localhost:3002`

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
