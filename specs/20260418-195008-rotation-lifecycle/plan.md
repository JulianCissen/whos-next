# Implementation Plan: Rotation Lifecycle (Create, Rename, Delete)

**Branch**: `001-rotation-feature-creation` | **Date**: 2026-04-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/20260418-195008-rotation-lifecycle/spec.md`

## Summary

Deliver the rotation entity lifecycle: create a rotation by name and receive an 8-character base-58 cryptographically random slug that serves as the rotation's sole identifier and shareable URL; view a rotation via its slug; rename it (slug unchanged); and permanently delete it behind a typed-name confirmation. No accounts, no sessions — the slug is the access credential.

**Technical approach.** Introduce a `rotations` backend domain (NestJS controller + service + MikroORM entity) with four endpoints under `/api/rotations`: create, get, rename, delete. Slug generation uses Node's `crypto.randomBytes` + rejection sampling over the Bitcoin base-58 alphabet to yield 8 uniformly random characters; collisions are detected by a `UNIQUE` constraint on `slug` and retried up to 5 times before failing. A `lastAccessedAt` column is updated on read or write, throttled to at most once per rotation per 24 hours by comparing the persisted timestamp to `NOW() - interval '24 hours'` in a single conditional `UPDATE`. The frontend gets two lazy-loaded routes — `''` (landing/create form) and `:slug` (rotation page) — with a Material 3 typed-name confirmation dialog for delete. Shared DTOs and the `slug` validator regex live in `@whos-next/shared`. A generated MikroORM migration introduces the `rotations` table (post-stabilisation phase — baseline migration already exists).

## Technical Context

**Language/Version**: TypeScript 5.9.3 across all packages (frontend, backend, shared).
**Primary Dependencies**:
- Backend: NestJS 11, MikroORM 7 (decorator-less `defineEntity` API), `class-validator`, `class-transformer`, Node `node:crypto` (no third-party base58 library — custom encoder is ~20 lines).
- Frontend: Angular 21 (standalone, zoneless, OnPush), Angular Material (M3), `@ngx-translate/core`, `@angular/common/http`.
- Shared: pure TypeScript interfaces and a base58 alphabet constant + regex.

**Storage**: PostgreSQL 16. New table `rotations` with columns `id uuid pk`, `slug text unique not null`, `name text not null`, `created_at timestamptz not null default NOW()`, `updated_at timestamptz not null default NOW()`, `last_accessed_at timestamptz not null default NOW()`. Introduced via a generated MikroORM migration.

**Testing**:
- Backend unit: Vitest against the slug generator, name validator, and service pure methods.
- Backend integration: Vitest + Testcontainers (`postgres:16-alpine`) against the REST endpoints end-to-end through the Nest test module.
- Frontend unit/component: Vitest + Angular testing harness for the create form, rotation page, share banner, and delete dialog.
- E2E + a11y: Playwright + `@axe-core/playwright` covering the four acceptance flows (create, view, rename, delete) and asserting zero axe violations.
- API manual: Bruno collection under `apps/backend/bruno/rotations/`.

**Target Platform**: Backend on Node 24 in Docker (Railway single instance in prod). Frontend is a CSR Angular bundle served by Cloudflare Pages. Browsers: current evergreen desktop + mobile.

**Project Type**: Web application (monorepo: `apps/frontend`, `apps/backend`, `apps/e2e`, `packages/shared`).

**Performance Goals**:
- p95 < 100 ms for rotation GET by slug at single-instance scale (< 50 RPS realistic ceiling for v1).
- SC-001: user reaches a shareable link in under 15 seconds with two interactions — measured on a cold-cached load against Cloudflare Pages.

**Constraints**:
- No PII may be stored. Last-access throttle is DB-column-based (no external cache).
- Base-58 alphabet is **Bitcoin base-58** (excludes `0`, `O`, `I`, `l`). Case-sensitive lookups (FR-014a).
- Rate limiting (PRD §5.2) is handled by a project-wide guard in a later unit — not this feature. However, a clear 429 response shape is reserved in the contract.
- Single backend instance; no horizontal scaling assumptions.

**Scale/Scope**:
- Target: up to ~10,000 active rotations in v1 (collision probability remains negligible at 58^8 ≈ 1.28 × 10^14).
- 4 REST endpoints, 1 entity, 1 migration, 2 frontend routes, 1 shared DTO file, ~7 Bruno requests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Compliance |
|---|---|---|
| I | Monorepo with Shared Types as the Contract Boundary | **PASS** — All DTOs (`CreateRotationRequestDto`, `RotationResponseDto`, `RenameRotationRequestDto`) live in `packages/shared/src/rotations/`. Backend and frontend consume them via `@whos-next/shared`. Neither app imports from the other. |
| II | Stateless URL-Based Access Model | **PASS** — The slug is the sole identifier (FR-009). No sessions, cookies, or auth middleware are introduced. Any bearer of the slug has full management access. |
| III | Privacy by Design | **PASS** — No PII stored. Rotation names are free-text display strings with no identity binding. No IPs, user-agents, or fingerprints are persisted by this feature. |
| IV | Accessibility as a Hard Gate | **PASS** — All new UI (create form, rotation page, share banner, delete dialog, deletion toast) uses Angular Material M3 components. Playwright + axe-core e2e tests assert zero violations on all four user flows. The delete-confirmation typed-name field has an associated visible label and `aria-describedby` wired to the irreversibility warning. The deletion toast uses an ARIA live region via `MatSnackBar` (FR-023a). |
| V | Simplicity and No Speculative Infrastructure | **PASS** — No new external services. Slug generation is ~20 lines using Node built-ins. Last-access throttling is a single conditional SQL `UPDATE`, not a cache layer. No ownership/auth layer is introduced. |

**Gate result: PASS.** No Complexity Tracking entries required. Re-evaluated after Phase 1 design — no new violations introduced by the contracts, data model, or quickstart artifacts.

## Project Structure

### Documentation (this feature)

```text
specs/20260418-195008-rotation-lifecycle/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature spec (/speckit.specify + /speckit.clarify output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── rotations-api.md # Phase 1 output — REST contract for /api/rotations
├── checklists/
│   └── requirements.md  # /speckit.specify output
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── base-entity.ts                         # (new) shared BaseEntity — id/createdAt/updatedAt
│   │   │   └── slug/
│   │   │       ├── slug.generator.ts                  # (new) cryptographically random base-58 generator
│   │   │       └── slug.generator.spec.ts             # (new) unit tests — alphabet, length, uniformity
│   │   ├── rotations/
│   │   │   ├── rotation.entity.ts                     # (new) defineEntity — slug, name, timestamps
│   │   │   ├── rotations.module.ts                    # (new)
│   │   │   ├── rotations.controller.ts                # (new) POST /api/rotations, GET/PATCH/DELETE /api/rotations/:slug
│   │   │   ├── rotations.service.ts                   # (new) create/find/rename/delete + last-access throttle
│   │   │   ├── rotations.service.spec.ts              # (new) service unit tests (mocked EM)
│   │   │   ├── rotations.controller.integration.spec.ts # (new) e2e via Testcontainers
│   │   │   └── dto/
│   │   │       ├── create-rotation.dto.ts             # (new) class-validator wrapper around shared DTO
│   │   │       └── rename-rotation.dto.ts             # (new) class-validator wrapper
│   │   ├── database/migrations/
│   │   │   └── Migration<TS>_rotations.ts             # (new) generated via mikro-orm migration:create
│   │   └── app.module.ts                              # (modified) register RotationsModule
│   ├── seeders/
│   │   ├── RotationSeeder.ts                          # (new) populates test rotations with varied names/ages
│   │   └── DatabaseSeeder.ts                          # (new) root seeder dispatch
│   └── bruno/
│       └── rotations/                                 # (new) create.bru, get.bru, rename.bru, delete.bru + error variants
├── frontend/
│   └── src/app/
│       ├── core/
│       │   ├── api/
│       │   │   ├── rotations.api.ts                   # (new) typed HttpClient wrappers
│       │   │   └── rotations.api.spec.ts              # (new)
│       │   └── i18n/assets/
│       │       ├── en.json                            # (modified) strings for create/rotation/delete
│       │       └── nl.json                            # (modified) Dutch translations
│       ├── features/
│       │   ├── landing/
│       │   │   ├── landing.page.ts                    # (new) standalone, OnPush — create form + recent-toast
│       │   │   ├── landing.page.html
│       │   │   ├── landing.page.spec.ts
│       │   │   └── create-rotation-form.component.ts  # (new) mat-form-field, name input, submit
│       │   └── rotation/
│       │       ├── rotation.page.ts                   # (new) standalone — loads by slug, inline rename, share banner
│       │       ├── rotation.page.html
│       │       ├── rotation.page.spec.ts
│       │       ├── share-link-banner.component.ts     # (new) first-view banner w/ copy-to-clipboard
│       │       └── delete-rotation-dialog.component.ts# (new) MatDialog w/ typed-name confirmation
│       └── app.routes.ts                              # (modified) lazy ''  → landing; ':slug' → rotation; '**' → not-found
├── e2e/
│   └── tests/
│       ├── rotation-create.spec.ts                    # (new) create + receive link + reload
│       ├── rotation-view.spec.ts                      # (new) view + not-found for unknown/malformed/deleted
│       ├── rotation-rename.spec.ts                    # (new)
│       ├── rotation-delete.spec.ts                    # (new) typed confirmation, toast, not-found after
│       └── a11y.spec.ts                               # (modified) axe-core scans of all four pages/dialogs
└── packages/shared/
    └── src/
        ├── rotations/
        │   └── index.ts                               # (new) DTOs + SLUG_REGEX + slug validator
        └── index.ts                                   # (modified) re-export rotations
```

**Structure Decision**: Web application (monorepo). The layout above matches the existing `apps/` + `packages/` scaffold (see `CLAUDE.md`, `pnpm-workspace.yaml`). The backend adds a `rotations/` domain folder per the decorator-less, domain-per-folder convention established in `backend/CLAUDE.md`. The frontend adds `features/landing/` and `features/rotation/` per Angular's standalone-route convention; both routes are `loadComponent`-lazy per the zero-AppModule standard (`frontend/CLAUDE.md`).

## Complexity Tracking

*No Constitution violations. Section intentionally empty.*
