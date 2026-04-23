# Research: Schedule Configuration and Occurrence View

**Phase**: 0 | **Feature**: `20260422-170340-schedule-occurrence-view`

---

## 1. Recurrence Date Computation

**Decision**: Pure TypeScript function using the native `Date` API — no external libraries.

**Rationale**: The three rule types (weekly, every N weeks, monthly on a day number) reduce to simple arithmetic that does not justify adding a date library. Node 24 ships with the experimental Temporal API, but it is not yet stable. Native `Date` arithmetic is fully adequate and keeps the dependency count unchanged (constitution principle V).

**Algorithm**:

- `weekly` (step = 7 days): find the first date ≥ `startDate` whose JS `getDay()` matches the requested ISO weekday; then add 7 days per step.
- `every_n_weeks` (step = 7 × N days): identical to weekly, step = 7 × N.
- `monthly` on day D: starting from `startDate`, advance month-by-month using `new Date(year, month + 1, D)`. If the result overflows (e.g., Feb 31 → Mar 3), that month is skipped per FR-003.

**Day-of-week encoding**: ISO 8601 — `1 = Monday … 7 = Sunday`. Conversion to JS `getDay()` (where 0 = Sunday): `jsDay = isoDay % 7`.

**Overflow detection for monthly**: After constructing `new Date(year, month, D)`, compare `result.getDate() === D`. If they differ, JS rolled over into the next month — skip and advance.

**Boundary**: The function accepts a `limit: number` parameter (max occurrences to generate) instead of a far-future end date, enabling unbounded forward browsing without risk of runaway loops.

**Alternatives considered**:
- `date-fns` — well-maintained, tree-shakeable, but adds a dependency for three simple arithmetic cases.
- Temporal API — experimental in Node 24; rejected for production stability.

---

## 2. Occurrence Settlement Strategy

**Decision**: Lazy settlement on every `GET /api/rotations/:slug/occurrences` call, inside a single database transaction.

**Rationale**: Settlement on read is the simplest pattern that satisfies the spec's requirement to preserve past assignments. It requires no background job, no cron, and no separate scheduling infrastructure — consistent with the existing `lastAccessedAt` touch-access pattern and constitution principle V.

**Algorithm**:

```text
settleOccurrences(rotation, schedule, em):
  elapsedDates   = computeElapsedScheduleDates(schedule, yesterday)
  settledDates   = SELECT occurrence_date FROM occurrence_assignments
                   WHERE rotation_id = rotation.id
  unsettled      = elapsedDates − settledDates  (sorted ascending)

  IF unsettled is empty → skip transaction

  queue = activeMembers(rotation).sortedByPosition()
  idx   = rotation.nextIndex

  FOR date IN unsettled:
    IF queue is not empty:
      INSERT occurrence_assignments(rotation_id, date, queue[idx].id)
      idx = (idx + 1) % queue.length

  rotation.nextIndex = idx
  em.flush()  ← commit transaction
```

**Why retroactive assignment is correct**: `adjustNextIndex()` already preserves the round-robin invariant across every queue mutation (add/remove/reorder). At settlement time, `nextIndex` always points to "the next unassigned slot" in the current queue. Assigning `queue[nextIndex]` to the oldest unsettled date and advancing yields the correct historical sequence.

**Empty-queue guard**: If the active queue is empty when settlement runs, skip insertion for that date (no member to assign). `nextIndex` is not advanced. Unsettled dates are re-attempted on the next view.

**Concurrency safety**: The UNIQUE constraint on `occurrence_assignments(rotation_id, occurrence_date)` absorbs a race between two concurrent requests — the second `INSERT` is rejected and the read proceeds correctly.

**Alternatives considered**: Eager settlement on every queue mutation — rejected because it requires coupling the `MembersModule` to the `ScheduleModule` and knowing how many occurrences have elapsed since the last write, which adds significant complexity.

---

## 3. Schedule Type Switching

**Decision**: Switching replaces the schedule in-place (same DB row, cleared fields + deleted `schedule_dates` rows). `occurrence_assignments` and `nextIndex` are **not** touched.

**Rationale**: FR-008/FR-009 states past occurrence records are preserved on type switch. `nextIndex` represents "how far through the queue has cycled" and is valid regardless of the schedule type that generated the occurrences.

**Steps for `PUT /schedule/type { type }`**:

1. Load the rotation's schedule row.
2. Update `type` field.
3. If switching TO `recurrence_rule`: delete all `schedule_dates` rows; null out `rruleType`, `dayOfWeek`, `intervalN`, `monthlyDay`; set `startDate = today`. The schedule is now in an unconfigured-rule state (FR-009) — a follow-up `PUT /schedule/recurrence-rule` call is required before occurrences can be generated.
4. If switching TO `custom_date_list`: null out all recurrence fields and `startDate`.
5. Commit.

The confirmation dialog before switching is a **frontend concern** only. The API executes the switch unconditionally when called.

---

## 4. `CreateRotationRequestDto` Extension

**Decision**: Extend `CreateRotationRequestDto` to include a required `schedule` field containing at minimum a `type`. For `recurrence_rule` type, the rule parameters must also be provided.

**Rationale**: FR-001 requires schedule type to be chosen at creation. Collecting the full configuration in a single request avoids a mandatory two-step creation flow and makes the rotation immediately usable.

**Shape**:

```ts
interface CreateRotationScheduleDto {
  type: 'recurrence_rule' | 'custom_date_list';
  recurrenceRule?: RecurrenceRuleDto;  // required when type = 'recurrence_rule'
  startDate?: string;                   // ISO date; defaults to today (server-side)
}

interface CreateRotationRequestDto {
  name: string;
  schedule: CreateRotationScheduleDto;
}
```

Validation: if `type = recurrence_rule` and `recurrenceRule` is absent → HTTP 422.

**Backward compatibility**: `schedule` FK on `rotations` is nullable. Pre-feature rotations have `schedule_id = NULL`. The API returns `schedule: null` in `RotationResponseDto` for those rotations. The frontend must render a "Set up schedule" prompt when `schedule` is null.

---

## 5. Custom Date Constraints

**Decision**: DB-level UNIQUE constraint on `(schedule_id, date)` in `schedule_dates`. Service-layer cap of 500 entries per schedule (HTTP 422 on overflow).

**Rationale**: The DB constraint is the last line of defence against duplicates (FR-006). The service-layer cap enforces the constitution's 500-date limit.

**Sort order**: Dates are always read ordered ascending by `date` (SQL `ORDER BY date ASC`). Insertion order is irrelevant.

---

## 6. `RotationResponseDto` Extension

**Decision**: Add `schedule: ScheduleDto | null` to `RotationResponseDto`. For `custom_date_list` rotations, include all stored dates inline (sorted ascending).

**Rationale**: The rotation page needs the schedule to render the occurrence view. Bundling it into the existing rotation response avoids an extra network round-trip on page load.

**Payload size**: Up to 500 ISO date strings × ~12 bytes each ≈ 6 KB added to the rotation payload in the worst case. Acceptable for a single-instance deployment.

---

## 7. `nextIndex` and Schedule Interaction

The `nextIndex` field on `rotations` is already maintained by `adjustNextIndex()` in `assignment.helper.ts`. It is **schedule-agnostic** — it only knows about queue positions, not dates. The schedule layer uses `nextIndex` as a read-only input when computing future assignments and advances it during settlement. No changes are needed to the existing `adjustNextIndex` logic.
