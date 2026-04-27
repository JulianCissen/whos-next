# Contract: Occurrence Window Endpoint

**Feature**: V3 UI Redesign | **Date**: 2026-04-26

---

## GET `/api/rotations/:slug/occurrences`

Returns the occurrence window for a rotation — a fixed number of past, current/next, and future occurrences relative to today.

### Changes in this feature

Two optional query parameters are added. The endpoint remains backward-compatible: existing callers without parameters receive the same response shape as before (past defaults to 1, future defaults to 2).

### Query Parameters

| Parameter | Type | Default | Min | Max | Description |
|-----------|------|---------|-----|-----|-------------|
| `past` | integer | `1` | `0` | `52` | Number of past occurrences to include before the current/next one. |
| `future` | integer | `2` | `0` | `52` | Number of future occurrences to include after the current/next one. |

Values outside [0, 52] are clamped silently. Non-integer values are treated as the default.

### Canonical Frontend Call (this feature)

```
GET /api/rotations/{slug}/occurrences?past=1&future=8
```

### Response

```typescript
// Unchanged shape — OccurrenceWindowDto from @whos-next/shared
{
  "past": OccurrenceDto[],     // length ≤ past param (may be fewer if not enough history)
  "next": OccurrenceDto | null,
  "future": OccurrenceDto[]   // length ≤ future param (may be fewer if not enough schedule)
}

interface OccurrenceDto {
  date: string;                  // "YYYY-MM-DD"
  memberId: string | null;
  memberName: string | null;
  isPast: boolean;
  cancelledMemberId: string | null;
  cancelledMemberName: string | null;
}
```

### Response Codes

| Code | Condition |
|------|-----------|
| `200` | Rotation exists. Returns window (may have empty past/future arrays). |
| `404` | Rotation not found or invalid slug format. |

### Invariants

- `past` array entries are in chronological ascending order (oldest → most recent past).
- `future` array entries are in chronological ascending order (nearest → furthest future).
- `next` is always the first occurrence on or after today. If no schedule is configured, all arrays are empty and `next` is `null`.
- Parameter changes do not affect settlement logic — `settleRotation` is always called before building the window.
