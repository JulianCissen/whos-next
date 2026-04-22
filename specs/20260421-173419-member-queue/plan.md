# Implementation Plan: Member Queue Management

**Branch**: `20260421-173419-member-queue` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/20260421-173419-member-queue/spec.md`

## Summary

Deliver the member queue lifecycle for a rotation: add a named member to the front or back of the queue; remove a member (soft-delete, preserving historical assignment records); manually reorder the queue via drag-and-drop; and compute upcoming assignments deterministically via a pure `assignMembers` function driven by a `nextIndex` cycle pointer stored on the rotation.

**Technical approach.** Introduce a `members` backend domain (NestJS controller + service + two MikroORM entities) with three new endpoints under `/api/rotations/:slug/members` (add, remove, reorder) and one extension to the existing rotation GET. The cycle pointer (`nextIndex integer`) is added to the `rotations` table and updated synchronously on every queue mutation via a pure helper function. An `occurrence_assignments` table is created for lazy-write settlement (populated lazily on rotation GET once the schedule feature provides occurrence dates). No queue change log is maintained — the lazy-write runs before every rotation access (read or write), settling past occurrences using the pre-mutation queue state, which guarantees historical accuracy without a change log. The `assignMembers` pure function lives in `@whos-next/shared`. The Angular rotation page gains a `MemberQueueComponent` with CDK drag-and-drop for reorder. A new MikroORM migration (`Migration20260421000002_members`) introduces all schema changes.

## Technical Context

**Language/Version**: TypeScript 5.9.3 across all packages.

**Primary Dependencies**:
- Backend: NestJS 11, MikroORM 7 (decorator-less `defineEntity`), `class-validator`, `class-transformer`, Node `node:crypto` (no new packages).
- Frontend: Angular 21 (standalone, zoneless, OnPush), Angular Material (M3), `@angular/cdk/drag-drop` (already bundled with Angular Material — no new install), `@ngx-translate/core`.
- Shared: pure TypeScript; `assignMembers` function, `validateMemberName`, DTOs.

**Storage**: PostgreSQL 16. Two new tables (`members`, `occurrence_assignments`) and one column addition (`next_index` on `rotations`). Introduced via `Migration20260421000002_members`.

**Testing**:
- Shared unit: Vitest for `assignMembers` pure function — covers empty queue, single-member, multi-member, cycle wrap, arbitrary `nextIndex` offsets.
- Backend unit: Vitest for `MembersService` (mocked EM) — add/remove/reorder and `nextIndex` update rules; and for `adjustNextIndex` pure helper.
- Backend integration: Vitest + Testcontainers against all member endpoints and modified rotation GET, end-to-end through the Nest test module.
- Frontend unit/component: Vitest + Angular testing harness for `MemberQueueComponent`, `AddMemberFormComponent`, and `members.api.ts`.
- E2E + a11y: Playwright + `@axe-core/playwright` covering the member queue flows (add, remove, drag-and-drop reorder, empty state) and asserting zero axe violations.
- API manual: Bruno collection under `apps/backend/bruno/members/`.

**Target Platform**: Backend on Node 24 in Docker (Railway single instance). Frontend CSR Angular on Cloudflare Pages.

**Project Type**: Web application (existing monorepo: `apps/frontend`, `apps/backend`, `apps/e2e`, `packages/shared`).

**Performance Goals**:
- `GET /api/rotations/:slug` with members: p95 < 150 ms at single-instance scale (adds one JOIN to the existing query).
- Member mutations (add/remove/reorder): p95 < 100 ms — all are single-transaction writes with at most N=100 position updates.

**Constraints**:
- Soft-deleted `members` rows are never physically deleted (FK integrity for `occurrence_assignments`).
- `nextIndex` is always updated in the same DB transaction as the queue mutation — no eventual consistency.
- `occurrence_assignments` rows are written by the schedule feature; this feature only creates the table and the pure function.
- Angular CDK drag-and-drop must remain keyboard-accessible (WCAG 2.2 AA — Constitution Principle IV).

**Scale/Scope**: Max 100 active members per rotation. 3 new REST endpoints. 2 new entities + 1 entity modification. 1 migration. ~8 Bruno requests. 2 new frontend components.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Compliance |
|---|---|---|
| I | Monorepo with Shared Types as the Contract Boundary | **PASS** — All new DTOs (`MemberDto`, `AddMemberRequestDto`, `ReorderMembersRequestDto`, `AddMemberResponseDto`, `ReorderMembersResponseDto`) and the `assignMembers` pure function live in `packages/shared/src/members/`. Backend and frontend consume them via `@whos-next/shared`. Neither app imports from the other. `RotationResponseDto` extension (adding `members` field) is made in `packages/shared/src/rotations/index.ts`. |
| II | Stateless URL-Based Access Model | **PASS** — All member endpoints are scoped under `/api/rotations/:slug/members`. The slug is the sole access credential; no session, cookie, or auth token is introduced. |
| III | Privacy by Design | **PASS** — Member names are free-text display strings with no identity binding. No PII collected. `member_queue_changes` JSONB snapshot stores member names and IDs only — both are non-identifying. |
| IV | Accessibility as a Hard Gate | **PASS** — `MemberQueueComponent` uses Angular CDK drag-and-drop, which provides `aria-grabbed`, `aria-dropeffect`, and keyboard reorder support (Space to lift, arrow keys to move, Space/Enter to drop). All new form controls have associated `mat-label` or `aria-label`. Playwright + axe-core assertions added for the queue section. |
| V | Simplicity and No Speculative Infrastructure | **PASS** — No new external services or packages. `@angular/cdk/drag-drop` is already bundled. No queue change log — the lazy-write uses the current queue state directly (see research.md Decision 2). `occurrence_assignments` table is a simple write target — no message queue, no background worker. The lazy-write trigger (FR-020) is a stub in this feature, deferred to the schedule feature; no speculative infrastructure is introduced now. |

**Gate result: PASS.** No Complexity Tracking entries required.

**Post-Phase 1 re-check**: No new violations introduced by the contracts, data model, or quickstart. The JSONB snapshot in `member_queue_changes` is the only marginally non-trivial design choice; it is justified by the 100-member cap (max ~6 KB per snapshot) and the query simplicity it enables (see research.md Decision 2). Constitution Principle V is satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/20260421-173419-member-queue/
├── plan.md                    # This file
├── spec.md                    # Feature spec
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
├── contracts/
│   └── members-api.md         # REST contract for member endpoints
├── checklists/
│   └── requirements.md        # /speckit.specify output
└── tasks.md                   # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/
├── backend/
│   ├── src/
│   │   ├── members/
│   │   │   ├── member.entity.ts                          # (new) Member — name, position, removedAt, rotation FK
│   │   │   ├── occurrence-assignment.entity.ts           # (new) OccurrenceAssignment — date + member FK
│   │   │   ├── members.module.ts                         # (new)
│   │   │   ├── members.controller.ts                     # (new) POST / DELETE /:id / PUT /order
│   │   │   ├── members.service.ts                        # (new) add, remove, reorder + nextIndex management
│   │   │   ├── members.service.spec.ts                   # (new) unit tests (mocked EM)
│   │   │   ├── members.controller.integration.spec.ts    # (new) e2e via Testcontainers
│   │   │   ├── assignment.helper.ts                      # (new) adjustNextIndex pure helper + unit tests
│   │   │   ├── assignment.helper.spec.ts                 # (new)
│   │   │   └── dto/
│   │   │       ├── add-member.dto.ts                     # (new) class-validator wrapper for AddMemberRequestDto
│   │   │       └── reorder-members.dto.ts                # (new) class-validator wrapper for ReorderMembersRequestDto
│   │   ├── rotations/
│   │   │   ├── rotation.entity.ts                        # (modified) add nextIndex property
│   │   │   ├── rotations.service.ts                      # (modified) findBySlug loads members; stub for lazy-write
│   │   │   └── rotations.module.ts                       # (modified) import MembersModule
│   │   ├── database/migrations/
│   │   │   └── Migration20260421000002_members.ts        # (new) adds members, member_queue_changes,
│   │   │                                                 #        occurrence_assignments, rotations.next_index
│   │   └── app.module.ts                                 # (modified) register MembersModule
│   ├── seeders/
│   │   ├── MemberSeeder.ts                               # (new) 6 rotation queues with varied member counts
│   │   └── DatabaseSeeder.ts                             # (modified) dispatch to MemberSeeder after RotationSeeder
│   └── bruno/
│       └── members/                                      # (new) 8 Bruno request files (see contracts/members-api.md)
├── frontend/
│   └── src/app/
│       ├── core/
│       │   ├── api/
│       │   │   ├── members.api.ts                        # (new) typed HttpClient wrappers for member endpoints
│       │   │   └── members.api.spec.ts                   # (new)
│       │   └── i18n/assets/
│       │       ├── en.json                               # (modified) member queue strings
│       │       └── nl.json                               # (modified) Dutch translations
│       └── features/
│           └── rotation/
│               ├── rotation.page.ts                      # (modified) render MemberQueueComponent
│               ├── rotation.page.html                    # (modified) add queue section
│               ├── rotation.page.spec.ts                 # (modified) add queue rendering tests
│               ├── member-queue/
│               │   ├── member-queue.component.ts         # (new) CDK drag-drop list; dispatches add/remove/reorder
│               │   ├── member-queue.component.html       # (new)
│               │   └── member-queue.component.spec.ts    # (new)
│               └── add-member-form/
│                   ├── add-member-form.component.ts      # (new) mat-form-field + placement toggle + submit
│                   ├── add-member-form.component.html    # (new)
│                   └── add-member-form.component.spec.ts # (new)
├── e2e/
│   └── tests/
│       ├── member-queue.spec.ts                          # (new) add, remove, reorder, empty state, capacity error
│       └── accessibility.spec.ts                         # (modified) axe-core scan of rotation page with queue
└── packages/shared/
    └── src/
        ├── members/
        │   ├── index.ts                                  # (new) MemberDto, AddMemberRequestDto,
        │   │                                             #        ReorderMembersRequestDto, assignMembers,
        │   │                                             #        validateMemberName, QueueSnapshotEntry
        │   └── assignment.spec.ts                        # (new) pure function unit tests
        ├── rotations/
        │   └── index.ts                                  # (modified) RotationResponseDto gains members field
        └── index.ts                                      # (modified) re-export members
```

**Structure Decision**: Web application (existing monorepo). The `members/` domain folder in the backend follows the same domain-per-folder convention as `rotations/`. The `member-queue/` and `add-member-form/` components are nested under `features/rotation/` since they are always rendered in the context of the rotation page. The `assignMembers` function belongs in `packages/shared/` so it is importable by both backend (assignment settlement) and frontend (future offline preview if needed), and is the canonical location for constitution-mandated "independently testable with no database or HTTP dependency."

## Complexity Tracking

*No Constitution violations. Section intentionally empty.*
