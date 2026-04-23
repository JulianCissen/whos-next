# API Contract: Occurrence View

**Base path**: `/api/rotations/:slug/occurrences`
**Auth**: None (stateless slug-based access — Constitution II)
**Content-Type**: `application/json`

**Settlement side effect**: Every call to these endpoints triggers a lazy settlement pass that records any elapsed scheduled dates into `occurrence_assignments` and advances `nextIndex`. Settlement runs inside a transaction; concurrent calls are safe due to the UNIQUE constraint on `occurrence_assignments(rotation_id, occurrence_date)`.

---

## GET /api/rotations/:slug/occurrences

Return the occurrence window centred on today: the next upcoming occurrence and the most recent past occurrence. Used for the primary rotation page load (FR-010, FR-011).

### Response `200 OK` — `OccurrenceWindowDto`

```json
{
  "previous": {
    "date": "2026-04-14",
    "memberId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "memberName": "Alice",
    "isPast": true
  },
  "next": {
    "date": "2026-04-28",
    "memberId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "memberName": "Bob",
    "isPast": false
  }
}
```

**Null fields**:

| Field | When null |
|-------|-----------|
| `previous` | No past occurrences exist — show empty state (FR-012) |
| `next` | No future occurrences — empty custom date list or unconfigured schedule (FR-013) |
| `memberId` / `memberName` | Queue was empty at assignment time |

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Rotation not found |

---

## GET /api/rotations/:slug/occurrences/browse

Browse occurrences forward or backward from an anchor date, one step at a time. Used for the forward/backward navigation controls (FR-014–FR-018).

### Query parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `after` | ISO date `YYYY-MM-DD` | Mutually exclusive with `before` | Return the first occurrence(s) strictly **after** this date (forward browsing) |
| `before` | ISO date `YYYY-MM-DD` | Mutually exclusive with `after` | Return the last occurrence(s) strictly **before** this date (backward browsing) |
| `limit` | integer | No (default `1`) | Number of occurrences to return; range 1–10 |

Exactly one of `after` or `before` must be supplied.

### Response `200 OK` — `BrowseOccurrencesResponseDto`

```json
{
  "occurrences": [
    {
      "date": "2026-05-05",
      "memberId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "memberName": "Bob",
      "isPast": false
    }
  ],
  "hasMore": true
}
```

**`hasMore` semantics**:

| Query type | `hasMore: true` | `hasMore: false` |
|------------|-----------------|-----------------|
| `after` (forward) | More future occurrences exist beyond the last returned item. For recurrence-rule schedules this is **always** `true` (unbounded series, FR-015). | No further future occurrences (custom date list exhausted). |
| `before` (backward) | More past occurrences exist before the first returned item. | The first returned occurrence is the earliest in the series — backward navigation should be disabled (FR-018). |

### Frontend navigation pattern

```
Initial load:
  GET /occurrences  →  { previous, next }

User clicks "Next" (currently displaying occurrence at DATE):
  GET /occurrences/browse?after=DATE&limit=1

User clicks "Previous" (currently displaying occurrence at DATE):
  GET /occurrences/browse?before=DATE&limit=1
```

The frontend holds the currently displayed occurrence date as component signal state. The URL does not change when browsing (FR session-local navigation assumption).

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Both `after` and `before` provided; neither provided; invalid date format; `limit` out of range |
| 404 | Rotation not found |

---

## Assignment Derivation Rules

**Past occurrences** (`isPast: true`): `memberId` is read directly from `occurrence_assignments` (settled records).

**Future occurrences** (`isPast: false`): assignment computed deterministically from current `nextIndex` and the active member queue. The N-th future occurrence uses `queue[(nextIndex + N − 1) % queueLength]`. If the queue is empty, `memberId` and `memberName` are `null`.

**Custom date list — future assignment indexing** (FR-021): future assignments are indexed from the count of elapsed past occurrences. Removing a future date shifts all subsequent future assignments up by one position (i.e., `nextIndex` after settlement reflects only the elapsed count, not the removed date).
