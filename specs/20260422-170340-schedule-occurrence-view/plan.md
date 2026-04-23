# Implementation Plan: Schedule Configuration and Occurrence View

**Branch**: `20260422-170340-schedule-occurrence-view` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/20260422-170340-schedule-occurrence-view/spec.md`

## Summary

Add schedule configuration (recurrence rules and custom date lists) to rotations and expose an occurrence view showing who is assigned to upcoming and past occurrences. Recurrence-rule dates are computed by a pure, in-process function in `packages/shared`. Custom dates are stored in a new `schedule_dates` table. A lazy settlement pass on each occurrence view load records elapsed dates into the existing `occurrence_assignments` table and advances `nextIndex`, preserving the round-robin assignment invariant. The frontend gains a schedule configuration form embedded in rotation creation and an occurrence view component with current/previous display plus unbounded forward/backward browsing.

## Technical Context

**Language/Version**: TypeScript 5.9.3 — Angular 21 (frontend), NestJS 11 (backend), TypeScript-only (shared)
**Primary Dependencies**: Angular Material M3, @ngx-translate/core (frontend); NestJS 11, MikroORM 7 (backend); no new external packages
**Storage**: PostgreSQL 16 — 2 new tables (`schedules`, `schedule_dates`); no structural changes to existing tables
**Testing**: Vitest (unit/integration), Playwright + axe-core (e2e)
**Target Platform**: Single-instance Railway deployment (Dockerized)
**Project Type**: Web application (Angular SPA + NestJS REST API)
**Performance Goals**: SC-001 — occurrence view visible < 5 s from page open; SC-003 — 52+ forward steps on weekly rotation
**Constraints**: Max 500 custom dates per rotation (constitution cap); recurrence computation must be a pure, side-effect-free shared function; no new external date libraries
**Scale/Scope**: Single-instance; no horizontal scaling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Monorepo / Shared Types** | ✅ PASS | All new DTOs reside in `packages/shared/src/schedule/`. Frontend and backend import from `@whos-next/shared` only. |
| **II. Stateless URL-Based Access** | ✅ PASS | All schedule/occurrence endpoints addressed by rotation slug. No auth, sessions, or tokens introduced. |
| **III. Privacy by Design** | ✅ PASS | No PII. Schedule stores only dates and rule parameters. Member names are pre-existing display-only strings. |
| **IV. Accessibility Hard Gate** | ✅ PASS | New schedule-config and occurrence-view components must achieve WCAG 2.2 AA. axe-core Playwright tests must cover the updated rotation page. |
| **V. Simplicity / No Speculative Infrastructure** | ✅ PASS | Recurrence computation is an in-process pure function. Settlement is in-DB only. No Redis, queues, or cron jobs added. |
| **Data Caps** | ✅ PASS | `schedule_dates` enforces max 500 entries per rotation in the service layer (HTTP 422 on overflow). |
| **Assignment Purity** | ✅ PASS | `computeRecurrenceDates` is a pure, side-effect-free function in `packages/shared`, independently testable. |
| **i18n** | ✅ PASS | All new UI strings use `@ngx-translate/core` keys. No hardcoded string literals in templates or components. |

*Post-design re-check (Phase 1): All principles continue to pass. No new violations introduced by the data model or API contracts.*

## Project Structure

### Documentation (this feature)

```text
specs/20260422-170340-schedule-occurrence-view/
├── plan.md               ← this file
├── research.md           ← Phase 0 output
├── data-model.md         ← Phase 1 output
├── quickstart.md         ← Phase 1 output
├── contracts/
│   ├── schedule-api.md   ← Phase 1 output
│   └── occurrence-api.md ← Phase 1 output
└── tasks.md              ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/shared/src/
├── schedule/
│   └── index.ts           NEW  — ScheduleType, RecurrenceRuleDto, ScheduleDto, OccurrenceDto,
│                                  computeRecurrenceDates()
├── rotations/
│   └── index.ts           MOD  — CreateRotationRequestDto + schedule; RotationResponseDto + schedule
└── index.ts               MOD  — re-export from schedule/

apps/backend/src/
├── schedule/              NEW domain folder
│   ├── schedule.entity.ts
│   ├── schedule-date.entity.ts
│   ├── recurrence.helper.ts     pure: computeRecurrenceDates()
│   ├── occurrence.helper.ts     pure: settlement helpers
│   ├── schedule.service.ts      configure, addDate, removeDate, switchType
│   ├── occurrence.service.ts    getWindow, browse, settle (transactional)
│   ├── schedule.controller.ts   REST endpoints
│   └── schedule.module.ts
├── database/migrations/
│   └── Migration20260422000003_schedule.ts  NEW
├── rotations/
│   └── rotations.service.ts     MOD — create includes schedule; toDto includes schedule
└── app.module.ts                MOD — import ScheduleModule

apps/frontend/src/app/
├── core/api/
│   └── schedule.api.ts               NEW — ScheduleApiService, OccurrencesApiService
├── features/
│   ├── landing/
│   │   └── create-rotation-form.component.ts  MOD — add schedule config step
│   └── rotation/
│       ├── schedule-config/
│       │   ├── schedule-config.component.ts   NEW — recurrence + switch-type form
│       │   └── custom-dates-list.component.ts NEW — date add/remove list
│       ├── occurrence-view/
│       │   ├── occurrence-view.component.ts   NEW — next/prev + browse navigation
│       │   └── occurrence-card.component.ts   NEW — presentational card
│       └── rotation.page.ts                   MOD — embed occurrence-view + schedule-config
```

**Structure Decision**: Monorepo web-application layout. New schedule domain co-located in `apps/backend/src/schedule/`. Shared types in `packages/shared/src/schedule/`. Frontend components in domain-feature folders. No fourth project; no new infrastructure services.

## Complexity Tracking

> No constitution violations requiring justification.
