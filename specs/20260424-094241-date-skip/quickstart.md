# Quickstart: Date-Bound Skip Implementation

**For**: Developer implementing the date-bound cancel feature  
**Prerequisite**: Familiar with the member-bound skip implementation in `specs/20260423-211423-skip-behavior/`

---

## What this feature does

A visitor can cancel an entire occurrence date (e.g. a public holiday). No member performs the task. The member who would have been assigned retains their queue position — their next turn is unchanged.

This is implemented as a **new skip type** layered onto the existing `OccurrenceAssignment` entity, distinguished by the new `skipType` discriminator column.

---

## Key algorithm insight: offset drift in `browseForward`

This is the most important thing to understand before touching any code.

`browseForward` currently maps each future occurrence at page index `i` to a queue member via:
```
member = queue[(nextIndex + i) % queueLen]
```

This assumes every occurrence consumes one queue slot. **Date-cancels do not.** If occurrence at index `i = 1` is date-cancelled, then occurrence at `i = 2` should get the *same* queue member that would have been at `i = 1` without the cancel.

The fix: before computing the derived member for index `i`, count how many date-cancel assignments appear at indices `0..i-1` in the page, and subtract that count from `i`:

```typescript
const dateSkipsBefore = pageDates.slice(0, i).filter(d =>
  assignmentMap.get(toIsoDate(d))?.skipType === 'date'
).length;
member = queue[(nextIndex + i - dateSkipsBefore) % queueLen]
```

`settle()` is already correct and needs no changes: date-cancel rows are pre-settled, so settle's loop skips them and `nextIndex` advances correctly without counting cancelled slots.

---

## Step-by-step implementation order

### 1. Migration (`Migration20260424000005_cancel`)

```sql
ALTER TABLE "occurrence_assignments"
  ADD COLUMN "skip_type" TEXT
  CHECK ("skip_type" IN ('member', 'date'));

UPDATE "occurrence_assignments"
  SET "skip_type" = 'member'
  WHERE "skipped_member_id" IS NOT NULL;
```

### 2. Extend the entity (`occurrence-assignment.entity.ts`)

Add `skipType: 'member' | 'date' | null` property alongside the existing `skippedMember`.

### 3. Extend the shared DTO (`packages/shared/src/schedule/index.ts`)

Add to `OccurrenceDto`:
- `cancelledMemberId: string | null`
- `cancelledMemberName: string | null`

Add `CancelOccurrenceResponseDto = OccurrenceDto` type alias.

### 4. Fix `browseForward` and `browseBackward` (`occurrence-browse.helper.ts`)

**`browseForward`**: Apply the offset-adjustment formula (see above). Map date-cancel assignments to the DTO with `memberId: null` and `cancelledMemberId: [member.id]`.

**`browseBackward`**: Filter settled dates out of `futureBefore` to fix the pre-existing duplicate-candidate bug:
```typescript
const settledDateStrs = new Set(assignments.map(a => toIsoDate(new Date(a.occurrenceDate))));
const futureBefore = allFutureDates
  .filter(d => toIsoDate(d) < before)
  .filter(d => !settledDateStrs.has(toIsoDate(d)));
```
Also map date-cancel past assignments to the updated DTO shape.

### 5. Update `SkipService` (`skip.service.ts`)

Replace the `skippedMember !== null` guard with `skipType !== null`:
```typescript
if (existingAssignment?.skipType != null) {
  throw new ConflictException({ ... 'OCCURRENCE_ALREADY_SKIPPED' ... });
}
```
Also set `skipType: 'member'` when writing new member-skip assignment rows.

### 6. Implement `CancelService` (`cancel.service.ts`)

Follows the same pattern as `SkipService`:
1. Validate date format, slug, and schedule membership
2. Call `settle()`
3. Check for existing skip (`skipType != null` → 409)
4. Compute would-have-been assignee (same `computeFutureAssignedMember` logic as skip service, but no cover member needed)
5. Write or update `OccurrenceAssignment` with `member = wouldHaveBeen`, `skippedMember = null`, `skipType = 'date'`
6. Return `CancelOccurrenceResponseDto`

No queue-size check needed (cancel requires no cover member).

### 7. Register route (`schedule.controller.ts`)

```
POST /rotations/:slug/occurrences/:date/cancel → CancelService.cancel()
```

### 8. Update occurrence read path (`occurrence.service.ts`)

Ensure `OccurrenceDto` results from `occurrence.service.ts` populate `cancelledMemberId`/`cancelledMemberName` correctly (sourced from the browse helper output).

### 9. Frontend: `schedule.api.ts`

Add:
```typescript
cancelOccurrence(slug: string, date: string): Observable<CancelOccurrenceResponseDto>
```

### 10. Frontend: `occurrence-card.component`

Rework the skip action area:
- Replace the current single (prominent) member-skip button with a low-key "Skip" trigger
- On trigger activation, expand an inline panel showing both options with equal visual weight:
  - "Cancel date" → calls `cancelOccurrence()`
  - "Mark member unavailable" → calls existing `skipOccurrence()`
- On cancel success, update the card to show the "Cancelled" state with `cancelledMemberName`
- On cancel failure, show an inline error within the expanded panel (panel stays open for retry)
- When `cancelledMemberId !== null`: show "Cancelled — would have been [cancelledMemberName]"
- When `skippedMemberId !== null`: show existing member-skip indicator
- When both null: show normal assignee + the "Skip" trigger

### 11. i18n (`en.json`, `nl.json`)

Add translation keys for:
- The "Skip" trigger label
- "Cancel date" option label
- "Mark member unavailable" option label
- "Cancelled" state label
- "Would have been [name]" display text
- Error message for cancel failure
- Accessibility labels for the trigger and panel

### 12. Accessibility

- The "Skip" trigger must be keyboard-accessible (focus, Enter/Space to activate)
- The inline panel must be announced to screen readers when it expands
- Both options in the panel must have clear accessible labels
- The "Cancelled" and member-skip indicator states must convey meaning without relying solely on colour

### 13. Bruno test files

Add `cancel-occurrence.bru` with happy path and error cases (already-skipped, not-in-schedule, invalid-date).

---

## What NOT to change

- `settle()` in `SkipService` — it handles date-cancels correctly without modification
- `rotation.nextIndex` advancement logic — unchanged; settle's loop naturally skips pre-settled cancel rows
- The unique constraint on `(rotation_id, occurrence_date)` — unchanged; it correctly prevents duplicate rows for cancelled occurrences

---

## Testing checklist

- [ ] Unit: `CancelService.cancel()` — happy path, already-skipped conflict, not-in-schedule, queue-size-1 (should succeed unlike member-skip)
- [ ] Unit: `browseForward` — date-cancel at offsets 0, 1, mid-page; verify subsequent member derivation
- [ ] Unit: `browseBackward` — no duplicate entries for skip-assigned future dates
- [ ] Integration: cancel → browse → verify `cancelledMemberId` populated; verify next occurrence shows same would-have-been member
- [ ] e2e: cancel flow via UI; both options accessible; error retry; "Cancelled" state displayed
- [ ] e2e (axe): skip trigger, inline panel, and all card states meet WCAG 2.2 AA
