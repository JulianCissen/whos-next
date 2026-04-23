# whos-next Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-22

## Active Technologies
- TypeScript 5.9.3 across all packages. (20260421-173419-member-queue)
- PostgreSQL 16. Two new tables (`members`, `occurrence_assignments`) and one column addition (`next_index` on `rotations`). Introduced via `Migration20260421000002_members`. (20260421-173419-member-queue)
- TypeScript 5.9.3 — Angular 21 (frontend), NestJS 11 (backend), TypeScript-only (shared) + Angular Material M3, @ngx-translate/core (frontend); NestJS 11, MikroORM 7 (backend); no new external packages (20260422-170340-schedule-occurrence-view)
- PostgreSQL 16 — 2 new tables (`schedules`, `schedule_dates`); no structural changes to existing tables (20260422-170340-schedule-occurrence-view)

- TypeScript 5.9.3 — Angular 21 (frontend), NestJS 11 (backend), TypeScript-only (shared)
- Angular 21, Angular Material (M3), @ngx-translate/core
- NestJS 11, MikroORM 7, PostgreSQL 16
- Vitest, Playwright, @axe-core/playwright
- pnpm 10, Node 24

## Project Structure

```text
apps/
  backend/    — NestJS API (port 3000, /api prefix, /health excluded)
  frontend/   — Angular SPA (port 4200, proxies /api to backend)
  e2e/        — Playwright end-to-end tests
packages/
  shared/     — Shared TypeScript types (DTOs, interfaces)
```

## Commands

```sh
pnpm run lint          # ESLint across the monorepo
pnpm run test          # All tests via dev.sh
pnpm run dev           # Start Docker dev environment
```

## Sign-off Checklist

Before signing off on any change, verify:

1. **No type errors** — zero TypeScript compiler errors across all affected packages.
2. **No lint errors or warnings** — zero ESLint errors and warnings across all affected files.

## Code Style

- ESLint 9 flat config (`eslint.config.mjs`) at monorepo root
- Prettier for formatting (`prettier.config.mjs`)
- See `.github/instructions/` for scoped AI rules

## Recent Changes
- 20260422-170340-schedule-occurrence-view: Added TypeScript 5.9.3 — Angular 21 (frontend), NestJS 11 (backend), TypeScript-only (shared) + Angular Material M3, @ngx-translate/core (frontend); NestJS 11, MikroORM 7 (backend); no new external packages
- 20260421-173419-member-queue: Added TypeScript 5.9.3 across all packages.

- 20260418-195008-rotation-lifecycle: Added `Rotation` entity (slug-addressed, no-auth), `/api/rotations` REST endpoints (create / get / rename / delete), slug generator (`node:crypto` + base-58 rejection sampling), DB-level collision detection via `UNIQUE`, conditional 24-hour last-access throttle, Angular routes `''` (landing) and `':slug'` (rotation page) with Material 3 typed-name delete dialog and `MatSnackBar` deletion toast.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
