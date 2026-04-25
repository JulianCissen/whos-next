# Research: Date-Bound Skip

**Feature**: Date-Bound Skip | **Date**: 2026-04-24

---

## Decision 1: Data Model Discriminator

**Decision**: Add a `skip_type TEXT` column to `occurrence_assignments` with values `'member'`, `'date'`, or `NULL`.

**Rationale**: The existing entity uses `skippedMember IS NOT NULL` as the sole indicator of a member-skip. A date-cancel creates a row where `skippedMember` is always `NULL` (there is no "unavailable member"), so the two skip types would be indistinguishable without an explicit discriminator. A text enum column is the minimal addition — one column, no new table, compatible with `ON DELETE SET NULL` behaviour already on `skipped_member_id`.

**Alternatives considered**:
- Separate `date_cancels` table: higher fidelity but introduces a JOIN for every occurrence query and fragments what is logically a single "skip record" concept.
- `is_date_cancelled BOOLEAN`: simpler to add but less extensible and does not give member-skips an explicit tag (making future detection rely on a two-field heuristic).

**Backfill**: A migration sets `skip_type = 'member'` for all rows where `skipped_member_id IS NOT NULL`. This normalises legacy rows and allows all skip detection to use `skip_type IS NOT NULL` going forward.

---

## Decision 2: `member` Field Semantics for Date-Cancel

**Decision**: For date-cancel rows, `member` stores the would-have-been assignee (snapshot at time of cancel). The field remains non-nullable at the DB level.

**Rationale**: `member` is not nullable in the current schema and making it nullable would require updating every query that populates or reads it. Storing the would-have-been assignee in `member` achieves two goals at zero schema cost:
1. Display: the occurrence card can read `member` to show "Cancelled — would have been [name]".
2. Offset calculation: the `browseForward` helper counts `skip_type = 'date'` rows rather than inspecting `member`, so `member`'s stored value does not interfere with the algorithm.

The browse helpers use `skip_type` to decide how to map `member` to the DTO:
- `skip_type = 'member'`: `member` → `memberId` (effective cover assignee)
- `skip_type = 'date'`: `member` → `cancelledMemberId` (would-have-been); `memberId = null`
- `skip_type = NULL`: `member` → `memberId` (normal settled assignee)

---

## Decision 3: `browseForward` Offset Adjustment

**Decision**: When computing the derived member for an unsettled future occurrence at page index `i`, subtract the number of date-cancel assignments earlier in the page from `i` before passing it to `derivedMemberForFuture`.

**Rationale**: The current formula `(nextIndex + i) % queueLen` assumes every occurrence in the page consumes one queue position. Date-cancels do not — the cancelled member's turn is deferred, not consumed. Without adjustment, every occurrence after the first date-cancel in the page is offset by one and shows the wrong member.

**Concrete example** (queue [A, B, C], nextIndex = 0):
```
Oct 1 (i=0):  no assignment  → adjustedI = 0 → A ✓
Oct 8 (i=1):  date-cancel    → "Cancelled, would have been B" (from stored member field)
Oct 15 (i=2): no assignment  → 1 date-cancel before i → adjustedI = 1 → B ✓  (B gets their deferred turn)
Oct 22 (i=3): no assignment  → 1 date-cancel before i → adjustedI = 2 → C ✓
```
Without adjustment, Oct 15 would derive as C, Oct 22 as A — both wrong.

**`settle()` is already correct**: Date-cancel rows are in the settled set, so `settle()` excludes them from the `unsettled` loop and does not advance `nextIndex` for them. The queue counter naturally lands on the right member for subsequent dates.

---

## Decision 4: Fix `browseBackward` Duplicate Candidates (Pre-existing Bug)

**Decision**: When building the `futureBefore` candidate list in `browseBackward`, filter out dates that already have an `OccurrenceAssignment` row.

**Rationale**: `browseBackward` currently merges candidates from two sources: all `OccurrenceAssignment` rows before the anchor (`kind = 'past'`) and all unsettled future dates before the anchor (`kind = 'future'`). A future occurrence with a skip/cancel record is present in BOTH sources, producing a duplicate in the merged candidate list. This latent bug could cause an occurrence to appear twice in the backward-browse response. The fix is a one-line filter on `futureBefore` using the already-fetched assignment set:

```typescript
const settledDateStrs = new Set(assignments.map(a => toIsoDate(new Date(a.occurrenceDate))));
const futureBefore = allFutureDates
  .filter(d => toIsoDate(d) < before)
  .filter(d => !settledDateStrs.has(toIsoDate(d)));
```

---

## Decision 5: Separate `CancelService` and `POST .../cancel` Endpoint

**Decision**: Implement a new `CancelService` with a single `cancel()` method, registered under `POST /api/rotations/:slug/occurrences/:date/cancel`.

**Rationale**: The date-cancel action has a different validation contract from the member-skip: it does not require a minimum queue size (no cover member needed), so merging the two into one endpoint with a `type` parameter would complicate validation branching. Separate service files respect the 300-line limit and keep each concern independently testable. The endpoint name `cancel` maps directly to the user-facing label "Cancelled."

---

## Decision 6: OccurrenceDto Extension

**Decision**: Add `cancelledMemberId: string | null` and `cancelledMemberName: string | null` to `OccurrenceDto`. The existing `memberId` field is `null` for date-cancelled occurrences (no effective assignee).

**Rationale**: The frontend must distinguish three states — normal, member-skipped, and date-cancelled — to render the correct UI. A dedicated `cancelledMemberId` field makes this unambiguous at the type level:
- `cancelledMemberId !== null` → date-cancelled; show "Cancelled (would have been [name])"
- `skippedMemberId !== null` → member-skipped; show "[cover] covering [original]"
- Both null → normal occurrence

Overloading an existing field would require the frontend to rely on the interaction of multiple nullable fields and `skipType` logic that belongs in the backend.

---

## Evaluation: Lazy-Write Approach Overall

The lazy-write model (settle past dates on demand, derive future assignments from `nextIndex + offset`) is sound for both skip types **provided** the `browseForward` offset adjustment is added. The approach's correctness for date-cancels rests on two properties:

1. `settle()` naturally skips date-cancelled dates (they are pre-settled), so `nextIndex` advances correctly without counting cancelled slots.
2. `browseForward` must apply the offset adjustment to account for the slots that date-cancelled occurrences do not consume.

No structural changes to the lazy-write model are needed. The complexity added is:
- One column migration
- One new service
- One offset-adjustment formula in `browseForward`
- One dedup filter in `browseBackward`
