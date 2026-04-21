# Phase 1 Data Model — Rotation Lifecycle

**Feature**: Rotation Lifecycle (Create, Rename, Delete)
**Date**: 2026-04-18

## Entities

### `Rotation`

Represents a single named shared responsibility. Exactly one row per rotation. External callers only ever reference a rotation via its `slug`; the internal UUID `id` is never exposed (FR-025).

#### Columns

| Column | Type | Nullable | Default | Indexed | Exposed in API | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` (DB) / `randomUUID()` (app) | primary key | **no** | Internal identifier. Hidden from JSON serialization (`hidden: true` on the `defineEntity` schema). FR-025. |
| `slug` | `text` | no | — (app-assigned) | `UNIQUE` + B-tree | yes | 8-character base-58 string. Unique constraint enforces FR-010 at the DB layer. Sole external identifier (FR-009). |
| `name` | `text` | no | — | no | yes | 1–100 characters after trim, no control characters, printable Unicode. FR-003. |
| `created_at` | `timestamptz` | no | `NOW()` (DB) / `new Date()` (app `onCreate`) | no | yes | When the rotation was created. Set once, never updated. |
| `updated_at` | `timestamptz` | no | `NOW()` (DB) / `new Date()` (app `onCreate`/`onUpdate`) | no | optional | Tracks mutations (create, rename). **Not** updated by last-access writes. |
| `last_accessed_at` | `timestamptz` | no | `NOW()` | no | no | Updated on any read or write, throttled to at most once per 24 h via a conditional `UPDATE` (R-6). Consumed by the separate inactivity-expiry feature; not surfaced in this feature's API. FR-026. |

#### Constraints

- `PRIMARY KEY (id)`.
- `UNIQUE (slug)` — enforces per-database slug uniqueness and makes concurrent insert races race-free.
- `CHECK (char_length(name) BETWEEN 1 AND 100)` — defence in depth against application-layer validation bypass.
- `CHECK (char_length(slug) = 8)` — defence in depth; the application-layer regex is the primary guard.

*(Check constraints intentionally do not cover control-character rejection — that is an application-layer concern; mixing PostgreSQL regex with Unicode categories is error-prone and the application validator is authoritative.)*

#### Validation rules (application layer)

| Rule | Enforced where | Reference |
|---|---|---|
| `name.trim().length >= 1` | `class-validator` DTO + `validateRotationName()` in `@whos-next/shared` | FR-003, FR-004 |
| `name.trim().length <= 100` | same | FR-003 |
| `name` contains no `/[\u0000-\u001F\u007F-\u009F]/` | same | R-3, FR-003 |
| `slug` matches `/^[1-9A-HJ-NP-Za-km-z]{8}$/` | Angular `canMatch` route guard + `class-validator` `@Matches` on param DTO | FR-007, FR-014, FR-014a |

#### Relationships

None within the scope of this feature. In later features, `Rotation` will have `OneToMany` relationships to `Member`, `ScheduleConfig`, `Occurrence`, etc. — all out of scope here.

When those later features introduce child tables, they MUST use `ON DELETE CASCADE` on their `rotation_id` foreign key so that a rotation delete (FR-021) atomically removes all dependent data. That is noted here for future reference; no such FK exists yet.

#### Entity-level methods (pure, side-effect-free)

Defined on the concrete `Rotation` class attached via `schema.setClass(...)`:

- `rename(newName: string): void` — validates via `validateRotationName`, throws if invalid, otherwise assigns trimmed value to `this.name`. The caller is responsible for flushing the EM.
- `touchAccess(): boolean` — pure predicate indicating whether a last-access update would fire given current time; actual SQL is executed at service level (R-6) and this method is purely a convenience for tests.

No other logic lives on the entity — the service handles persistence concerns (slug generation, retry, deletion).

---

## State transitions

```text
(nonexistent)
     │
     ▼
  create ─── new Rotation persisted with fresh slug, name, timestamps
     │
     ▼
  [EXISTS]
     │
     ├─── rename ─── name mutated; slug, id, timestamps (except updated_at) unchanged
     │        │
     │        └──→ still [EXISTS]
     │
     ├─── access (read or write) ─── last_accessed_at conditionally updated
     │        │
     │        └──→ still [EXISTS]
     │
     ▼
  delete ─── row permanently removed (no soft-delete; FR-021)
     │
     ▼
 (gone ── future lookups return "rotation not found", FR-022)
```

No intermediate states. No soft-delete, no archival, no "pending" status.

---

## Migration

Generated via `pnpm --filter @whos-next/backend exec mikro-orm migration:create --name rotations`. Expected shape:

```sql
-- up
CREATE TABLE "rotations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  "last_accessed_at" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "rotations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rotations_name_length_chk" CHECK (char_length("name") BETWEEN 1 AND 100),
  CONSTRAINT "rotations_slug_length_chk" CHECK (char_length("slug") = 8)
);
CREATE UNIQUE INDEX "rotations_slug_uniq" ON "rotations" ("slug");

-- down
DROP TABLE "rotations";
```

The generated migration file may differ in snake/camel casing and exact constraint naming; the content above is the normative intent. If MikroORM's generator does not emit the `CHECK` constraints (they are not derivable from `defineEntity` alone), add them manually in the generated file before committing.

---

## Seed data

`apps/backend/seeders/RotationSeeder.ts` populates six rotations covering the scenario space:

1. `Dish duty` — plain Latin name.
2. `Standup host` — two-word name.
3. `🎂 Birthday cake` — name beginning with emoji.
4. `Fika-waarde` — name with non-ASCII Latin character.
5. `金曜ビール` — non-Latin script name.
6. A 100-character rotation name — maximum-length boundary.

Each seeded rotation gets a freshly generated slug via the same generator the service uses (so seed data is indistinguishable from real data). Creation timestamps are staggered across the last 18 months to support the future inactivity-expiry feature's tests.

`apps/backend/seeders/DatabaseSeeder.ts` dispatches to `RotationSeeder` (and, later, to member/schedule/occurrence seeders).
