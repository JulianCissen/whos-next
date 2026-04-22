# Tasks: Member Queue Management

**Input**: Design documents from `specs/20260421-173419-member-queue/`
**Branch**: `20260421-173419-member-queue`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/members-api.md ✅ quickstart.md ✅
**Tests**: Included — test tasks are explicitly specified in plan.md (Vitest unit + integration, Playwright E2E + axe-core).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies on incomplete tasks in same phase)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DB migration and shared-package skeleton that everything else builds on.

- [X] T001 Create DB migration `Migration20260421000002_members` (ALTER rotations + CREATE members + CREATE occurrence_assignments) in `apps/backend/src/database/migrations/Migration20260421000002_members.ts`
- [X] T002 [P] Create `packages/shared/src/members/index.ts` exporting all interfaces: `MemberDto`, `AddMemberRequestDto`, `AddMemberResponseDto`, `ReorderMembersRequestDto`, `ReorderMembersResponseDto`, `ActiveQueueEntry`, `UpcomingAssignment`, `MEMBER_NAME_MIN_LENGTH`, `MEMBER_NAME_MAX_LENGTH` (functions stubbed — filled per story)
- [X] T003 [P] Update `packages/shared/src/index.ts` to re-export `./members/index.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend entities, pure helpers, and module wiring that MUST be complete before any user story.

⚠️ **CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Create `Member` entity (decorator-less `defineEntity`) in `apps/backend/src/members/member.entity.ts` — properties: `rotation` (ManyToOne), `name`, `position` (nullable integer), `removedAt` (nullable datetime); `get isActive()` getter
- [X] T005 [P] Create `OccurrenceAssignment` entity (decorator-less `defineEntity`) in `apps/backend/src/members/occurrence-assignment.entity.ts` — properties: `rotation` (ManyToOne), `occurrenceDate` (date), `member` (ManyToOne, no cascade delete)
- [X] T006 Add `nextIndex: number` property (default `0`) to `Rotation` entity in `apps/backend/src/rotations/rotation.entity.ts`
- [X] T007 Extend `RotationResponseDto` with `members: MemberDto[]` field in `packages/shared/src/rotations/index.ts`
- [X] T008 [P] Create `adjustNextIndex(currentNextIndex, queueLengthBefore, mutation)` pure helper with all mutation rules (ADD, REMOVE, REORDER) in `apps/backend/src/members/assignment.helper.ts`
- [X] T009 [P] Write `adjustNextIndex` unit tests — all ADD rules, all REMOVE rules (before/equal/after pointer), REORDER, empty-queue edge cases in `apps/backend/src/members/assignment.helper.spec.ts`
- [X] T010 Create `MembersModule` (wires `MembersController` and `MembersService`) in `apps/backend/src/members/members.module.ts`
- [X] T011 [P] Register `MembersModule` in `AppModule` in `apps/backend/src/app.module.ts`
- [X] T012 [P] Import `MembersModule` into `RotationsModule` in `apps/backend/src/rotations/rotations.module.ts`

**Checkpoint**: Foundation ready — all user story phases can now proceed.

---

## Phase 3: User Story 1 — Add a Member to the Queue (Priority: P1) 🎯 MVP

**Goal**: A visitor provides a display name and a placement choice (front or back); the member appears in the queue at the correct position immediately; `nextIndex` is updated synchronously in the same transaction.

**Independent Test**: Start from a rotation with an empty queue. Add "Bob" at the back (position 1). Add "Alice" at the front. The GET response returns `members: [{id, name:"Alice", position:1}, {id, name:"Bob", position:2}]`. The form rejects an empty name and a 101-character name with validation messages. No page reload required after submission.

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement `validateMemberName()` function body in `packages/shared/src/members/index.ts` (trim, length 1–100, no control chars `[\u0000-\u001F\u007F-\u009F]`, returns `{ok:true, value}` or `{ok:false, reason}`)
- [X] T014 [P] [US1] Create class-validator `AddMemberDto` (wraps `AddMemberRequestDto` with `@IsString`, `@IsIn(['front','back'])`) in `apps/backend/src/members/dto/add-member.dto.ts`
- [X] T015 [US1] Implement `MembersService.add(slug, dto)`: load rotation, count active members (reject if 100), resolve position (front = 1 with re-index, back = N+1), persist new `Member`, call `adjustNextIndex` with ADD rule, update `rotation.nextIndex` — all in one `em.flush()` in `apps/backend/src/members/members.service.ts`
- [X] T016 [US1] Implement `POST /api/rotations/:slug/members` endpoint in `apps/backend/src/members/members.controller.ts` (thin controller, delegates to `MembersService`, returns 201 `AddMemberResponseDto`; registers routes in order: `PUT /order` then `DELETE /:memberId` — not yet but prepare routing order)
- [X] T017 [US1] Extend `RotationsService.findBySlug` to eagerly load active members ordered by `position` ASC, mapped to `MemberDto[]` on the response in `apps/backend/src/rotations/rotations.service.ts`
- [X] T018 [P] [US1] Write `MembersService.add()` unit tests (mocked `EntityManager`): add to empty queue, add to back of non-empty queue, add to front shifts existing members, capacity at 100 rejects with `409`, name validation rejection in `apps/backend/src/members/members.service.spec.ts`
- [X] T019 [P] [US1] Create `members.api.ts` with `addMember(slug, dto): Observable<AddMemberResponseDto>` typed `HttpClient` wrapper in `apps/frontend/src/app/core/api/members.api.ts`
- [X] T020 [P] [US1] Add member-queue i18n strings (add-form labels, placement options, validation messages, capacity error, empty-state) to `apps/frontend/src/app/core/i18n/assets/en.json` and `apps/frontend/src/app/core/i18n/assets/nl.json`
- [X] T021 [US1] Create `AddMemberFormComponent` (standalone, `OnPush`): `mat-form-field` name input, front/back placement toggle (`mat-button-toggle-group`), submit calls `members.api.addMember()`; emits `memberAdded` output on success; shows inline validation errors in `apps/frontend/src/app/features/rotation/add-member-form/add-member-form.component.ts` and `add-member-form.component.html`
- [X] T022 [US1] Render `AddMemberFormComponent` in `rotation.page.ts` (inject `MembersApiService`; on `memberAdded` refresh member list) and `rotation.page.html` in `apps/frontend/src/app/features/rotation/rotation.page.ts`
- [X] T023 [P] [US1] Write `AddMemberFormComponent` unit tests: submit with valid name+placement calls `addMember`, empty name shows validation error, 101-char name shows validation error, capacity error displays snack-bar in `apps/frontend/src/app/features/rotation/add-member-form/add-member-form.component.spec.ts`

**Checkpoint**: User Story 1 fully functional. Visitor can add members via the UI; GET shows updated queue. Test independently before proceeding.

---

## Phase 4: User Story 2 — View the Queue and Upcoming Assignments (Priority: P1)

**Goal**: A visitor opening a rotation page sees the current queue ordered by position, plus an empty-state message when the queue is empty. The `assignMembers` pure function correctly maps `(queue, nextIndex, dates)` → assignment sequence.

**Independent Test**: Load a rotation with [Alice(1), Bob(2), Carol(3)]. Page displays members in that order. `assignMembers([Alice,Bob,Carol], 0, [d1,d2,d3,d4])` returns `[Alice,Bob,Carol,Alice]`. Reload shows identical result. Empty queue shows "No members yet" message.

### Implementation for User Story 2

- [X] T024 [P] [US2] Implement `assignMembers(activeQueue, nextIndex, upcomingDates)` function body in `packages/shared/src/members/index.ts` (empty queue returns all-null entries; otherwise `queue[(nextIndex+k) % queue.length]` per date)
- [X] T025 [P] [US2] Write `assignMembers` unit tests: empty queue, single-member (every date gets that member), multi-member cycle wrap, arbitrary `nextIndex` offset, M dates exactly divisible by queue length in `packages/shared/src/members/assignment.spec.ts`
- [X] T026 [US2] Create `MemberQueueComponent` (standalone, `OnPush`): `@Input() members: MemberDto[]`; renders ordered list with position badge and member name; shows empty-state when `members.length === 0`; `cdkDropList` scaffold stub for US4 in `apps/frontend/src/app/features/rotation/member-queue/member-queue.component.ts` and `member-queue.component.html`
- [X] T027 [US2] Wire `MemberQueueComponent` into `rotation.page.ts`: pass `rotation.members` from GET response; update `rotation.page.html` to include `<app-member-queue>` below the rotation header in `apps/frontend/src/app/features/rotation/rotation.page.ts`
- [X] T028 [P] [US2] Write `MemberQueueComponent` spec: renders members in correct order, shows position numbers, renders empty-state when `members=[]` in `apps/frontend/src/app/features/rotation/member-queue/member-queue.component.spec.ts`
- [ ] T029 [P] [US2] Write integration test for `GET /api/rotations/:slug` asserting `members` array is present, ordered by position, excludes soft-deleted rows in `apps/backend/src/members/members.controller.integration.spec.ts`

**Checkpoint**: User Stories 1 and 2 both independently functional. Queue is visible and the assignment pure function is tested.

---

## Phase 5: User Story 3 — Remove a Member from the Queue (Priority: P2)

**Goal**: A visitor soft-deletes a member; the active queue re-indexes; `nextIndex` is adjusted via the REMOVE rule; historical assignment records are preserved via the retained row.

**Independent Test**: [Alice, Bob, Carol] with a past `occurrence_assignments` row for Bob. Remove Bob. GET returns `[Alice(1), Carol(2)]`. A direct DB query on `occurrence_assignments` still shows Bob's member row referenced. Removing Alice (currently at `nextIndex=0`) reassigns next occurrence to Carol without error.

### Implementation for User Story 3

- [X] T030 [US3] Add `MembersService.remove(slug, memberId)`: load rotation + member (404 if not found or already removed), soft-delete (`removedAt = NOW()`, `position = null`), re-index remaining active members, call `adjustNextIndex` with REMOVE rule, persist all in one flush in `apps/backend/src/members/members.service.ts`
- [X] T031 [US3] Add `DELETE /api/rotations/:slug/members/:memberId` endpoint to `MembersController` (registered after `PUT /order` to avoid routing ambiguity) in `apps/backend/src/members/members.controller.ts`
- [X] T032 [P] [US3] Write `MembersService.remove()` unit tests: remove middle member re-indexes, remove last member wraps `nextIndex`, remove sole member empties queue and resets `nextIndex` to 0, remove already-removed member throws 404 in `apps/backend/src/members/members.service.spec.ts`
- [X] T033 [US3] Add per-member remove button (icon button, confirm on click) to `MemberQueueComponent`; emits `memberRemoved` output with `memberId`; parent `rotation.page.ts` calls `members.api.removeMember()` and refreshes list in `apps/frontend/src/app/features/rotation/member-queue/member-queue.component.ts`
- [X] T034 [P] [US3] Extend `members.api.ts` with `removeMember(slug, memberId): Observable<void>` wrapper in `apps/frontend/src/app/core/api/members.api.ts`
- [ ] T035 [P] [US3] Write integration test for `DELETE /api/rotations/:slug/members/:memberId`: success returns 204, second delete returns 404, GET after delete excludes member in `apps/backend/src/members/members.controller.integration.spec.ts`

**Checkpoint**: User Story 3 functional. Remove button works; queue re-indexes; historical references intact.

---

## Phase 6: User Story 4 — Reorder Members via Drag-and-Drop (Priority: P3)

**Goal**: A visitor drags a member to a new position; the full ordered `memberIds` array is `PUT` to `/order`; `nextIndex` is recalculated to track the same "next" member; CDK drag-and-drop is keyboard-accessible.

**Independent Test**: [Alice, Bob, Carol] — drag Alice to position 3 → `PUT /order` body `{memberIds:[bob_id, carol_id, alice_id]}` → 200 with `members:[Bob(1),Carol(2),Alice(3)]`. Keyboard: Space to lift Alice, arrow down twice, Space to drop — same result, zero axe violations.

### Implementation for User Story 4

- [X] T036 [P] [US4] Create class-validator `ReorderMembersDto` (wraps `ReorderMembersRequestDto` with `@IsArray`, `@IsUUID('all', {each:true})`, `@ArrayMinSize(1)`) in `apps/backend/src/members/dto/reorder-members.dto.ts`
- [X] T037 [US4] Add `MembersService.reorder(slug, dto)`: load rotation + active members, validate `memberIds` exactly matches active IDs (no extras, no missing, no duplicates), reassign positions 1..N per provided order, call `adjustNextIndex` with REORDER rule, persist in one flush, return `ReorderMembersResponseDto` in `apps/backend/src/members/members.service.ts`
- [X] T038 [US4] Add `PUT /api/rotations/:slug/members/order` endpoint to `MembersController` — registered **before** `DELETE /:memberId` to prevent routing ambiguity in `apps/backend/src/members/members.controller.ts`
- [X] T039 [P] [US4] Write `MembersService.reorder()` unit tests: valid full reorder, missing member ID throws 400, extra ID throws 400, duplicate ID throws 400, no-op reorder is safe in `apps/backend/src/members/members.service.spec.ts`
- [X] T040 [P] [US4] Extend `members.api.ts` with `reorderMembers(slug, dto): Observable<ReorderMembersResponseDto>` wrapper in `apps/frontend/src/app/core/api/members.api.ts`
- [ ] T041 [US4] Add `cdkDropList` + `cdkDrag` bindings to `MemberQueueComponent`; handle `cdkDropListDropped` event to emit new order; call `members.api.reorderMembers()` and update local list; preserve keyboard accessibility (`aria-grabbed`, Space/arrow/Enter reorder) in `apps/frontend/src/app/features/rotation/member-queue/member-queue.component.ts` and `member-queue.component.html`
- [ ] T042 [P] [US4] Write `MemberQueueComponent` drag-and-drop spec: `cdkDropListDropped` triggers API call with correct `memberIds` order, optimistic list update on success, keyboard reorder emits same event in `apps/frontend/src/app/features/rotation/member-queue/member-queue.component.spec.ts`
- [ ] T043 [P] [US4] Write integration test for `PUT /api/rotations/:slug/members/order`: success returns 200 with reordered members, missing ID returns 400 `REORDER_INVALID`, extra ID returns 400, subsequent GET reflects new order in `apps/backend/src/members/members.controller.integration.spec.ts`

**Checkpoint**: All four user stories functional. Full CRUD + reorder tested end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Seed data, Bruno API collection, E2E/a11y tests, integration test completeness, and quickstart validation.

- [ ] T044 [P] Create 8 Bruno request files for member endpoints in `apps/backend/bruno/members/`: `add-member-back.bru`, `add-member-front.bru`, `add-member-validation.bru`, `add-member-capacity.bru`, `remove-member.bru`, `remove-member-not-found.bru`, `reorder-members.bru`, `reorder-members-invalid.bru`
- [ ] T045 [P] Create `MemberSeeder` with six rotation queues (Dish duty 3 members, Standup host 5 members, Birthday cake 1 member, Fika-waarde 2 active + 1 soft-deleted, 金曜ビール 4 members, 100-char rotation 0 members) in `apps/backend/seeders/MemberSeeder.ts`
- [ ] T046 Update `DatabaseSeeder` to dispatch to `MemberSeeder` after `RotationSeeder` in `apps/backend/seeders/DatabaseSeeder.ts`
- [ ] T047 Write E2E tests covering add member (back + front), remove member, drag-and-drop reorder, empty-state display, and capacity-exceeded `409` error in `apps/e2e/tests/member-queue.spec.ts`
- [ ] T048 Update `accessibility.spec.ts` with axe-core scan of the rotation page with the member queue rendered (add member, verify zero violations; drag-and-drop element, verify zero violations) in `apps/e2e/tests/accessibility.spec.ts`
- [ ] T049 Update `rotation.page.spec.ts` to cover member queue section rendering (members shown, empty state, add-form present) in `apps/frontend/src/app/features/rotation/rotation.page.spec.ts`
- [ ] T050 [P] Write `members.api.spec.ts` (Angular `HttpClientTestingModule` mocks): `addMember` issues correct `POST`, `removeMember` issues correct `DELETE`, `reorderMembers` issues correct `PUT` in `apps/frontend/src/app/core/api/members.api.spec.ts`
- [ ] T051 Run quickstart.md validation: apply migration, seed, exercise Bruno flows, run all unit/integration/E2E test suites per quickstart steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1, P1)**: Depends on Phase 2 — first story to implement
- **Phase 4 (US2, P1)**: Depends on Phase 2; US1 completion recommended (members data available to view)
- **Phase 5 (US3, P2)**: Depends on Phase 2; US1+US2 recommended for meaningful remove-and-verify flow
- **Phase 6 (US4, P3)**: Depends on Phase 2; US1+US2+US3 should be complete for full regression
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 — Add | Phase 2 | No story dependencies |
| US2 — View | Phase 2 | Shares `members/index.ts` with US1; US1 data makes manual testing easier |
| US3 — Remove | Phase 2 | `MembersService.remove()` extends the service started in US1 |
| US4 — Reorder | Phase 2 | `MembersService.reorder()` extends the service; `MemberQueueComponent` extended from US2 |

### Within Each User Story

- Shared types / DTOs before services
- Services before controllers
- Controllers before frontend API wrappers
- Components after API wrappers
- Unit tests marked `[P]` can be written alongside implementation (same phase, different file)

---

## Parallel Opportunities

### Phase 2 — can run fully in parallel once Phase 1 is done

```
T004 Member entity
T005 OccurrenceAssignment entity    ← simultaneously
T008 adjustNextIndex helper
T009 adjustNextIndex tests
```

After T010 (MembersModule created):
```
T011 Register in AppModule          ← simultaneously
T012 Import in RotationsModule
```

### Phase 3 (US1) — parallel within story

```
T013 validateMemberName (shared)
T014 AddMemberDto (backend)         ← simultaneously
T019 members.api.ts (frontend)
T020 i18n strings (frontend)
```

### Phase 4 (US2) — parallel within story

```
T024 assignMembers function
T025 assignMembers tests            ← simultaneously
```

After T026 (MemberQueueComponent created):
```
T027 Wire into rotation.page
T028 MemberQueueComponent spec      ← simultaneously
T029 GET integration test
```

---

## Implementation Strategy

### MVP Scope (User Stories 1 + 2)

1. Complete **Phase 1** (Setup) — T001–T003
2. Complete **Phase 2** (Foundational) — T004–T012
3. Complete **Phase 3** (US1 — Add Member) — T013–T023
4. Complete **Phase 4** (US2 — View Queue) — T024–T029
5. **STOP and VALIDATE**: both P1 stories independently functional; run unit + integration tests; exercise with Bruno
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → visitor can add members
3. US2 → visitor can view queue and understand assignment order (**MVP shipped**)
4. US3 → visitor can remove members (P2 increment)
5. US4 → drag-and-drop reorder (P3 quality-of-life)
6. Polish → seeder, Bruno, E2E, a11y

### Parallel Team Strategy

Once Phase 2 completes:
- **Developer A**: US1 backend (T013–T018) → US1 frontend (T019–T023)
- **Developer B**: US2 shared + frontend (T024–T029) ← can overlap with Developer A's frontend
