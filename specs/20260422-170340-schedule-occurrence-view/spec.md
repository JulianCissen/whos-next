# Feature Specification: Schedule Configuration and Occurrence View

**Feature Branch**: `20260422-170340-schedule-occurrence-view`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: User description: "A rotation has a schedule that defines when occurrences happen, and a view that shows who is assigned to each occurrence. Two schedule types exist: (1) recurrence rules — weekly on a specific day of the week, every N weeks on a specific day, or monthly on a specific day number; (2) custom date list — a manually curated set of specific dates that can be added to or removed from at any time. The schedule type is chosen when creating the rotation; it can be changed later but doing so resets the schedule configuration. The occurrence view shows: the next upcoming occurrence with its assignee and date prominently displayed, the most recent past occurrence, the ability to browse forward through all future occurrences with no upper limit, and the ability to browse backward through all past occurrences."

## User Scenarios & Testing *(mandatory)*

## Clarifications

### Session 2026-04-22

- Q: When does a recurrence-rule series first begin? → A: A visitor-configured start date, defaulting to today (current date). The start date input is collapsed/hidden by default and can be expanded to set it explicitly. On schedule reconfiguration, the start date resets to the current date by default but can be manually overridden again.
- Q: When the queue changes (member added, removed, or reordered), how are assignments affected? → A: Past occurrences (dates already elapsed) retain their recorded assignment unchanged. Future occurrences re-derive from the current queue state at the time of viewing.
- Q: When a date is removed from a custom date list, how are subsequent future assignments affected? → A: Re-index from history — future assignments re-derive based on the count of elapsed past occurrences. Removing any future date shifts all subsequent future assignments up by one queue position.

---

### User Story 1 - View Current and Previous Occurrence (Priority: P1)

A visitor opens a rotation link and immediately sees who is responsible for the next upcoming occurrence and when it is, along with who handled the most recent past occurrence. This is the primary daily-use view — most visitors visit a rotation simply to know whose turn it is right now.

**Why this priority**: This delivers the core value of the entire product. Everything else supports this moment. A rotation with a schedule but no visible assignment answer is not functional.

**Independent Test**: Can be fully tested by opening a rotation that has a configured schedule and at least one past occurrence, verifying the next assignee and date are prominently shown and the most recent past assignee and date are also displayed.

**Acceptance Scenarios**:

1. **Given** a rotation with a recurrence-rule schedule and members in the queue, **When** a visitor opens the rotation, **Then** the next upcoming occurrence date and its assigned member are displayed prominently at the top of the view.
2. **Given** a rotation with at least one past occurrence, **When** a visitor opens the rotation, **Then** the most recent past occurrence date and its assigned member are also displayed.
3. **Given** a rotation where no past occurrences have yet occurred (e.g., the rotation was just created), **When** a visitor opens the rotation, **Then** the previous occurrence section displays a clear empty-state message indicating no past occurrences exist.
4. **Given** a rotation where no future occurrences can be determined (e.g., an empty custom date list with no future dates), **When** a visitor opens the rotation, **Then** the next occurrence section clearly indicates there are no upcoming occurrences.

---

### User Story 2 - Configure Recurrence Rule Schedule at Creation (Priority: P2)

A visitor creating a new rotation selects "recurrence rule" as the schedule type and configures one of the three supported rule patterns: weekly on a specific day of the week, every N weeks on a specific day, or monthly on a specific day number. The schedule immediately drives occurrence generation.

**Why this priority**: Most rotations will use recurrence rules. This is the default and most common schedule path, and it must work before custom date lists or schedule switching is needed.

**Independent Test**: Can be fully tested by creating a rotation with a recurrence rule, then verifying that occurrences are generated at the correct dates and assigned to members in queue order.

**Acceptance Scenarios**:

1. **Given** a visitor is creating a rotation, **When** they select "recurrence rule" as the schedule type, **Then** they are presented with the three rule options: weekly on a day, every N weeks on a day, or monthly on a day number.
2. **Given** a rotation configured as "every Monday", **When** viewing occurrences, **Then** each occurrence date falls on a Monday and they are one week apart.
3. **Given** a rotation configured as "every 2 weeks on Friday", **When** viewing occurrences, **Then** each occurrence date falls on a Friday and they are two weeks apart.
4. **Given** a rotation configured as "monthly on the 15th", **When** viewing occurrences, **Then** each occurrence date is the 15th of successive months.
5. **Given** a visitor updating an existing recurrence rule (e.g., changing from Monday to Wednesday), **When** the change is saved, **Then** future occurrence dates reflect the new rule and all past occurrence records are unchanged.

---

### User Story 3 - Configure Custom Date List Schedule (Priority: P3)

A visitor creating a new rotation selects "custom date list" as the schedule type and manually adds specific dates. Dates can be added or removed at any time after creation, giving the visitor full control over the exact occurrence schedule.

**Why this priority**: Custom date lists support the irregular-schedule use case (e.g., project milestones, event-based rotations). It is less common than recurrence rules but required for completeness.

**Independent Test**: Can be fully tested by creating a rotation with a custom date list, adding and removing dates, then verifying that occurrences exist exactly for the dates present in the list and assignments follow queue order.

**Acceptance Scenarios**:

1. **Given** a visitor is creating a rotation, **When** they select "custom date list" as the schedule type, **Then** they are presented with a date input to add specific dates.
2. **Given** a rotation with a custom date list, **When** a visitor adds a new date, **Then** that date appears in the occurrence list and is assigned to the appropriate member per queue order.
3. **Given** a rotation with a custom date list, **When** a visitor removes a date, **Then** that occurrence is removed and the remaining occurrences re-resolve queue assignments correctly.
4. **Given** a custom date list rotation, **When** a visitor adds the same date twice, **Then** the duplicate is rejected and only one occurrence exists for that date.

---

### User Story 4 - Browse Future and Past Occurrences (Priority: P4)

A visitor wants to look ahead to see who is assigned to future occurrences, or look back to review the full assignment history. They can navigate forward through all future occurrences (with no defined upper limit) and backward through all past ones.

**Why this priority**: The current/previous view covers daily use, but planning ahead and auditing history are important secondary workflows. Browsing requires a working schedule first, so it follows P1–P3.

**Independent Test**: Can be fully tested by navigating forward from the current occurrence several steps and verifying the assigned members cycle through the queue, then navigating backward and verifying past dates and assignments are correct.

**Acceptance Scenarios**:

1. **Given** a rotation with a recurrence-rule schedule, **When** a visitor browses forward from the current occurrence, **Then** they can advance one occurrence at a time and see the date and assigned member for each.
2. **Given** a visitor at the current occurrence, **When** they continue browsing forward indefinitely, **Then** the view never reaches a hard stop — future occurrences continue to be generated on demand.
3. **Given** a rotation with at least two past occurrences, **When** a visitor browses backward from the current occurrence, **Then** they can step back one occurrence at a time, seeing date and assigned member for each past occurrence.
4. **Given** a visitor browsing backward and reaching the very first occurrence, **When** they attempt to navigate further back, **Then** no earlier occurrence is shown and the navigation control is disabled or hidden.
5. **Given** a custom date list rotation, **When** a visitor browses future occurrences, **Then** only dates in the list are shown as occurrences; no synthetic dates are generated.

---

### User Story 5 - Switch Schedule Type (Priority: P5)

A visitor changes the schedule type of an existing rotation (for example, switching from a recurrence rule to a custom date list). The system warns that switching will discard the current schedule configuration and requires confirmation before proceeding.

**Why this priority**: Schedule type switching is a destructive action that should be supported but guarded. It is a lower-priority edge case relative to the core schedule and view flows.

**Independent Test**: Can be fully tested by configuring a rotation with a recurrence rule, switching to a custom date list, confirming the recurrence rule is cleared, and verifying the rotation now accepts individual dates.

**Acceptance Scenarios**:

1. **Given** a rotation with a recurrence-rule schedule, **When** a visitor initiates a schedule type change, **Then** the system displays a warning that the current schedule configuration will be reset.
2. **Given** the warning is shown, **When** the visitor confirms the change, **Then** the schedule type is updated and the previous schedule configuration is cleared; the new schedule type starts unconfigured.
3. **Given** the warning is shown, **When** the visitor cancels, **Then** the schedule type and configuration remain unchanged.
4. **Given** a schedule type switch is confirmed, **When** the rotation view is shown, **Then** past occurrence records (dates and assignments) are preserved; only the forward-looking schedule is reset.

---

### Edge Cases

- What happens when a recurrence rule produces a date that does not exist in a given month (e.g., "monthly on the 31st" for February or April)? — That month's occurrence is skipped; the next occurrence falls on the 31st of the next eligible month.
- What happens when the custom date list is empty? — The rotation shows no upcoming occurrences; the "next occurrence" section reflects the empty state.
- What happens when all custom dates are in the past? — The rotation shows no upcoming occurrences; the last date in the list is the most recent past occurrence.
- What happens when a visitor browses backward on a rotation that has never had a past occurrence? — No backward navigation is offered; the view indicates there is no history.
- What happens when a visitor updates the N value in "every N weeks" (e.g., from 2 to 3)? — Future occurrences recalculate from the rule-change date forward; past occurrences are unchanged.
- What happens when two custom dates are entered for the same calendar day? — Only one occurrence is permitted per date; duplicate entries are rejected.

## Requirements *(mandatory)*

### Functional Requirements

**Schedule Configuration**

- **FR-001**: At rotation creation, the visitor MUST choose one of two schedule types: recurrence rule or custom date list. The schedule type cannot be left unspecified.
- **FR-002**: For a recurrence-rule schedule, the visitor MUST be able to configure exactly one of the following rule patterns:
  - Weekly on a specific day of the week (Monday through Sunday).
  - Every N weeks (where N ≥ 2) on a specific day of the week.
  - Monthly on a specific day number (1–28, to avoid month-length edge cases unless the system explicitly handles them per FR-003).
- **FR-002a**: A recurrence-rule schedule MUST include a configurable start date that anchors the series. The start date defaults to the current date and the start date input is collapsed by default; the visitor must explicitly expand it to override the default. The first occurrence falls on or after the start date that matches the rule pattern.
- **FR-002b**: When a visitor reconfigures an existing recurrence rule (any parameter change), the start date MUST automatically reset to the current date. The visitor MAY expand the start date input and override it manually after reconfiguration.
- **FR-003**: For "monthly on the Nth" rules, if a given month does not contain that day number (e.g., 29, 30, or 31), the occurrence for that month MUST be skipped; the schedule continues from the next month that contains the configured day number.
- **FR-004**: For a custom date list schedule, the visitor MUST be able to add individual dates at any time after creation. There is no upper limit on the number of dates beyond the global cap defined in the PRD (500 dates per rotation).
- **FR-005**: For a custom date list schedule, the visitor MUST be able to remove any individual date at any time. Removing a date removes the corresponding occurrence and its assignment record.
- **FR-006**: The custom date list MUST reject duplicate dates — the same calendar date cannot appear more than once.
- **FR-007**: A visitor MUST be able to edit the recurrence rule of an existing rotation (change day of week, change interval N, or change the monthly day number). The change applies to future occurrences only; past occurrence records are preserved exactly as recorded.
- **FR-008**: A visitor MUST be able to switch the schedule type of an existing rotation. Switching MUST be preceded by a confirmation step that clearly states the current schedule configuration will be permanently discarded. Past occurrence records are preserved on schedule type switch.
- **FR-009**: After a confirmed schedule type switch, the new schedule type starts unconfigured (no rule set, empty date list) and the visitor must configure it before occurrences are generated.

**Occurrence View**

- **FR-010**: The rotation view MUST prominently display the next upcoming occurrence: the date of that occurrence and the member assigned to it.
- **FR-011**: The rotation view MUST display the most recent past occurrence: its date and the member assigned to it.
- **FR-012**: When no past occurrences exist for a rotation, the previous occurrence section MUST display a clear empty-state message rather than being absent or blank.
- **FR-013**: When no upcoming occurrences exist (custom date list with no future dates, or schedule not yet configured), the next occurrence section MUST display a clear empty-state message.
- **FR-014**: A visitor MUST be able to browse forward through future occurrences one occurrence at a time, with each step showing the occurrence date and its assigned member.
- **FR-015**: Forward browsing MUST have no hard upper limit — future occurrences for recurrence-rule schedules continue to be generated on demand as the visitor navigates forward.
- **FR-016**: For custom date list schedules, forward browsing MUST only surface dates present in the list; no synthetic dates are generated.
- **FR-017**: A visitor MUST be able to browse backward through past occurrences one occurrence at a time, with each step showing the occurrence date and its assigned member.
- **FR-018**: When the visitor reaches the earliest recorded occurrence while browsing backward, the backward navigation control MUST be disabled or hidden.
- **FR-019**: The occurrence view MUST derive assignments deterministically from queue order: the member at position 1 in the queue is assigned to the first occurrence, the member at position 2 to the second, cycling indefinitely.
- **FR-020**: When the queue changes (member added, removed, or reordered), past occurrence assignments (occurrences whose date has already elapsed) MUST be preserved exactly as recorded. Future occurrence assignments MUST re-derive from the current queue state.
- **FR-021**: For custom date list schedules, future assignments MUST be indexed based on the count of elapsed past occurrences. Removing any future date from the list MUST shift all subsequent future assignments up by one queue position (i.e., the queue "picks up" from position determined by past occurrence count).

### Key Entities

- **Schedule**: Belongs to a rotation. Has a type (recurrence rule or custom date list). For recurrence-rule type: stores the rule pattern and its parameters (day of week, interval N, or monthly day number). For custom date list type: stores the ordered set of dates. A rotation has exactly one schedule.
- **Occurrence**: A single dated event derived from the schedule. Has a date and is linked to exactly one assignment. For recurrence-rule schedules, occurrences are computed dynamically from the rule and are not persisted until they are referenced (e.g., for skip/unavailability tracking). For custom date list schedules, each stored date corresponds to one occurrence.
- **Assignment**: The designated member for a specific occurrence. Derived deterministically from queue order and occurrence sequence number. May be overridden if a skip is applied (handled by the skip behavior feature).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can determine whose turn it is for the next upcoming occurrence in under 5 seconds of opening the rotation, without any navigation or interaction.
- **SC-002**: A visitor can configure a complete recurrence-rule or custom date list schedule during rotation creation in a single session without requiring help documentation.
- **SC-003**: Future occurrence browsing is unbounded — a visitor can navigate at least 52 steps forward from the current date on a weekly rotation and see a valid assignment for every step.
- **SC-004**: Past occurrence browsing covers the complete history — 100% of past occurrences are reachable by navigating backward from the current occurrence.
- **SC-005**: Switching schedule type takes no more than 2 interactions after initiating the action (one to trigger, one to confirm), and the rotation returns to a usable state immediately after confirmation.
- **SC-006**: All occurrence dates generated by a recurrence rule are correct — zero incorrect dates appear in a 12-month forward projection for any supported rule pattern.

## Assumptions

- Occurrence assignments for recurrence-rule schedules are computed on the fly using the start date as the series anchor; only skip/override records require database persistence for those occurrences.
- "Monthly on day N" day-number input is bounded to 1–31; the skip-on-missing-day behavior (FR-003) handles months where the day does not exist.
- The "every N weeks" rule requires N ≥ 2; N = 1 is covered by the "weekly" rule, which keeps the UI options non-overlapping.
- All dates in this feature are calendar dates (no time component); the rotation's occurrence on "every Monday" has no specific time of day.
- Changing a recurrence rule takes effect from the next occurrence after the change date; there is no retroactive recomputation of already-assigned past occurrences.
- Custom date list dates are stored and displayed in ascending chronological order regardless of the order in which they were added.
- The occurrence view is part of the rotation page (the same page reached by the rotation link); it is not a separate route.
- Browsing forward/backward is session-local navigation state — the URL does not change per browsed occurrence (deep-linking to a specific occurrence is out of scope for this feature).
