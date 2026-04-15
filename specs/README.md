# Implementation units

This file maps the PRD to discrete units of work in dependency order. Each unit has a `/speckit-specify` prompt ready to use.

Unit 0 (scaffolding) is setup work, not a speckit spec. Units 1–5 each produce a `specs/NNN-*/` directory.

## Dependency order

```
Unit 0 (scaffolding)
  └── Unit 1 (rotation core)
        ├── Unit 2 (member queue)
        │     └── Unit 3 (schedule + occurrence view)  ← first end-to-end value
        │           └── Unit 4 (skip behavior)
        └── Unit 5 (abuse protection)  ← can start after Unit 1
```

The app delivers its first real value after Unit 3.

---

## Unit 0 — Project scaffolding

**Not a speckit spec.** Manual setup before anything else.

Covers:
- pnpm workspace monorepo with three packages: `frontend`, `backend`, `shared`
- Single Docker base image with multi-stage build targets per package
- `docker-compose.yml` orchestrating frontend, backend, and PostgreSQL 16
- Angular 21 app skeleton (CSR, Angular Material, i18n with Dutch + English)
- NestJS 11 app skeleton with MikroORM 7 configured for PostgreSQL
- Shared package with placeholder DTO structure
- Vitest configured for frontend and backend unit tests
- Playwright + axe-core configured for e2e and accessibility tests

---

## Unit 1 — Rotation core

**PRD references:** R-01 to R-05

**Prompt:**
```
A rotation is the top-level entity of the app. Create the rotation feature: a user can create a rotation by giving it a name. On creation, an 8-character base-58 cryptographically random slug is generated and returned as the shareable URL — this slug is the sole identifier for the rotation. No account is required. Anyone with the URL has full access to view and manage the rotation. The rotation name can be edited at any time. A rotation can be permanently deleted (irreversible action, requires confirmation).
```

---

## Unit 2 — Member queue

**PRD references:** R-06 to R-09

**Prompt:**
```
A rotation has an ordered queue of members. A member is a display name only — not a user account. When adding a member, the person adding them chooses whether they go to the front or the back of the queue. Members can be removed at any time; removing a member preserves any past occurrence assignments for historical accuracy. Members can be manually reordered within the queue. The queue order deterministically drives assignment: the first member in the queue is assigned to the first upcoming occurrence, cycling through indefinitely. This assignment logic must be implemented as a pure, testable function that takes the queue and a list of occurrence dates and returns the full assignment sequence.
```

---

## Unit 3 — Schedule and occurrence view

**PRD references:** R-10 to R-17

**Prompt:**
```
A rotation has a schedule that defines when occurrences happen, and a view that shows who is assigned to each occurrence. Two schedule types exist: (1) recurrence rules — weekly on a specific day of the week, every N weeks on a specific day, or monthly on a specific day number; (2) custom date list — a manually curated set of specific dates that can be added to or removed from at any time. The schedule type is chosen when creating the rotation; it can be changed later but doing so resets the schedule configuration. The occurrence view shows: the next upcoming occurrence with its assignee and date prominently displayed, the most recent past occurrence, the ability to browse forward through all future occurrences with no upper limit, and the ability to browse backward through all past occurrences.
```

---

## Unit 4 — Skip behavior

**PRD references:** R-18 to R-23

**Prompt:**
```
On any occurrence, the assigned member can be marked as unavailable. This triggers the rotation's configured skip behavior. Three skip behaviors exist: (1) Pass (default) — the next member in the queue covers the occurrence; the skipped member's queue position is unchanged and they continue at their normal cadence; (2) Defer — the next member covers the occurrence, which counts as that member's turn so they are not assigned again until after the skipped member takes their deferred turn; the skipped member is moved to the end of the current cycle so total assignments per cycle stay constant and no member does two occurrences in a row as a result; (3) Manual substitute — the occurrence is flagged as needing a substitute and the visitor manually picks any member to cover; no queue positions change. The skip behavior is set per rotation at creation and can be changed at any time. Occurrences where a skip occurred must visually indicate both the substitute assignee and that the original member was unavailable.
```

---

## Unit 5 — Abuse protection

**PRD references:** Section 5.2 (security)

**Prompt:**
```
Add abuse protection to the API. Rate-limit both rotation creation and rotation lookup endpoints using in-memory counters keyed by hashed browser fingerprint — no database writes. Apply a hard cap on rotation creation (e.g. 20 per hour per fingerprint). Enforce input length caps on all write endpoints: rotation names max 100 characters, member names max 100 characters, max 100 members per rotation, max 500 custom dates per rotation. Implement an inactivity expiry mechanism: rotations not accessed in 12 months are automatically deleted; the UI must show a warning 30 days before a rotation is due to expire.
```
