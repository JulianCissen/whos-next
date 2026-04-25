# Contract: Cancel Occurrence (Date-Bound Skip)

**Endpoint**: `POST /api/rotations/:slug/occurrences/:date/cancel`  
**Service**: `CancelService.cancel(slug, date)`  
**Auth**: None (stateless slug-based access)

---

## Request

| Part | Value |
|------|-------|
| Method | `POST` |
| Path | `/api/rotations/:slug/occurrences/:date/cancel` |
| Body | None |
| Content-Type | Not required |

### Path parameters

| Parameter | Format | Example | Notes |
|-----------|--------|---------|-------|
| `slug` | 8-char base-58 string | `aB3xY7qP` | Identifies the rotation |
| `date` | ISO date `YYYY-MM-DD` | `2026-05-05` | The occurrence date to cancel |

---

## Success response

**Status**: `200 OK`  
**Content-Type**: `application/json`

```json
{
  "date": "2026-05-05",
  "memberId": null,
  "memberName": null,
  "isPast": false,
  "skippedMemberId": null,
  "skippedMemberName": null,
  "cancelledMemberId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "cancelledMemberName": "Alice"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` | ISO date of the cancelled occurrence |
| `memberId` | `null` | Always null — no effective assignee for a date-cancel |
| `memberName` | `null` | Always null |
| `isPast` | `boolean` | `true` if the date is before today |
| `skippedMemberId` | `null` | Always null — no member-skip involved |
| `skippedMemberName` | `null` | Always null |
| `cancelledMemberId` | `string` | UUID of the would-have-been assignee at the time of cancel |
| `cancelledMemberName` | `string` | Display name of the would-have-been assignee |

---

## Error responses

### 400 — Invalid date format

```json
{
  "statusCode": 400,
  "error": "INVALID_DATE",
  "message": "Date must be YYYY-MM-DD"
}
```

### 400 — Date not in schedule

```json
{
  "statusCode": 400,
  "error": "OCCURRENCE_NOT_IN_SCHEDULE",
  "message": "This date is not a scheduled occurrence for this rotation"
}
```

### 404 — Rotation not found

```json
{
  "statusCode": 404,
  "error": "ROTATION_NOT_FOUND",
  "message": "Rotation not found"
}
```

### 409 — Already skipped

```json
{
  "statusCode": 409,
  "error": "OCCURRENCE_ALREADY_SKIPPED",
  "message": "This occurrence has already been skipped"
}
```

Returned for both date-cancel and member-skip conflicts — if any skip type has already been applied, the occurrence is immutable.

---

## Behaviour notes

- The cancel endpoint does **not** validate queue size. A rotation with a single member can still have a date cancelled (there is no cover member needed).
- `settle()` is called before the cancel is applied, ensuring past unsettled occurrences are resolved and `rotation.nextIndex` is current before the would-have-been assignee is computed.
- The computed would-have-been assignee is snapshotted at the time of the request and stored in the `member` field of the `OccurrenceAssignment` row. Subsequent queue changes do not retroactively alter the stored assignee.
- The cancel is idempotency-safe at the DB level: the unique constraint on `(rotation_id, occurrence_date)` prevents duplicate rows; the 409 guard prevents overwriting an existing skip record.

---

## Comparison with existing member-skip endpoint

| Aspect | `POST .../skip` | `POST .../cancel` |
|--------|----------------|-------------------|
| Queue size requirement | ≥ 2 members (cover needed) | None |
| Queue advances? | No (cover uses next slot but original slot unchanged) | No (cancelled slot not counted) |
| `memberId` in response | Cover member | `null` |
| `cancelledMemberId` in response | `null` | Would-have-been member |
| `skippedMemberId` in response | Original unavailable member | `null` |
| Conflicts with each other? | Yes — `409` if other type already applied | Yes — `409` if other type already applied |
