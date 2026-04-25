# Data Model: Date-Bound Skip

## Schema changes

### `occurrence_assignments` table — one new column

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `skip_type` | TEXT | YES | NULL | NULL = not skipped; `'member'` = member-bound skip; `'date'` = date-bound cancel |

**Constraint**: `CHECK (skip_type IN ('member', 'date') OR skip_type IS NULL)`

**Migration**: `Migration20260424000005_cancel`
```sql
ALTER TABLE "occurrence_assignments"
  ADD COLUMN "skip_type" TEXT
  CHECK ("skip_type" IN ('member', 'date'));

-- Backfill: tag all existing member-skip rows
UPDATE "occurrence_assignments"
  SET "skip_type" = 'member'
  WHERE "skipped_member_id" IS NOT NULL;
```

No new index needed; all skip lookups remain through the (rotation_id, occurrence_date) unique constraint.

---

## Entity changes

### `OccurrenceAssignment` (extended)

```
OccurrenceAssignment
├── id: UUID (PK, inherited)
├── createdAt: Date (inherited)
├── updatedAt: Date (inherited)
├── rotation: Rotation (FK, cascade delete)
├── occurrenceDate: string (ISO date YYYY-MM-DD)
├── member: Member (FK, non-nullable)
│      ← normal/member-skip: effective assignee (cover when member-skipped)
│      ← date-cancel: would-have-been assignee (snapshot; displayed but not the effective assignee)
├── skippedMember: Member | null
│      ← non-null only when skipType = 'member' (the original unavailable member)
└── skipType: 'member' | 'date' | null
       ← null = normal settled; 'member' = member skip; 'date' = date cancel
```

**Row semantics by skipType**:

| skipType | member field | skippedMember field | Effective assignee | Display |
|----------|-------------|---------------------|--------------------|---------|
| `null` | assignee | `null` | member | Normal occurrence |
| `'member'` | cover | original (unavailable) | member (cover) | "[cover] covering [original]" |
| `'date'` | would-have-been | `null` | none | "Cancelled — would have been [member]" |

---

## Shared DTO changes

### `OccurrenceDto` (extended)

```typescript
interface OccurrenceDto {
  date: string;                       // ISO date "YYYY-MM-DD" — unchanged
  memberId: string | null;            // effective assignee; NULL for date-cancelled occurrences
  memberName: string | null;          // — unchanged semantics
  isPast: boolean;                    // — unchanged
  skippedMemberId: string | null;     // member-skip: original unavailable member; null otherwise
  skippedMemberName: string | null;   // — unchanged
  cancelledMemberId: string | null;   // NEW — date-cancel: would-have-been member; null otherwise
  cancelledMemberName: string | null; // NEW — date-cancel: would-have-been member name; null otherwise
}
```

All fields always present (never `undefined`). Frontend distinguishes states via:
- `cancelledMemberId !== null` → date-cancelled occurrence
- `skippedMemberId !== null` → member-skipped occurrence
- Both null → normal occurrence (or unsettled future)

### New: `CancelOccurrenceResponseDto`

```typescript
export type CancelOccurrenceResponseDto = OccurrenceDto;
```

Same shape as `OccurrenceDto`, returned by the cancel endpoint with `cancelledMemberId` populated and `memberId = null`.

---

## Browse helper changes

### `browseForward` — offset adjustment

For each unsettled future occurrence at page index `i`, subtract the number of date-cancel assignments earlier in the page before deriving the queue member:

```typescript
const dateSkipCountBefore = pageDates.slice(0, i).filter(d =>
  assignmentMap.get(toIsoDate(d))?.skipType === 'date'
).length;
const adjustedOffset = i - dateSkipCountBefore;
const { memberId, memberName } = derivedMemberForFuture(queue, rotation.nextIndex, adjustedOffset);
```

Date-cancelled entries in the assignment map are returned with `memberId: null` and `cancelledMemberId: [member.id]` rather than using `member` as the effective assignee.

### `browseBackward` — duplicate deduplication fix

Filter settled dates out of the unsettled-future candidate list to prevent doubled entries:

```typescript
const settledDateStrs = new Set(assignments.map(a => toIsoDate(new Date(a.occurrenceDate))));
const futureBefore = allFutureDates
  .filter(d => toIsoDate(d) < before)
  .filter(d => !settledDateStrs.has(toIsoDate(d)));
```

---

## State transitions

```
Occurrence (any date)
       │
       ▼
  [unsettled]          ← no OccurrenceAssignment row; derived from queue + nextIndex
       │
       ├── settle() / time passes
       │         ▼
       │    [settled-normal]       skipType = null, skippedMember = null
       │
       ├── POST .../cancel
       │         ▼
       │    [cancelled]            skipType = 'date', member = would-have-been, skippedMember = null
       │                           (immutable — no further skip of either type accepted)
       │
       └── POST .../skip (existing)
                 ▼
            [member-skipped]       skipType = 'member', member = cover, skippedMember = original
                                   (immutable — no further skip of either type accepted)
```

All skip states are terminal for this release.

---

## Validation rules (cancel endpoint)

| Rule | Error code | HTTP |
|------|------------|------|
| Rotation slug not found | `ROTATION_NOT_FOUND` | 404 |
| Date format invalid (not YYYY-MM-DD) | `INVALID_DATE` | 400 |
| Date not in rotation schedule | `OCCURRENCE_NOT_IN_SCHEDULE` | 400 |
| Occurrence already has any skip record (`skipType IS NOT NULL`) | `OCCURRENCE_ALREADY_SKIPPED` | 409 |

Note: The cancel endpoint does **not** check minimum queue size — date-cancels require no cover member and are valid for any queue length including a single-member rotation.

---

## Impact on existing skip validation

`SkipService.skip()` currently checks `skippedMember !== null` to detect an existing skip. With the `skipType` backfill, this check can be upgraded to the authoritative `skipType IS NOT NULL` check, removing the dependency on `skippedMember` nullability as a proxy:

```typescript
// Before
if (existingAssignment?.skippedMember !== null && ...) { throw conflict; }

// After
if (existingAssignment?.skipType !== null && existingAssignment?.skipType !== undefined) { throw conflict; }
```

This makes `SkipService` correctly reject skip attempts on already-date-cancelled occurrences.
