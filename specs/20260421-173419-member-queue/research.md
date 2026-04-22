# Phase 0 Research — Member Queue Management

**Feature**: Member Queue Management
**Date**: 2026-04-21

---

## Decision 1: Queue position storage strategy

**Decision**: Integer positions (1..N contiguous for active members, `NULL` for soft-deleted members), always re-indexed on mutation.

**Rationale**: The spec mandates contiguous positions that are re-indexed on every add/remove/reorder (FR-005, FR-008, FR-010). Fractional positioning (e.g., float values inserted between neighbours) avoids re-indexing but adds complexity — reads and writes require normalisation, and ordering by a float column is fragile at precision boundaries. Given the 100-member hard cap (FR-006), the worst-case re-index cost is 100 `UPDATE` statements in a single transaction, which is negligible.

**Alternatives considered**:
- **Fractional/lexicographic ordering** (Jira style): avoids mass re-index; rejected because the 100-member cap makes re-indexing cheap, and fractional values complicate the queue-change log snapshot.
- **Linked list (`previous_id` / `next_id`)**: elegant for O(1) insert/remove; rejected because snapshot reconstruction for the change log is awkward (must traverse the list), and PostgreSQL's `ORDER BY position` on integers is trivially indexed.

---

## Decision 2: Queue change log — eliminated

**Decision**: No queue change log table. The lazy-write runs before every rotation access (read or write), iterates through unrecorded past occurrence dates chronologically, settles each assignment using the current active queue + `nextIndex`, and advances `nextIndex` in-place.

**Rationale**: The change log's sole purpose was historical queue-state reconstruction for the lazy-write. It is not needed because the lazy-write runs as a pre-step on every request — including queue mutations. This means: before a reorder is committed, the system first settles all past occurrences using the pre-reorder queue. By the time any mutation is applied, the historical record is already accurate and complete. There is no scenario where a reorder can retroactively corrupt a past assignment record. Simpler data model, fewer tables, no append-only write overhead on every mutation.

**Alternatives considered**:
- **JSONB snapshot per mutation**: accurate historical reconstruction but adds an extra table, a write on every queue mutation, and a lookup on every lazy-write. Rejected as over-engineered for the expected access pattern.
- **Individual diff event log**: even more complex. Rejected for the same reason.

---

## Decision 3: `nextIndex` storage location

**Decision**: Add `next_index integer NOT NULL DEFAULT 0` as a column on the existing `rotations` table via a new migration. Updated synchronously in the same DB transaction as every queue mutation.

**Rationale**: `nextIndex` is a property of the rotation (it represents the rotation's current cycle position). Colocating it on the `rotations` table keeps the read path simple: a single row fetch for a rotation returns both its metadata and the cycle pointer. No additional join or query needed.

**Alternatives considered**:
- **Separate `rotation_state` table**: adds a join on every rotation fetch; rejected as unnecessary complexity (Constitution Principle V).
- **JSONB column on `rotations`**: would bundle cycle pointer with unrelated future state; rejected in favour of a typed column.

---

## Decision 4: Reorder API shape

**Decision**: `PUT /api/rotations/:slug/members/order` with body `{ memberIds: string[] }`. The array must contain exactly the IDs of all current active members in the desired new order.

**Rationale**: Drag-and-drop reorder naturally produces a full ordering of all members. Sending the complete ordered list to the backend is atomic and unambiguous — the backend can validate completeness (no added or missing IDs) and assign positions 1..N in a single transaction. An alternative of "move member X to position Y" would require the backend to compute the cascade of position shifts, which is more error-prone.

**Alternatives considered**:
- **PATCH per member with new position**: requires multiple requests for a drag-and-drop gesture; rejected.
- **PATCH with `memberId` + `targetPosition`**: single request but forces the backend to compute cascading shifts; rejected for complexity.

---

## Decision 5: Members in the rotation GET response

**Decision**: Extend `GET /api/rotations/:slug` to include an `members: MemberDto[]` field in the response (array of active members, ordered by position). The existing `RotationResponseDto` in `@whos-next/shared` gains a `members` field; the existing frontend and integration tests that checked the DTO shape are updated accordingly.

**Rationale**: The rotation page needs both rotation metadata and the member queue for its initial render. A single GET avoids a second round trip and keeps the client simple. Adding an array field to an existing DTO is backwards-compatible — existing callers that ignore unknown fields are unaffected.

**Alternatives considered**:
- **Separate `GET /api/rotations/:slug/members` endpoint**: clean separation, but requires a second request on page load; rejected in favour of minimising round trips for the rotation page initial load.

---

## Decision 6: Assignment records table — deferred lazy-write

**Decision**: Create the `occurrence_assignments` table in this feature's migration. Implement `assignMembers()` as a pure function in `@whos-next/shared`. The lazy-write trigger (FR-021 — write records for unrecorded past occurrences on rotation GET) is deferred to the schedule feature, since occurrence dates do not exist until a schedule is configured. The `RotationsService.findBySlug` path includes a stub call that accepts an injected occurrence-date provider; the provider returns an empty list until the schedule feature implements it.

**Rationale**: The table structure and the pure assignment function can be defined now. The lazy-write mechanism requires knowing which dates are "past occurrences" — that knowledge comes from the schedule configuration, which is out of scope for this feature. Implementing the hook as a stub preserves the separation of concerns and avoids coupling this feature to speculative schedule internals.

---

## Decision 7: Drag-and-drop library

**Decision**: Angular CDK `@angular/cdk/drag-drop` (`CdkDragDrop`, `cdkDropList`, `cdkDrag`). No additional package installation required — `@angular/cdk` is already a peer dependency of Angular Material and is included in the project.

**Rationale**: The project already uses Angular Material (M3), which bundles the CDK. Using CDK drag-and-drop avoids introducing any new dependency (Constitution Principle V) and provides built-in accessibility attributes (`aria-grabbed`, keyboard reorder support). Angular Material 15+ CDK drag-and-drop is stable and well-documented.

---

## Decision 8: `nextIndex` update rules implementation

The synchronous `nextIndex` update rules (FR-022) are implemented as a pure helper function alongside the `MembersService`:

```
function adjustNextIndex(currentNextIndex: number, queueLengthBeforeMutation: number, mutation): number
```

Input mutations:
- `{ type: 'ADD', position: number }` — 0-indexed insertion position
- `{ type: 'REMOVE', position: number }` — 0-indexed position of removed member
- `{ type: 'REORDER', newIndexOfCurrentNext: number }` — position of the current-next member in the new order

Rules (0-indexed):
| Mutation | Condition | New nextIndex |
|---|---|---|
| ADD at P | P < currentNextIndex | currentNextIndex + 1 |
| ADD at P | P >= currentNextIndex | currentNextIndex |
| REMOVE at P | P < currentNextIndex | currentNextIndex - 1 |
| REMOVE at P | P == currentNextIndex | currentNextIndex % max(newLength, 1) |
| REMOVE at P | P > currentNextIndex | currentNextIndex |
| REORDER | — | newIndexOfCurrentNext |

Edge cases:
- Queue becomes empty: `nextIndex = 0` (reset; ignored until a member is added).
- After removal at end of queue (last position): `nextIndex % newLength` naturally wraps to 0.

This function is pure and independently unit-tested (no DB dependency).
