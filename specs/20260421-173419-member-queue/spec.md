# Feature Specification: Member Queue Management

**Feature Branch**: `20260421-173419-member-queue`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "A rotation has an ordered queue of members. A member is a display name only — not a user account. When adding a member, the person adding them chooses whether they go to the front or the back of the queue. Members can be removed at any time; removing a member preserves any past occurrence assignments for historical accuracy. Members can be manually reordered within the queue. The queue order deterministically drives assignment: the first member in the queue is assigned to the first upcoming occurrence, cycling through indefinitely. This assignment logic must be implemented as a pure, testable function that takes the queue and a list of occurrence dates and returns the full assignment sequence."

## Clarifications

### Session 2026-04-21

- Q: How are historical assignment records preserved when a member is removed from the queue? → A: Soft-delete — the member row is retained in the database but flagged as removed; assignment records continue to reference the live member row. This also keeps the door open for future member-rename support without leaving stale names on historical records.
- Q: How should upcoming assignment computation handle queue changes mid-cycle, without double-ups or skips? → A: Cycle pointer — the rotation stores a single `nextIndex` field: the queue position of the member assigned to the next upcoming occurrence. Queue mutations update `nextIndex` synchronously: members inserted before the pointer shift it forward by one; members inserted at or after leave it unchanged; removals mirror the same logic; reorders recalculate the pointer to track the same "next person" in the new order. Upcoming assignments are computed as a pure function of `(queue, nextIndex, upcomingDates)`.
- Q: What is the primary interaction for manually reordering members in the queue? → A: Drag-and-drop — members can be dragged to any position in the list.
- Q: How and when are past assignment records written to the database? → A: Lazy-write on every rotation access (read or write) — before processing any request that reads or mutates a rotation, the system first settles all outstanding past occurrence dates: it iterates through dates before the current date that do not yet have a stored assignment record, writes each assignment using the current active queue and `nextIndex`, and advances `nextIndex` by one per settled occurrence. Because this runs before every mutation (including reorders), historical records are always written against the pre-mutation queue state. No queue change log is needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a Member to the Rotation Queue (Priority: P1)

A visitor holding a rotation link wants to bring a new person into the rotation. They provide a display name and decide where that person slots in — at the front (so they come up soon) or at the back (after everyone who is already there). The new member immediately appears in the queue in the chosen position, and upcoming assignments reflect the updated order without any further action.

**Why this priority**: The queue starts empty — without the ability to add members, the rotation has no people to assign and all downstream features (assignment viewing, skip handling) are inert. This is the first meaningful interaction after rotation creation and must work reliably before anything else is built on top of it.

**Independent Test**: Starting from a rotation with no members, a visitor adds two members — one to the back, then one to the front. The queue shows the front-added member first, the back-added member second. The next upcoming occurrence is assigned to the front-added member. This can be fully demonstrated with only the add-member and queue-view capabilities present.

**Acceptance Scenarios**:

1. **Given** a rotation with an empty queue, **When** a visitor adds a member with the display name "Alice" placed at the back, **Then** the queue shows one member ("Alice") and the next upcoming occurrence is assigned to Alice.
2. **Given** a rotation with "Alice" at position 1, **When** a visitor adds "Bob" at the back, **Then** the queue shows Alice at position 1 and Bob at position 2. The next upcoming occurrence remains assigned to Alice; the one after is assigned to Bob.
3. **Given** a rotation with "Alice" at position 1, **When** a visitor adds "Bob" at the front, **Then** Bob moves to position 1 and Alice to position 2. The next upcoming occurrence is now assigned to Bob.
4. **Given** a visitor adds a member with a name containing leading or trailing whitespace, **When** the add is submitted, **Then** the stored name is trimmed and the trimmed version is displayed.
5. **Given** a visitor submits an empty name or a name exceeding 100 characters, **When** the add is attempted, **Then** the addition is rejected with a clear validation message and the queue is unchanged.
6. **Given** the rotation already has 100 members (the maximum), **When** a visitor attempts to add another, **Then** the addition is rejected with a clear message explaining the member limit has been reached.

---

### User Story 2 - View the Member Queue and Upcoming Assignments (Priority: P1)

A visitor opening a rotation immediately sees the current queue in order, and can tell at a glance who is assigned to the next occurrence, the one after that, and so on. The assignment order is a direct, predictable consequence of the queue order — if you know the queue, you can reason about the full assignment schedule without any hidden state.

**Why this priority**: The entire point of the rotation is to answer "whose turn is it next?" Without being able to view the queue and see the resulting assignments, the member management actions have no meaningful feedback loop and the product delivers no value to visitors.

**Independent Test**: A rotation with members Alice, Bob, and Carol (in that order) can be opened and the visitor sees: Alice for occurrence 1, Bob for occurrence 2, Carol for occurrence 3, Alice for occurrence 4, and so on. Changing nothing and reloading shows the same result. This story is independently verifiable with just member add and occurrence browsing.

**Acceptance Scenarios**:

1. **Given** a rotation with members [Alice, Bob, Carol], **When** a visitor views the rotation, **Then** the queue is displayed in the defined order with Alice first, Bob second, Carol third.
2. **Given** a rotation with members [Alice, Bob, Carol] and a list of occurrence dates, **When** a visitor browses occurrences, **Then** occurrence 1 shows Alice, occurrence 2 shows Bob, occurrence 3 shows Carol, occurrence 4 shows Alice again, continuing the cycle indefinitely.
3. **Given** a queue with a single member ("Alice"), **When** a visitor browses occurrences, **Then** every occurrence is assigned to Alice.
4. **Given** a queue with no members, **When** a visitor views the rotation, **Then** a clear empty-state message is displayed and no assignment is shown for any occurrence.

---

### User Story 3 - Remove a Member from the Queue (Priority: P2)

A visitor removes a member who has left the group or is no longer participating in the rotation. The member's slot disappears from the queue, and upcoming assignments redistribute across the remaining members. Past occurrences that were assigned to the removed member continue to show that member's name for historical accuracy — the record of who was responsible on any given past date is never altered.

**Why this priority**: Rotations evolve over time; members leave. Without removal, teams must either create a new rotation (losing history) or leave ghost members in the queue. Preservation of past assignment records is a correctness requirement — altering history would undermine the rotation's reliability as an audit trail.

**Independent Test**: A rotation with Alice, Bob, and Carol has several past occurrences recorded. Bob is removed. Past occurrences that listed Bob still show "Bob". Future occurrences now cycle between Alice and Carol. This verifies both the queue update and the historical record preservation independently.

**Acceptance Scenarios**:

1. **Given** a rotation with members [Alice, Bob, Carol], **When** Bob is removed, **Then** the queue becomes [Alice, Carol] and future occurrences assign to Alice and Carol only, cycling between them.
2. **Given** a rotation where Bob was assigned to one or more past occurrences, **When** Bob is removed from the queue, **Then** those past occurrences continue to display Bob's name as the recorded assignee; no historical record is altered.
3. **Given** a rotation with a single member ("Alice"), **When** Alice is removed, **Then** the queue becomes empty, future occurrences show no assignee, and the empty-state message is displayed (matching Story 2, scenario 4).
4. **Given** a rotation with members [Alice, Bob], **When** Alice is removed while she is the assigned member for the next upcoming occurrence, **Then** Bob becomes the assigned member for the next occurrence; no error or undefined state occurs.

---

### User Story 4 - Reorder Members in the Queue (Priority: P3)

A visitor decides the current queue order does not reflect the team's preference — perhaps a member should go earlier or later than their current position. They reposition one or more members. The updated order takes effect immediately for all upcoming occurrences; past assignment records are unaffected.

**Why this priority**: Reordering is a quality-of-life capability that teams use to correct or adjust the assignment cadence without resorting to remove-and-re-add. It is not required to demonstrate the core rotation value but significantly reduces friction for long-lived rotations.

**Independent Test**: A rotation with [Alice, Bob, Carol] has Alice dragged to position 3. The queue becomes [Bob, Carol, Alice]. The next upcoming occurrence is assigned to Bob. This can be demonstrated with just the drag-and-drop reorder action and the assignment view.

**Acceptance Scenarios**:

1. **Given** a rotation with members [Alice, Bob, Carol], **When** a visitor moves Alice to position 3, **Then** the queue becomes [Bob, Carol, Alice] and upcoming assignments start with Bob.
2. **Given** a rotation with members [Alice, Bob, Carol] and a recorded past occurrence showing Alice as assignee, **When** Alice is moved to a new queue position, **Then** the past occurrence record still shows Alice; reordering never alters historical assignment records.
3. **Given** a visitor reorders a member to its current position (no-op move), **When** the action is submitted, **Then** the queue remains unchanged and no error is produced.

---

### Edge Cases

- **Empty queue**: When all members have been removed, the rotation must display a clear empty-state and show no assignments for any occurrence. The rotation itself remains accessible and manageable; adding a new member restores assignment computation.
- **Single-member queue**: Every occurrence is assigned to the one member. Reordering is a no-op. Removing the only member results in the empty queue state.
- **Queue change affecting upcoming occurrences**: Adding, removing, or reordering members immediately changes which member is shown for future occurrences. There is no grace period or deferred application.
- **Queue change and the cycle boundary**: When a member is added or removed mid-cycle, the assignment sequence restarts from the first member of the updated queue at the next upcoming occurrence. The concept of "where we are in the cycle" is derived from the occurrence's position in the full ordered date list and the current queue length — it is not stored as separate state.
- **Duplicate display names**: Two members may share the same display name (e.g., two team members named "Alex"). The system does not enforce name uniqueness within a queue. Each member is a distinct slot regardless of display name.
- **Removing a member currently assigned to the next occurrence**: The next upcoming occurrence immediately reassigns to the member who follows the removed member's former position in the queue (or wraps to the new first member if the removed member was at the end).
- **Whitespace and Unicode in member names**: Names are trimmed of leading/trailing whitespace. Printable Unicode (including emoji and non-Latin scripts) is accepted. Control characters (including newlines) are rejected or stripped.
- **Adding a member when the queue is at capacity (100 members)**: The add attempt is rejected with a clear error message; the queue remains at 100 members unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Member identity**

- **FR-001**: A member MUST be represented solely by a display name. Members are NOT user accounts, login credentials, or identity-linked records in any form.
- **FR-002**: A member's display name MUST be validated against the following rules before the member is added or the name is changed: 1–100 characters after trimming leading/trailing whitespace; no control characters (including newlines); printable Unicode otherwise permitted. Rejections MUST return a clear, user-visible validation message and MUST NOT alter the queue.
- **FR-003**: The system MUST NOT enforce uniqueness of display names within a queue. Two members with the same display name are permitted and represent two distinct queue slots.

**Adding members**

- **FR-004**: Any visitor with a rotation link MUST be able to add a member to the queue by providing a display name and selecting a position: front of queue or back of queue. No other position options are offered at the time of addition.
- **FR-005**: The system MUST insert the new member at exactly the chosen position (index 0 for front; after the last current member for back) and MUST immediately reflect that position in the displayed queue and in all upcoming assignment computations.
- **FR-006**: The system MUST reject an add attempt when the active (non-removed) queue already contains 100 members, with a clear error message. The queue remains unchanged. Soft-deleted member rows do not count toward this limit.

**Removing members**

- **FR-007**: Any visitor with a rotation link MUST be able to remove any member from the queue at any time.
- **FR-008**: On removal, the system MUST mark the member's record as removed (soft-delete) rather than physically deleting it. The member is immediately excluded from the active queue — their queue slot disappears from the ordered list and all upcoming assignments are recomputed as if the member were never present. The member row is retained in the data store so that historical references remain intact.
- **FR-009**: The system MUST preserve all historical assignment records that reference the removed member by retaining the member row. Past occurrences that were assigned to the removed member MUST continue to display that member's display name via the retained row. No historical record is altered.

**Reordering members**

- **FR-010**: Any visitor with a rotation link MUST be able to manually reposition any member to any other position within the queue via drag-and-drop. The interaction MUST allow moving a member to any target position in a single drag gesture, not limited to one step at a time.
- **FR-011**: A successful reorder MUST immediately update the queue display and all upcoming assignment computations. Past assignment records are unaffected.

**Assignment computation**

- **FR-012**: Upcoming assignment computation MUST be driven by a cycle pointer (`nextIndex`) stored on the rotation. `nextIndex` is the zero-based position in the active queue of the member assigned to the next upcoming occurrence. The computation for upcoming occurrences MUST be a pure, deterministic function of three inputs: the ordered active queue, the ordered list of upcoming occurrence dates, and `nextIndex`. The function returns one assignment per date: upcoming date at offset `k` is assigned to `queue[(nextIndex + k) mod queue-length]`.
- **FR-013**: The assignment function MUST produce identical output for identical inputs on every invocation. It MUST NOT depend on external state, timestamps, random values, or prior invocation results.
- **FR-014**: For an active queue of length N, a starting `nextIndex`, and a list of M upcoming dates, the function MUST return exactly M assignments cycling indefinitely through the queue (wrapping from index N−1 back to 0).
- **FR-015**: When the active queue is empty, the assignment function MUST return a sequence of M unassigned entries — one per date — rather than throwing an error or returning a shorter list. `nextIndex` is undefined when the queue is empty and MUST be reset to 0 when the first member is added.
- **FR-016**: The assignment function MUST be independently unit-testable in isolation from the broader application, with no database, network, or other I/O dependency.
- **FR-020**: Before processing any request that reads or mutates a rotation (including member add, remove, and reorder), the system MUST first settle all outstanding past occurrences: iterate through occurrence dates before the current date that do not yet have a stored assignment record, write each assignment using the current active queue and `nextIndex`, and advance `nextIndex` by one per settled date. Records are written in chronological order. Once written, an assignment record is immutable. Because settlement runs before every mutation, historical records are always written against the pre-mutation queue state — no queue change log is required.
- **FR-022**: `nextIndex` MUST be updated synchronously on every queue mutation, in the same operation as the mutation itself, according to these rules:
  - Member added at a position **before** `nextIndex`: increment `nextIndex` by 1.
  - Member added at a position **at or after** `nextIndex`: `nextIndex` unchanged.
  - Member removed at a position **before** `nextIndex`: decrement `nextIndex` by 1.
  - Member removed at a position **equal to** `nextIndex`: `nextIndex` unchanged (the member now at that position becomes next).
  - Member removed at a position **after** `nextIndex`: `nextIndex` unchanged.
  - Queue reorder: recalculate `nextIndex` to be the position of the same member who was next before the reorder (the "next person" is preserved across reorders; only their index in the queue may change).

**General behaviour**

- **FR-017**: All queue mutations (add, remove, reorder) MUST take effect immediately for all upcoming occurrences. There is no staged or deferred application.
- **FR-018**: All queue mutations MUST be safe to retry: a duplicate submission of the same action either succeeds identically or returns a predictable, non-destructive error without corrupting the queue.
- **FR-019**: The queue MUST maintain a stable, persistent ordering that survives page reload, new browser sessions, and concurrent access by multiple visitors.

### Key Entities

- **Member**: A named slot in a rotation's queue. Attributes:
  - **Display name** — free-text string (1–100 characters, trimmed, printable Unicode); the sole human-readable identifier. Not unique within the queue.
  - **Queue position** — an integer index that determines assignment priority. Position 1 is the front of the queue. Positions are contiguous and re-indexed when a member is added, removed, or reordered. Removed members have no queue position.
  - **Removed flag** — a boolean that marks a member as no longer active in the queue. Removed members are excluded from the live queue and from all upcoming assignment computations, but their row is retained in the data store so that historical assignment records can still reference them. A removed member's display name remains readable for historical display purposes.
  - **Rotation** — the rotation this member belongs to. A member belongs to exactly one rotation.

- **Rotation** (additions for this feature): Carries one new field beyond those defined in the rotation-lifecycle spec:
  - **`nextIndex`** — zero-based integer; the position in the active queue of the member assigned to the next upcoming occurrence. Updated synchronously on every queue mutation (FR-022). Reset to 0 when the queue becomes empty and a new member is first added.

- **Assignment** (historical record): A stored link between a specific past occurrence date and the member responsible for it. Records are written lazily before every rotation access (read or write) — any past occurrence date without a stored record is settled using the current active queue and `nextIndex` at that moment (FR-020). Because settlement precedes every mutation, records always reflect the queue state before the mutation was applied. Once written, an assignment record is immutable. For upcoming occurrences, assignments are computed on demand from `(queue, nextIndex, upcomingDates)` via the pure assignment function (FR-012) and are never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can add the first member to an empty rotation in a single interaction (name + position choice), with the new assignment visible on the rotation page immediately after submission — no page reload required.
- **SC-002**: Given a queue of N members, a `nextIndex`, and a list of M upcoming dates, the assignment sequence is deterministic: the same three inputs always produce the same output, verifiable by automated unit tests covering queues of length 1, 2, and 10 with varying `nextIndex` offsets and date list lengths.
- **SC-003**: Removing a member from a queue of any size (1 to 100) immediately updates all upcoming assignments and leaves all past occurrence records intact — both verified by automated tests.
- **SC-004**: The displayed assignment for the next upcoming occurrence is always consistent with the current queue: after any add, remove, or reorder, the displayed assignment updates without requiring a page reload.
- **SC-005**: No member-queue operation (add, remove, reorder) leaves the queue in an inconsistent or partially-updated state, verified by tests that simulate submission failures and retries.
- **SC-006**: The assignment function passes a comprehensive unit test suite that exercises: single-member queues, multi-member queues, cycle boundaries (occurrence count that is exactly a multiple of queue length), and one occurrence at an arbitrary offset into a long date list.

## Assumptions

- A member's display name cannot be edited after the member is added. Name correction requires removing and re-adding the member. If name editing is needed, it will be specified as a separate feature.
- The rotation's schedule (the list of occurrence dates) is configured separately (per PRD §4.4 and a separate feature specification). This feature assumes occurrence dates are available as input to the assignment function; it does not specify how they are generated.
- "Upcoming occurrences" in this spec refers to occurrences with a date on or after today's date. "Past occurrences" refers to occurrences with a date before today's date. The exact boundary (inclusive/exclusive of today) is an implementation detail to be resolved during planning.
- The pure assignment function described in FR-012 covers the no-skip base case: no member has been marked unavailable for any occurrence. Skip behaviour (Pass, Defer, Manual substitute) is the subject of a separate feature specification and is entirely out of scope here.
- Queue position is 1-indexed in user-facing display (position 1 is "first in line") but the internal representation is an implementation detail.
- The maximum queue size of 100 members is inherited from the PRD's input caps (§5.2) and is treated as fixed for this release.
- Concurrent writes by two visitors (e.g., both adding a member simultaneously) are handled by the backend's standard persistence guarantees. Last-write-wins is an acceptable outcome; no explicit conflict-resolution UI is required for this feature.
- The application is accessed via a standard web browser; native mobile apps are out of scope per PRD §1.3.
- Past assignment records are settled lazily before every rotation access (read or write), using the current active queue and `nextIndex` at the time of the request (FR-020). Because settlement runs before any queue mutation is committed, historical records are always written against the pre-mutation state. No queue change log is needed and no edge case of incorrect historical assignment exists.
- Upcoming assignments are never stored — they are always computed on demand from the current active queue, `nextIndex`, and the schedule's upcoming dates (FR-012).
