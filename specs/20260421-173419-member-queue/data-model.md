# Phase 1 Data Model — Member Queue Management

**Feature**: Member Queue Management
**Date**: 2026-04-21

---

## Schema changes overview

This feature introduces two new tables and one column addition to the existing `rotations` table:

| Change | Table | Type |
|---|---|---|
| New | `members` | Member queue slots (soft-deleteable) |
| New | `occurrence_assignments` | Stored assignment records for past occurrences |
| Alter | `rotations` | Add `next_index integer NOT NULL DEFAULT 0` |

---

## Entity: `members`

Represents a named slot in a rotation's queue. Soft-deleted rows are retained for historical assignment reference.

### Columns

| Column | Type | Nullable | Default | Indexed | Exposed in API | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` (DB) / `randomUUID()` (app) | primary key | yes | Exposed to frontend as the member's stable identifier for delete/reorder operations. |
| `rotation_id` | `uuid` | no | — | B-tree (FK) | no | FK → `rotations.id` `ON DELETE CASCADE`. |
| `name` | `text` | no | — | no | yes | 1–100 chars after trim, printable Unicode, no control chars. FR-002. |
| `position` | `integer` | yes | — | B-tree (partial: `WHERE removed_at IS NULL`) | no | 1-indexed queue position. `NULL` for soft-deleted members. Contiguous 1..N among active members. |
| `removed_at` | `timestamptz` | yes | `NULL` | no | no | `NULL` = active. Non-null = soft-deleted timestamp. FR-008. |
| `created_at` | `timestamptz` | no | `NOW()` | no | yes | Inherited from `BaseEntity`. |
| `updated_at` | `timestamptz` | no | `NOW()` | no | no | Inherited from `BaseEntity`. Updated on soft-delete and position changes. |

### Constraints

- `PRIMARY KEY (id)`.
- `FOREIGN KEY (rotation_id) REFERENCES rotations(id) ON DELETE CASCADE`.
- `CHECK (char_length(name) BETWEEN 1 AND 100)` — defence-in-depth.
- `CHECK (position >= 1)` — positions are always positive integers.
- Partial unique index: `UNIQUE (rotation_id, position) WHERE removed_at IS NULL` — enforces that no two active members in the same rotation share a position.

### Validation rules (application layer)

| Rule | Enforced where | Reference |
|---|---|---|
| `name.trim().length >= 1` | `class-validator` DTO + `validateMemberName()` in `@whos-next/shared` | FR-002 |
| `name.trim().length <= 100` | same | FR-002 |
| `name` contains no `[\u0000-\u001F\u007F-\u009F]` | same | FR-002 |
| Active member count < 100 before add | `MembersService` | FR-006 |
| Reorder `memberIds` must exactly match active member IDs (no extras, no missing) | `MembersService` | FR-010 |

### Entity class (`Member`)

Follows the decorator-less `defineEntity` pattern:

```typescript
// apps/backend/src/members/member.entity.ts
export const MemberSchema = defineEntity({
  name: 'Member',
  tableName: 'members',
  extends: BaseEntity,
  properties: {
    rotation: p.manyToOne(() => Rotation, { fieldName: 'rotation_id' }),
    name: p.string(),
    position: p.integer().nullable(),
    removedAt: p.datetime().nullable(),
  },
});

export class Member extends BaseEntity {
  declare rotation: Rotation;
  declare name: string;
  declare position: number | null;
  declare removedAt: Date | null;

  get isActive(): boolean { return this.removedAt === null; }
}
```

### State transitions

```text
(nonexistent)
     │
     ▼
   ADD ─── Member persisted with name, position (1 = front, N+1 = back), removedAt = NULL
     │
     ▼
  [ACTIVE] (position: 1..N, removedAt: NULL)
     │
     ├─── REORDER ─── position updated; all other active members' positions updated atomically
     │         └──→ still [ACTIVE]
     │
     ▼
  REMOVE ─── removedAt = NOW(); position = NULL
     │
     ▼
  [REMOVED] (position: NULL, removedAt: non-null)
  Row retained for historical assignment reference. Never physically deleted.
```

---

## Entity: `occurrence_assignments`

Stores one immutable assignment record per past occurrence date per rotation. Populated lazily on rotation GET (FR-021) — initially empty until the schedule feature provides occurrence dates.

### Columns

| Column | Type | Nullable | Default | Indexed | Exposed in API | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | primary key | no | |
| `rotation_id` | `uuid` | no | — | B-tree | no | FK → `rotations.id` `ON DELETE CASCADE`. |
| `occurrence_date` | `date` | no | — | B-tree (composite with rotation_id) | yes | The calendar date of the occurrence. |
| `member_id` | `uuid` | no | — | no | yes | FK → `members.id`. References the soft-deleted row if the member was subsequently removed — the row is always present (FR-009). |
| `created_at` | `timestamptz` | no | `NOW()` | no | no | When this assignment record was written (the lazy-write time, not the occurrence date). |
| `updated_at` | `timestamptz` | no | `NOW()` | no | no | Inherited. Not updated after insert (immutable once written). |

### Constraints

- `PRIMARY KEY (id)`.
- `UNIQUE (rotation_id, occurrence_date)` — one assignment per date per rotation (FR-012).
- `FOREIGN KEY (rotation_id) REFERENCES rotations(id) ON DELETE CASCADE`.
- `FOREIGN KEY (member_id) REFERENCES members(id)` — no `ON DELETE CASCADE`; `members` rows are never physically deleted (soft-delete only), so this FK always resolves.

---

## `rotations` table extension

Add one column to the existing `rotations` table:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `next_index` | `integer` | no | `0` | 0-based index into the active queue of the next assignee. Updated synchronously on every queue mutation (FR-022). Reset to `0` when the queue becomes empty. |

`next_index` is an internal value. It is NOT exposed in the `RotationResponseDto` — the frontend does not need it; upcoming assignments are computed on the backend.

---

## Pure assignment function

Lives in `packages/shared/src/members/index.ts`. Has no database or I/O dependency (FR-016).

```typescript
export interface ActiveQueueEntry {
  memberId: string;
  memberName: string;
}

export interface UpcomingAssignment {
  date: Date;
  memberId: string | null;   // null when queue is empty
  memberName: string | null; // null when queue is empty
}

/**
 * Computes upcoming assignments from the current active queue, cycle pointer, and list of dates.
 * Pure function — identical inputs always produce identical output (FR-012, FR-013, FR-016).
 */
export function assignMembers(
  activeQueue: ActiveQueueEntry[],
  nextIndex: number,
  upcomingDates: Date[],
): UpcomingAssignment[] {
  if (activeQueue.length === 0) {
    return upcomingDates.map((date) => ({ date, memberId: null, memberName: null }));
  }
  return upcomingDates.map((date, offset) => {
    const idx = (nextIndex + offset) % activeQueue.length;
    return {
      date,
      memberId: activeQueue[idx].memberId,
      memberName: activeQueue[idx].memberName,
    };
  });
}
```

---

## Shared DTO additions

```typescript
// packages/shared/src/members/index.ts

export interface MemberDto {
  id: string;
  name: string;
  position: number;  // 1-indexed; active members only
}

export interface AddMemberRequestDto {
  name: string;
  placement: 'front' | 'back';
}

export interface ReorderMembersRequestDto {
  memberIds: string[]; // full active queue in desired new order
}

// Member name validation (mirrors validateRotationName in pattern)
export const MEMBER_NAME_MIN_LENGTH = 1;
export const MEMBER_NAME_MAX_LENGTH = 100;
export function validateMemberName(raw: string): { ok: true; value: string } | { ok: false; reason: string } { ... }
```

```typescript
// packages/shared/src/rotations/index.ts — RotationResponseDto gains members field

export interface RotationResponseDto {
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: MemberDto[]; // active members, ordered by position ascending
}
```

---

## Migration

Migration file: `apps/backend/src/database/migrations/Migration20260421000002_members.ts`

```sql
-- up
ALTER TABLE "rotations" ADD COLUMN "next_index" integer NOT NULL DEFAULT 0;

CREATE TABLE "members" (
  "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
  "rotation_id" uuid        NOT NULL REFERENCES "rotations"("id") ON DELETE CASCADE,
  "name"        text        NOT NULL,
  "position"    integer,
  "removed_at"  timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"  timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "members_name_length_chk" CHECK (char_length("name") BETWEEN 1 AND 100),
  CONSTRAINT "members_position_positive_chk" CHECK ("position" IS NULL OR "position" >= 1)
);
CREATE UNIQUE INDEX "members_rotation_position_uniq"
  ON "members" ("rotation_id", "position")
  WHERE "removed_at" IS NULL;
CREATE INDEX "members_rotation_id_idx" ON "members" ("rotation_id");

CREATE TABLE "occurrence_assignments" (
  "id"              uuid        NOT NULL DEFAULT gen_random_uuid(),
  "rotation_id"     uuid        NOT NULL REFERENCES "rotations"("id") ON DELETE CASCADE,
  "occurrence_date" date        NOT NULL,
  "member_id"       uuid        NOT NULL REFERENCES "members"("id"),
  "created_at"      timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"      timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "occurrence_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "occurrence_assignments_rotation_date_uniq" UNIQUE ("rotation_id", "occurrence_date")
);
CREATE INDEX "occurrence_assignments_rotation_id_idx"
  ON "occurrence_assignments" ("rotation_id");

-- down
DROP TABLE IF EXISTS "occurrence_assignments";
DROP TABLE IF EXISTS "members";
ALTER TABLE "rotations" DROP COLUMN IF EXISTS "next_index";
```

---

## Seed data

`apps/backend/seeders/MemberSeeder.ts` populates members for the six seeded rotations:

- **Dish duty**: 3 active members — "Alice", "Bob", "Carol". `nextIndex = 0`.
- **Standup host**: 5 active members — "Priya", "Jonas", "Mei", "Carlos", "Amara". `nextIndex = 2` (mid-cycle).
- **🎂 Birthday cake**: 1 active member — "Sam". `nextIndex = 0` (single-member edge case).
- **Fika-waarde**: 2 active members + 1 soft-deleted member ("Ex-member" with `removedAt` set). `nextIndex = 1`.
- **金曜ビール**: 4 active members with Japanese-script names. `nextIndex = 0`.
- **100-char rotation**: 0 active members (empty queue edge case). `nextIndex = 0`.

Each seeded rotation gets a corresponding `member_queue_changes` log entry per member added, with accurate `changed_at` timestamps.
