# API Contract: Schedule Management

**Base path**: `/api/rotations/:slug/schedule`
**Auth**: None (stateless slug-based access — Constitution II)
**Content-Type**: `application/json`

All endpoints settle past occurrences as a side effect only when the occurrence window is queried; schedule management endpoints do **not** trigger settlement.

---

## PUT /api/rotations/:slug/schedule/recurrence-rule

Configure or replace the recurrence rule for a rotation whose schedule type is `recurrence_rule`. On update, `startDate` resets to today unless explicitly supplied (FR-002b).

### Request body — `ConfigureRecurrenceRuleRequestDto`

```json
// Weekly on Monday
{
  "rule": { "type": "weekly", "dayOfWeek": 1 }
}

// Every 2 weeks on Friday
{
  "rule": { "type": "every_n_weeks", "dayOfWeek": 5, "intervalN": 2 }
}

// Monthly on the 15th
{
  "rule": { "type": "monthly", "monthlyDay": 15 }
}

// With explicit start date
{
  "rule": { "type": "weekly", "dayOfWeek": 3 },
  "startDate": "2026-05-01"
}
```

`startDate` is optional; omitting it defaults to today (server-side date). When updating an existing rule (any parameter change), the server resets `startDate` to today before applying an explicit override.

### Response `200 OK` — `ScheduleDto`

```json
{
  "type": "recurrence_rule",
  "recurrenceRule": { "type": "weekly", "dayOfWeek": 1 },
  "startDate": "2026-04-22"
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Rotation not found |
| 409 | Rotation's schedule type is `custom_date_list` — switch type first |
| 422 | Missing or invalid rule parameters |

---

## PUT /api/rotations/:slug/schedule/type

Switch the schedule type. **Destructive**: clears the existing schedule configuration (recurrence rule fields or all custom dates). Past occurrence records in `occurrence_assignments` are preserved.

The confirmation dialog is a **frontend responsibility**. The API executes the switch unconditionally.

### Request body — `SwitchScheduleTypeRequestDto`

```json
{ "type": "custom_date_list" }
```

### Response `200 OK` — `ScheduleDto` (new type, unconfigured)

```json
// After switching to custom_date_list
{ "type": "custom_date_list", "dates": [] }

// After switching to recurrence_rule
{ "type": "recurrence_rule" }
```

A `recurrence_rule` schedule returned without `recurrenceRule` or `startDate` is in the **unconfigured** state. No occurrences are generated until `PUT /schedule/recurrence-rule` is called.

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Rotation not found |
| 422 | Invalid type value |

---

## POST /api/rotations/:slug/schedule/dates

Add a specific date to a custom date list schedule.

### Request body — `AddCustomDateRequestDto`

```json
{ "date": "2026-06-10" }
```

### Response `201 Created` — `CustomDateDto`

```json
{ "date": "2026-06-10" }
```

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Rotation not found |
| 409 | Date already exists in the list (FR-006) |
| 409 | Rotation's schedule type is `recurrence_rule` |
| 422 | Invalid or unparseable date string |
| 422 | Adding this date would exceed the 500-date cap |

---

## DELETE /api/rotations/:slug/schedule/dates/:date

Remove a specific date from a custom date list schedule. `:date` must be a URL-encoded ISO date string (`YYYY-MM-DD`).

Future assignments re-derive from the remaining dates (FR-021): removing any future date shifts all subsequent future assignments up by one queue position.

### Response `204 No Content`

### Errors

| Status | Condition |
|--------|-----------|
| 404 | Rotation not found |
| 404 | Date not in the list |
| 409 | Rotation's schedule type is `recurrence_rule` |
