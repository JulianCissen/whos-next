# Quickstart: Schedule Configuration and Occurrence View

**Feature**: `20260422-170340-schedule-occurrence-view`

This guide covers the key invariants, algorithms, and integration points needed to implement this feature. Read alongside `data-model.md`, `contracts/`, and the spec.

---

## Key Invariants

1. **`nextIndex` is schedule-agnostic.** It tracks queue position only, not dates. `adjustNextIndex()` (already in `assignment.helper.ts`) maintains it across queue mutations. The schedule layer reads `nextIndex` as input and advances it during settlement.

2. **Settlement is idempotent.** The UNIQUE constraint on `occurrence_assignments(rotation_id, occurrence_date)` ensures a repeated settlement run for the same date is a no-op. Safe for concurrent requests.

3. **`computeRecurrenceDates` is the single source of truth** for generating occurrence dates from a rule. It lives in `packages/shared/src/schedule/index.ts` and is used by both the backend (settlement, occurrence view) and the frontend (preview of upcoming dates while configuring).

4. **Schedule type switch never touches `occurrence_assignments` or `nextIndex`.** The confirmation dialog is a frontend-only concern; the API executes unconditionally.

5. **All dates are calendar dates.** No time component anywhere. Store as PostgreSQL `DATE`. Transmit as ISO string `"YYYY-MM-DD"`. Never use `Date` with time zones in business logic — always work with year/month/day values.

---

## Settlement Algorithm

Runs inside a database transaction on every `GET /occurrences` call:

```typescript
async function settle(rotation: RotationEntity, schedule: ScheduleEntity, em: EntityManager): Promise<void> {
  const yesterday = localYesterday(); // calendar date; no time

  // 1. All scheduled dates that have already elapsed
  const elapsedDates: Date[] = schedule.type === 'recurrence_rule'
    ? computeRecurrenceDates(toRuleDto(schedule), schedule.startDate!, new Date(0), MAX_SETTLE_LIMIT)
        .filter(d => d <= yesterday)
    : await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } })
        .then(rows => rows.map(r => r.date).filter(d => d <= yesterday));

  // 2. Dates already settled
  const settled = await em.find(OccurrenceAssignment, { rotation });
  const settledSet = new Set(settled.map(a => toIsoDate(a.occurrenceDate)));

  // 3. Unsettled = elapsed − settled
  const unsettled = elapsedDates.filter(d => !settledSet.has(toIsoDate(d)));
  if (unsettled.length === 0) return;

  // 4. Assign and record
  const queue = await activeQueue(rotation, em); // sorted by position
  let idx = rotation.nextIndex;

  for (const date of unsettled) {
    if (queue.length > 0) {
      const assignment = new OccurrenceAssignment(rotation, date, queue[idx]);
      em.persist(assignment);
      idx = (idx + 1) % queue.length;
    }
  }

  rotation.nextIndex = idx;
  await em.flush();
}
```

`MAX_SETTLE_LIMIT` should be large enough to cover all realistic elapsed dates (e.g., 10 000). The result is filtered to `≤ yesterday` before taking the diff, so only truly elapsed dates are settled.

---

## `computeRecurrenceDates` Implementation Guide

Located at `packages/shared/src/schedule/index.ts`.

```typescript
export function computeRecurrenceDates(
  rule: RecurrenceRuleDto,
  startDate: Date,
  from: Date,
  limit: number,
): Date[] {
  const results: Date[] = [];
  let current = firstOccurrence(rule, startDate);

  while (results.length < limit) {
    if (results.length > 0 || current >= from) {
      if (current >= from) results.push(cloneDate(current));
    }
    current = nextOccurrence(rule, current);
    // Safety: break if somehow stuck (should not happen with valid rules)
    if (results.length === 0 && isTooFarFuture(current)) break;
  }
  return results;
}
```

**`firstOccurrence(rule, startDate)`**:
- `weekly` / `every_n_weeks`: advance `startDate` day-by-day until `getDay() === isoToJs(rule.dayOfWeek)`.
- `monthly`: construct `new Date(startDate.getFullYear(), startDate.getMonth(), rule.monthlyDay!)`. If that overflows (day shifted by JS Date arithmetic), advance to the next month. Repeat until the constructed date ≥ `startDate`.

**`nextOccurrence(rule, current)`**:
- `weekly`: add 7 days.
- `every_n_weeks`: add `7 * rule.intervalN!` days.
- `monthly`: advance one month with `new Date(y, m + 1, rule.monthlyDay!)`. If the day overflows, skip to the month after that (FR-003).

**ISO weekday → JS weekday**: `jsDay = isoDay % 7` (ISO 7 = Sunday → JS 0 ✓).

**Overflow detection for monthly**: After `new Date(y, m, D)`, check `result.getDate() === D`. If not, JS rolled the day into the next month — skip.

---

## Frontend: Occurrence View State Machine

The `OccurrenceViewComponent` manages a browsing cursor as an Angular signal:

```typescript
// Internal browsing state
private browseCursor = signal<{ date: string; direction: 'forward' | 'backward' } | null>(null);

// Displayed occurrence
displayed = computed(() => {
  const cursor = this.browseCursor();
  return cursor === null ? this.windowOccurrence() : this.browseResult();
});
```

**On component init**: call `GET /occurrences` → populate `windowOccurrence`.

**On "Next" button pressed** (currently showing occurrence at `DATE`):
```
GET /occurrences/browse?after=DATE&limit=1
```
Update `browseCursor` and `browseResult`. Disable "Next" button when `hasMore: false`.

**On "Previous" button pressed** (currently showing occurrence at `DATE`):
```
GET /occurrences/browse?before=DATE&limit=1
```
Disable "Previous" button when `hasMore: false` (FR-018).

**Reset to window**: re-call `GET /occurrences`, clear `browseCursor`.

---

## Frontend: Schedule Configuration Form

`ScheduleConfigComponent` is used in two contexts:
1. **During rotation creation** (inside `CreateRotationFormComponent`) — emits `ConfigureRecurrenceRuleRequestDto` or `ScheduleType` selection as part of the create request.
2. **On the rotation page settings panel** — calls `PUT /schedule/recurrence-rule` or `PUT /schedule/type` + `PUT /schedule/dates` directly.

The component splits into:
- `ScheduleConfigComponent` — top-level: schedule type selector + recurrence rule sub-form.
- `CustomDatesListComponent` — extracted for the date add/remove list (≤ 200 lines TS each).

**Schedule type switch guard**: show a Material `MatDialog` confirmation before calling `PUT /schedule/type`. On cancel, do nothing. On confirm, call the API and reload the rotation.

---

## i18n Keys

All new keys follow the `schedule.*` and `occurrence.*` namespaces:

```
schedule.type.recurrence_rule
schedule.type.custom_date_list
schedule.rrule.weekly
schedule.rrule.every_n_weeks
schedule.rrule.monthly
schedule.rrule.day_of_week.label
schedule.rrule.interval_n.label
schedule.rrule.monthly_day.label
schedule.start_date.label
schedule.start_date.toggle
schedule.switch_type.confirm_title
schedule.switch_type.confirm_body
schedule.custom_date.add_label
schedule.custom_date.empty_state
schedule.error.duplicate_date
schedule.error.date_cap_exceeded

occurrence.next.label
occurrence.previous.label
occurrence.empty_state.no_upcoming
occurrence.empty_state.no_history
occurrence.empty_state.no_schedule
occurrence.navigate.forward
occurrence.navigate.backward
occurrence.assigned_to
```

---

## File Size Budget

All new files must stay under the 300-line hard limit. Planned decomposition:

| File | Responsibility | Target |
|------|---------------|--------|
| `recurrence.helper.ts` | `computeRecurrenceDates` pure function | ≤ 100 lines |
| `occurrence.helper.ts` | Settlement helpers (`computeElapsedDates`, `toIsoDate`) | ≤ 80 lines |
| `schedule.service.ts` | configure, addDate, removeDate, switchType | ≤ 200 lines |
| `occurrence.service.ts` | settlement + getWindow + browse | ≤ 200 lines |
| `schedule.controller.ts` | Route handlers (thin, delegates to services) | ≤ 100 lines |
| `schedule-config.component.ts` | Type selector + recurrence sub-form | ≤ 200 lines TS |
| `custom-dates-list.component.ts` | Date add/remove list (extracted presentational) | ≤ 150 lines TS |
| `occurrence-view.component.ts` | Browsing state + navigation | ≤ 180 lines TS |
| `occurrence-card.component.ts` | Single occurrence display card (presentational) | ≤ 80 lines TS |

---

## Adding a New Recurrence Rule Type (Extension Guide)

1. Add the new `RecurrenceRuleType` value to `packages/shared/src/schedule/index.ts`.
2. Implement the `firstOccurrence` and `nextOccurrence` cases in `computeRecurrenceDates`.
3. Add a validation branch in `ScheduleService.configureRecurrenceRule()`.
4. Add a DB migration if new columns are required in `schedules`.
5. Add a UI option in `ScheduleConfigComponent` (with an i18n key).
6. Add unit tests for the new case in `packages/shared`.
