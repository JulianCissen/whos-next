# Implementation Plan: Project Scaffolding (Unit 0)

**Branch**: `20260415-200718-project-scaffolding` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/20260415-200718-project-scaffolding/spec.md`

## Summary

Establish the complete project scaffold: a pnpm monorepo with three packages (`frontend`, `backend`, `shared`), a fully Dockerized local dev stack (Angular 21 + NestJS 11 + PostgreSQL 16), hot-reload via polling, enforced cross-package boundaries, Vitest unit testing for both packages, Playwright + axe-core e2e accessibility testing, runtime i18n (Dutch/English) via `@ngx-translate/core`, Angular Material (M3), and an initial empty MikroORM 7 baseline migration. No feature entities or business logic in this unit.

## Technical Context

**Language/Version**: TypeScript 5.x — Angular 21 (frontend), NestJS 11 (backend), TypeScript-only (shared)
**Primary Dependencies**: Angular 21, Angular Material (M3), @ngx-translate/core, NestJS 11, MikroORM 7, Vitest, Playwright, @axe-core/playwright, pnpm
**Storage**: PostgreSQL 16 (via MikroORM 7; initial empty baseline migration committed)
**Testing**: Vitest (unit — frontend and backend); Playwright + @axe-core/playwright (e2e + accessibility)
**Target Platform**: Docker containers (local dev); Cloudflare Pages (frontend, production); Railway single instance (backend, production)
**Project Type**: Web application — pnpm monorepo (3 packages: frontend, backend, shared)
**Performance Goals**: Dev stack fully healthy within 5 minutes of `docker compose up`; backend health check responds within 5 seconds of stack health
**Constraints**: Docker-only dev environment; polling-based file watching (CHOKIDAR_USEPOLLING=1 for NestJS; `--poll=2000` for Angular); single Railway instance; pnpm hoisting disabled; no auth
**Scale/Scope**: Single instance; lightweight — this unit delivers zero feature endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Monorepo with Shared Types** | ✅ COMPLIANT | This unit *establishes* the pnpm monorepo with `frontend`, `backend`, and `shared`. FR-001 and FR-002 directly enforce the boundary. hoisting disabled in `.npmrc`. |
| **II. Stateless URL-Based Access** | ✅ N/A | No feature endpoints introduced. Health check only. No auth, sessions, or tokens. |
| **III. Privacy by Design** | ✅ N/A | No PII collection, no fingerprinting, no data at all in scaffold. |
| **IV. Accessibility as a Hard Gate** | ✅ COMPLIANT | FR-009 requires Playwright + axe-core. SC-003 requires zero failures. Baseline accessibility test committed and passing. |
| **V. Simplicity / No Speculative Infrastructure** | ✅ COMPLIANT | All introduced dependencies (Angular, NestJS, MikroORM, Docker) are explicitly required. No Redis, no queue, no extra services. MikroORM migration tooling justified by FR-005 clarification session. |

**Complexity Tracking**: No violations requiring justification.

**Post-Design Re-check** (Phase 1): See bottom of this file — no new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/20260415-200718-project-scaffolding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── health.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
/                                    # Monorepo root
├── docker-compose.yml               # Orchestrates frontend, backend, postgres
├── Dockerfile                       # Multi-stage: base → frontend-dev → backend-dev → ...
├── .dockerignore
├── .gitignore
├── .npmrc                           # shamefully-hoist=false
├── pnpm-workspace.yaml              # packages: [frontend, backend, shared, e2e]
├── package.json                     # Root workspace scripts (dev, test, lint, etc.)
├── tsconfig.base.json               # Shared TS config extended by all packages
│
├── shared/
│   ├── package.json                 # name: "@whos-next/shared"
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # Re-exports all public types
│       └── health/
│           └── health-response.dto.ts  # HealthResponseDto interface
│
├── backend/
│   ├── package.json                 # name: "@whos-next/backend", deps: @whos-next/shared
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── mikro-orm.config.ts
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── health/
│       │   ├── health.controller.ts   # GET /health → HealthResponseDto
│       │   └── health.module.ts
│       └── database/
│           └── migrations/
│               └── Migration20260415000000_init.ts  # Empty baseline
│
├── frontend/
│   ├── package.json                 # name: "@whos-next/frontend", deps: @whos-next/shared
│   ├── tsconfig.json
│   ├── angular.json                 # poll: 2000 in serve options
│   ├── proxy.conf.json              # /api/* → http://backend:3000
│   ├── vite.config.ts               # Vitest config
│   └── src/
│       ├── main.ts
│       ├── app/
│       │   ├── app.component.ts
│       │   ├── app.component.html   # No hardcoded strings — all via translate pipe
│       │   ├── app.routes.ts
│       │   └── app.config.ts        # provideHttpClient, provideTranslate
│       ├── assets/
│       │   └── i18n/
│       │       ├── en.json          # English translation keys
│       │       └── nl.json          # Dutch translation keys
│       └── styles.scss              # Angular Material M3 theme import
│
└── e2e/
    ├── package.json                 # name: "@whos-next/e2e"
    ├── playwright.config.ts         # baseURL: http://localhost:4200
    └── tests/
        └── accessibility.spec.ts    # axe-core scan on placeholder page
```

**Structure Decision**: Web application layout (Option 2 variant) extended with a separate `e2e` package and a `shared` package at the root. The `e2e` package is declared in the pnpm workspace so its deps are managed consistently but isolated from frontend/backend.

---

## Constitution Check — Post-Design Re-evaluation

*Re-checked after Phase 1 design is complete. No new violations introduced.*

| Principle | Status | Design decision that confirms compliance |
|-----------|--------|------------------------------------------|
| **I. Monorepo with Shared Types** | ✅ COMPLIANT | `HealthResponseDto` lives in `shared/src/health/`; `frontend` and `backend` both list `@whos-next/shared` as their only cross-package dep; neither lists the other. Boundary enforced by `shamefully-hoist=false` + dependency graph. |
| **II. Stateless URL-Based Access** | ✅ N/A | Sole external surface is `GET /health`. No session, no token, no auth middleware. |
| **III. Privacy by Design** | ✅ N/A | No data entities, no user input, nothing persisted except the empty migration history row. |
| **IV. Accessibility as a Hard Gate** | ✅ COMPLIANT | `e2e/tests/accessibility.spec.ts` uses `@axe-core/playwright`; violations cause the test to fail (not warn). Committed as part of this unit. |
| **V. Simplicity / No Speculative Infrastructure** | ✅ COMPLIANT | 4 introduced services: Angular 21, NestJS 11, PostgreSQL 16, MikroORM 7 — all explicitly required by PRD §7.1. ngx-translate and Angular Material justified by FR-006/FR-007. No Redis, no queue, no extra services. `e2e` is a pnpm workspace package (no extra container). |
