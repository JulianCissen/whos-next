# Implementation Plan: Date-Bound Skip

**Branch**: `20260423-211423-skip-behavior` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/20260424-094241-date-skip/spec.md`

## Summary

Allow any visitor to cancel an entire occurrence date (e.g. a public holiday) so that no member performs the task and no one receives a "free ride." The member who would have been assigned retains their queue position — the next occurrence is still theirs.

The implementation adds a `skip_type` discriminator column to `occurrence_assignments`, a new `POST .../occurrences/:date/cancel` backend endpoint, extends `OccurrenceDto` with `cancelledMemberId`/`cancelledMemberName` fields, and reworks the occurrence card UX to surface both skip modes (date-cancel and member-skip) as peer options behind a single low-key "Skip" trigger.

Two non-obvious algorithm issues discovered during planning are addressed here:
1. `browseForward` offset drift — future occurrence assignments after a date-cancel must shift the derived member index back by the number of date-cancels earlier in the page.
2. `browseBackward` duplicate candidates — future skip-assigned occurrences were latently appearing in both the settled and unsettled candidate sets; this pre-existing bug is fixed here.

## Technical Context

**Language/Version**: TypeScript 5.9.3  
**Primary Dependencies**: NestJS 11, MikroORM 7, Angular 21, Angular Material (M3), @ngx-translate/core  
**Storage**: PostgreSQL 16 — one new text column added to `occurrence_assignments`  
**Testing**: Vitest (unit + integration), Playwright + axe-core (e2e)  
**Target Platform**: Railway (backend, single instance) + Cloudflare Pages (frontend)  
**Project Type**: Web application (monorepo: backend API + Angular SPA + shared types)  
**Performance Goals**: Standard web request latency; cancel endpoint must be handled within a single DB transaction  
**Constraints**: Single-instance deployment; no external stores; WCAG 2.2 AA; i18n required (EN + NL)  
**Scale/Scope**: Single rotation at a time; cancel operations are per-occurrence, not bulk

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| **I — Monorepo / Shared Types as Contract Boundary** | PASS | Cancel DTOs added to `packages/shared`; both packages import from `@whos-next/shared` only |
| **II — Stateless URL-Based Access Model** | PASS | Cancel endpoint is under `/api/rotations/:slug/...`; no auth introduced |
| **III — Privacy by Design** | PASS | No PII added; member names already treated as display names only |
| **IV — Accessibility as Hard Gate** | PASS | Redesigned skip trigger and inline panel must meet WCAG 2.2 AA; e2e accessibility coverage required |
| **V — Simplicity / No Speculative Infrastructure** | PASS | One new text column; one new service; no new external dependencies; batch cancel explicitly out of scope |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/20260424-094241-date-skip/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── cancel-occurrence.md  # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code

```text
apps/backend/src/
  members/
    occurrence-assignment.entity.ts   # extend: add skipType property
  schedule/
    cancel.service.ts                 # new — date-cancel business logic
    schedule.controller.ts            # extend: add POST .../occurrences/:date/cancel
    occurrence-browse.helper.ts       # fix: browseForward offset adjustment + browseBackward dedup
    occurrence.service.ts             # extend: populate cancelledMember* in OccurrenceDto
    skip.service.ts                   # update: "already skipped" check uses skipType
  database/migrations/
    Migration20260424000005_cancel.ts # new — add skip_type column + backfill

packages/shared/src/
  schedule/
    index.ts                          # extend OccurrenceDto; add CancelOccurrenceResponseDto

apps/frontend/src/
  app/
    core/api/
      schedule.api.ts                 # extend: add cancelOccurrence()
    features/rotation/
      occurrence-view/
        occurrence-card.component.ts  # rework: single "Skip" trigger → inline two-option panel
        occurrence-card.component.html
        occurrence-view.component.ts  # extend: handle cancel action + refresh
  assets/i18n/
    en.json                           # add cancel / skip-mode strings
    nl.json                           # add cancel / skip-mode strings

apps/backend/bruno/
  occurrences/
    cancel-occurrence.bru             # new Bruno request (success + error variants)
```
