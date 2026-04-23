# Data Model: Schedule Configuration and Occurrence View

**Phase**: 1 | **Feature**: `20260422-170340-schedule-occurrence-view`

---

## New Database Tables

### `schedules`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `rotation_id` | UUID | NO | — | FK → `rotations.id` ON DELETE CASCADE, UNIQUE |
| `type` | TEXT | NO | — | `'recurrence_rule'` or `'custom_date_list'` |
| `rrule_type` | TEXT | YES | NULL | `'weekly'`, `'every_n_weeks'`, or `'monthly'`; NULL when `type = custom_date_list` |
| `day_of_week` | SMALLINT | YES | NULL | ISO 8601: 1 = Monday … 7 = Sunday; NULL unless `rrule_type ∈ {weekly, every_n_weeks}` |
| `interval_n` | SMALLINT | YES | NULL | ≥ 2; NULL unless `rrule_type = every_n_weeks` |
| `monthly_day` | SMALLINT | YES | NULL | 1–31; NULL unless `rrule_type = monthly` |
| `start_date` | DATE | YES | NULL | Series anchor; NULL when `type = custom_date_list` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — |

**Indexes / constraints**:
- `UNIQUE (rotation_id)` — one schedule per rotation

---

### `schedule_dates`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | `gen_random_uuid()` | PK |
| `schedule_id` | UUID | NO | — | FK → `schedules.id` ON DELETE CASCADE |
| `date` | DATE | NO | — | Calendar date (no time component) |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — |

**Indexes / constraints**:
- `UNIQUE (schedule_id, date)` — no duplicate dates per schedule (FR-006)
- `INDEX (schedule_id)` — query performance

---

## Existing Tables — No Structural Changes

| Table | Change |
|-------|--------|
| `rotations` | None. `schedule_id` is accessed via the inverse FK on `schedules.rotation_id`. `next_index` already exists. |
| `occurrence_assignments` | None. Already has the correct shape: `(rotation_id, occurrence_date, member_id)` with UNIQUE on `(rotation_id, occurrence_date)`. |
| `members` | None. |

---

## New Migration: `Migration20260422000003_schedule.ts`

```sql
-- schedules
CREATE TABLE schedules (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rotation_id  UUID        NOT NULL REFERENCES rotations(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('recurrence_rule', 'custom_date_list')),
  rrule_type   TEXT                 CHECK (rrule_type IN ('weekly', 'every_n_weeks', 'monthly')),
  day_of_week  SMALLINT             CHECK (day_of_week BETWEEN 1 AND 7),
  interval_n   SMALLINT             CHECK (interval_n >= 2),
  monthly_day  SMALLINT             CHECK (monthly_day BETWEEN 1 AND 31),
  start_date   DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedules_rotation_id_unique UNIQUE (rotation_id)
);

-- schedule_dates
CREATE TABLE schedule_dates (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id  UUID        NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_dates_schedule_date_unique UNIQUE (schedule_id, date)
);

CREATE INDEX schedule_dates_schedule_id_idx ON schedule_dates (schedule_id);
```

---

## New MikroORM Entities

### `Schedule` (`apps/backend/src/schedule/schedule.entity.ts`)

```typescript
// Uses decorator-less defineEntity API (backend rules)
export const Schedule = defineEntity({
  name: 'Schedule',
  tableName: 'schedules',
  extends: BaseEntity,
  properties: {
    rotation:   manyToOne(() => Rotation, { onDelete: 'cascade' }),
    type:       { type: 'string' },            // ScheduleType
    rruleType:  { type: 'string', nullable: true },
    dayOfWeek:  { type: 'number', nullable: true },
    intervalN:  { type: 'number', nullable: true },
    monthlyDay: { type: 'number', nullable: true },
    startDate:  { type: 'date',   nullable: true },
  },
});
export type ScheduleEntity = InstanceType<typeof Schedule>;
```

### `ScheduleDate` (`apps/backend/src/schedule/schedule-date.entity.ts`)

```typescript
export const ScheduleDate = defineEntity({
  name: 'ScheduleDate',
  tableName: 'schedule_dates',
  extends: BaseEntity,
  properties: {
    schedule: manyToOne(() => Schedule, { onDelete: 'cascade' }),
    date:     { type: 'date' },
  },
});
export type ScheduleDateEntity = InstanceType<typeof ScheduleDate>;
```

---

## New Shared Types (`packages/shared/src/schedule/index.ts`)

```typescript
// Day of week: ISO 8601
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Mon … 7=Sun

export type ScheduleType       = 'recurrence_rule' | 'custom_date_list';
export type RecurrenceRuleType = 'weekly' | 'every_n_weeks' | 'monthly';

// ---- Rule & schedule shapes ----

export interface RecurrenceRuleDto {
  type: RecurrenceRuleType;
  dayOfWeek?: IsoWeekday;  // weekly, every_n_weeks
  intervalN?: number;       // every_n_weeks (≥ 2)
  monthlyDay?: number;      // monthly (1–31)
}

export interface ScheduleDto {
  type: ScheduleType;
  recurrenceRule?: RecurrenceRuleDto;  // present when type = recurrence_rule
  startDate?: string;                   // ISO date; present when type = recurrence_rule
  dates?: string[];                     // sorted ISO dates; present when type = custom_date_list
}

// ---- Occurrence shapes ----

export interface OccurrenceDto {
  date: string;              // ISO date "YYYY-MM-DD"
  memberId: string | null;
  memberName: string | null;
  isPast: boolean;
}

export interface OccurrenceWindowDto {
  previous: OccurrenceDto | null;
  next: OccurrenceDto | null;
}

export interface BrowseOccurrencesResponseDto {
  occurrences: OccurrenceDto[];
  hasMore: boolean;
}

// ---- Request DTOs ----

export interface ConfigureRecurrenceRuleRequestDto {
  rule: RecurrenceRuleDto;
  startDate?: string;        // ISO date; defaults to today server-side
}

export interface SwitchScheduleTypeRequestDto {
  type: ScheduleType;
}

export interface AddCustomDateRequestDto {
  date: string;              // "YYYY-MM-DD"
}

export interface CustomDateDto {
  date: string;
}

// ---- Pure compute function ----

/**
 * Generate occurrence dates for a recurrence rule.
 *
 * @param rule       - Validated recurrence rule configuration.
 * @param startDate  - Series anchor; first occurrence falls on or after this date.
 * @param from       - Only return dates on or after this date (for browsing).
 * @param limit      - Maximum number of dates to return (prevents infinite loops).
 */
export function computeRecurrenceDates(
  rule: RecurrenceRuleDto,
  startDate: Date,
  from: Date,
  limit: number,
): Date[];
```

---

## Modified Shared Types (`packages/shared/src/rotations/index.ts`)

### `CreateRotationRequestDto` — add required `schedule`

```typescript
import type { RecurrenceRuleDto, ScheduleType } from '../schedule/index.js';

export interface CreateRotationScheduleDto {
  type: ScheduleType;
  recurrenceRule?: RecurrenceRuleDto;  // required when type = 'recurrence_rule'
  startDate?: string;                   // ISO date; defaults to today server-side
}

export interface CreateRotationRequestDto {
  name: string;
  schedule: CreateRotationScheduleDto;
}
```

### `RotationResponseDto` — add `schedule`

```typescript
import type { ScheduleDto } from '../schedule/index.js';

export interface RotationResponseDto {
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: MemberDto[];
  schedule: ScheduleDto | null;  // null for pre-feature rotations
}
```

---

## State Transitions

### Schedule lifecycle (per rotation)

```
[NULL / no schedule]
  ── create rotation ──► [recurrence_rule: configured]
                    └──► [custom_date_list: empty dates]

[recurrence_rule: configured]
  ── PUT /schedule/recurrence-rule ──► [recurrence_rule: reconfigured]
  ── PUT /schedule/type { custom_date_list } ──► [custom_date_list: cleared]

[custom_date_list]
  ── POST /schedule/dates ──► [custom_date_list: +1 date]
  ── DELETE /schedule/dates/:date ──► [custom_date_list: −1 date]
  ── PUT /schedule/type { recurrence_rule } ──► [recurrence_rule: unconfigured rule]
```

### Occurrence settlement (per rotation, per view load)

```
nextIndex = N, occurrence_assignments = {settled dates} (state before request)
  │
  ▼  lazy settlement pass
nextIndex advances by count(unsettled elapsed dates where queue non-empty)
occurrence_assignments gains one row per settled date
  │
  ▼  future occurrences derived
queue[nextIndex], queue[nextIndex+1], … (cyclic) ← assigned to upcoming dates
```

---

## Validation Rules

| Field | Rule | HTTP Error |
|-------|------|-----------|
| `schedule.type` | `'recurrence_rule'` or `'custom_date_list'` | 422 |
| `recurrenceRule` | Required when `type = recurrence_rule` | 422 |
| `recurrenceRule.type` | `'weekly'`, `'every_n_weeks'`, or `'monthly'` | 422 |
| `recurrenceRule.dayOfWeek` | Integer 1–7; required for `weekly` / `every_n_weeks` | 422 |
| `recurrenceRule.intervalN` | Integer ≥ 2; required for `every_n_weeks` | 422 |
| `recurrenceRule.monthlyDay` | Integer 1–31; required for `monthly` | 422 |
| `startDate` | Valid ISO date string `YYYY-MM-DD` | 422 |
| Custom `date` | Valid ISO date string `YYYY-MM-DD` | 422 |
| Custom date (duplicate) | Must be unique per schedule | 409 |
| Custom date count | ≤ 500 per schedule | 422 |
| Wrong schedule type | e.g., adding custom date to recurrence-rule rotation | 409 |
