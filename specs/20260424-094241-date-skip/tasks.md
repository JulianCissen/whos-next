# Tasks: Date-Bound Skip

**Input**: Design documents from `specs/20260424-094241-date-skip/`  
**Branch**: `20260423-211423-skip-behavior`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state dependency)
- **[US1]**: User Story 1 — Skip an Entire Occurrence Date (P1)
- **[US2]**: User Story 2 — Balanced Skip Mode Selection (P2)

---

## Phase 1: Setup

No new project scaffolding required — this feature extends an existing application.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, entity, and shared-type changes that both user stories depend on. Also includes the `browseBackward` dedup fix and `browseForward` offset-adjustment that are correctness prerequisites for all occurrence reads after a date-cancel is applied.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Add migration `Migration20260424000005_cancel.ts` in `apps/backend/src/database/migrations/` — adds `skip_type TEXT CHECK ('member','date')` column to `occurrence_assignments` and backfills `skip_type = 'member'` for rows where `skipped_member_id IS NOT NULL`
- [ ] T002 Update MikroORM snapshot `apps/backend/src/database/migrations/.snapshot-whosnext.json` to reflect the new `skip_type` column
- [ ] T003 Add `skipType: 'member' | 'date' | null` property to `OccurrenceAssignment` entity in `apps/backend/src/members/occurrence-assignment.entity.ts` (use `p.string().nullable()` with `columnType: 'text'`)
- [ ] T004 [P] Extend `OccurrenceDto` in `packages/shared/src/schedule/index.ts` — add `cancelledMemberId: string | null` and `cancelledMemberName: string | null` fields; add `CancelOccurrenceResponseDto = OccurrenceDto` type alias
- [ ] T005 Update `SkipService` skip-detection guard in `apps/backend/src/schedule/skip.service.ts` — replace `skippedMember !== null` check with `skipType != null`; also set `skipType: 'member'` on new member-skip assignment rows (depends on T003)
- [ ] T006 Fix `browseBackward` duplicate-candidate bug in `apps/backend/src/schedule/occurrence-browse.helper.ts` — filter `futureBefore` to exclude dates already present in the settled assignments set (pre-existing bug surfaced by this feature)
- [ ] T007 Add date-cancel DTO mapping and `browseForward` offset-adjustment in `apps/backend/src/schedule/occurrence-browse.helper.ts` — count date-cancel assignments before index `i` and subtract from offset before `derivedMemberForFuture`; map `skipType === 'date'` rows to `cancelledMemberId`/`cancelledMemberName` (depends on T006)

**Checkpoint**: Foundation ready — CancelService and frontend work can now begin.

---

## Phase 3: User Story 1 — Skip an Entire Occurrence Date (Priority: P1) 🎯 MVP

**Goal**: A visitor can apply a date-bound cancel to any occurrence. The occurrence is marked "Cancelled," shows the would-have-been assignee, and subsequent occurrences correctly show the same would-have-been member as next in line.

**Independent Test**: Create a rotation [A, B, C] with a weekly schedule. Apply a date-cancel to the next occurrence (A's turn). Verify: (1) the cancelled occurrence shows `cancelledMemberId = A.id` and `memberId = null`; (2) the occurrence after the cancelled one still shows `memberId = A.id` (not B).

- [ ] T008 [US1] Implement `CancelService` in `apps/backend/src/schedule/cancel.service.ts` — validate date format, slug, schedule membership; call `settle()`; check `skipType != null` → 409; compute would-have-been assignee; write `OccurrenceAssignment` with `member = wouldHaveBeen`, `skippedMember = null`, `skipType = 'date'`; return `CancelOccurrenceResponseDto` (depends on T003, T004, T005)
- [ ] T009 [US1] Register `CancelService` provider in `apps/backend/src/schedule/schedule.module.ts`
- [ ] T010 [US1] Add `POST /rotations/:slug/occurrences/:date/cancel` route to `apps/backend/src/schedule/schedule.controller.ts` delegating to `CancelService.cancel()` (depends on T009)
- [ ] T011 [US1] Verify `occurrence.service.ts` correctly passes `cancelledMemberId`/`cancelledMemberName` from browse helper output through to the `OccurrenceWindowDto` response in `apps/backend/src/schedule/occurrence.service.ts` — update any field mapping that only forwarded the old skip fields (depends on T007)
- [ ] T012 [P] [US1] Add Bruno request files in `apps/backend/bruno/occurrences/` — `cancel-occurrence.bru` (success), `cancel-occurrence-already-skipped.bru` (409), `cancel-occurrence-not-in-schedule.bru` (400), `cancel-occurrence-invalid-date.bru` (400)

**Checkpoint**: User Story 1 fully functional. Verify with Bruno requests and manual queue-order check.

---

## Phase 4: User Story 2 — Balanced Skip Mode Selection (Priority: P2)

**Goal**: The occurrence card shows a single low-key "Skip" trigger. Activating it expands an inline panel with two peer options: "Cancel date" and "Mark member unavailable." Both options have equal visual weight. The panel shows an inline error on failure and stays open for retry. Already-skipped occurrences show only the recorded state with no skip trigger accessible.

**Independent Test**: Open an occurrence card. Confirm one low-key "Skip" trigger is visible (not two separate buttons). Activate it — confirm both options appear with identical styling. Confirm neither option is styled as a primary action. Confirm keyboard navigation reaches both options.

- [ ] T013 [US2] Add `cancelOccurrence(slug: string, date: string): Observable<CancelOccurrenceResponseDto>` to `apps/frontend/src/app/core/api/schedule.api.ts` (depends on T004)
- [ ] T014 [P] [US2] Add i18n strings for the new skip UI in `apps/frontend/src/assets/i18n/en.json` — trigger label, "Cancel date" option, "Mark member unavailable" option, "Cancelled" state label, "Would have been [name]" display, cancel error message, and ARIA labels for trigger and panel
- [ ] T015 [P] [US2] Add matching i18n strings in `apps/frontend/src/assets/i18n/nl.json` (parallel to T014)
- [ ] T016 [US2] Rework `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-card.component.ts` and its template — replace the current prominent member-skip button with a single low-key "Skip" trigger; add the inline two-option panel (hidden by default, expanded on trigger); apply equal visual weight to both options using Angular Material secondary/tertiary button styles; show "Cancelled — would have been [name]" state when `cancelledMemberId !== null`; hide trigger when any skip is applied (depends on T013, T014, T015)
- [ ] T017 [US2] Wire cancel and skip actions in `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts` — handle `(cancelDate)` output from occurrence card, call `cancelOccurrence()`, on success refresh occurrence data, on failure emit error back to card for inline display (depends on T016)
- [ ] T018 [US2] Verify accessibility of the reworked card in `occurrence-card.component.ts` — ensure "Skip" trigger has `aria-expanded` and descriptive `aria-label`; inline panel announced via `aria-live` or focus management on expand; both options labelled; "Cancelled" and member-skipped states convey meaning without colour alone (depends on T016)

**Checkpoint**: Both user stories functional. Verify visually that the trigger is low-key and both options are equal-weight. Keyboard-navigate the full skip flow.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Unit and e2e tests covering both user stories; final accessibility audit.

- [ ] T019 [P] Write Vitest unit tests for `CancelService` in `apps/backend/src/schedule/cancel.service.spec.ts` — happy path; 409 on already-cancelled; 409 on already-member-skipped; 400 not-in-schedule; succeeds with single-member queue (unlike member-skip)
- [ ] T020 [P] Write Vitest unit tests for updated `occurrence-browse.helper.ts` in `apps/backend/src/schedule/occurrence-browse.helper.spec.ts` — `browseForward` offset drift with date-cancel at positions 0, 1, and mid-page; `browseBackward` no duplicate candidates for skip-assigned future dates
- [ ] T021 Write Playwright e2e test for the cancel flow in `apps/e2e/` — apply date-cancel via UI; verify "Cancelled" state; verify next occurrence shows same would-have-been member; verify error panel stays open on simulated failure; verify skip trigger disappears after cancel
- [ ] T022 Run axe accessibility audit in the e2e suite against the reworked occurrence card — verify WCAG 2.2 AA for skip trigger, inline panel (expanded), both option buttons, Cancelled state, and member-skipped state

---

## Dependencies & Execution Order

### Phase dependencies

- **Foundational (Phase 2)**: No dependencies — can start immediately
- **US1 (Phase 3)**: Requires T001–T007 complete
- **US2 (Phase 4)**: Requires T001–T007 complete; T016–T018 also require T013–T015
- **Polish (Phase 5)**: Requires US1 and US2 complete

### Within Phase 2

T001 → T002, T003 (can run in parallel after T001)  
T004 is independent of T003 (different package)  
T005 depends on T003  
T006 and T007 are in the same file — do T006 first, then T007

### Within Phase 3

T008 depends on T003, T004, T005  
T009 depends on T008  
T010 depends on T009  
T011 depends on T007  
T012 is independent [P]

### Within Phase 4

T013 depends on T004  
T014 and T015 are independent [P]  
T016 depends on T013, T014, T015  
T017 depends on T016  
T018 depends on T016

### Parallel opportunities per phase

**Phase 2**: T003 ∥ T004 (after T001)  
**Phase 3**: T012 runs at any time [P]  
**Phase 4**: T014 ∥ T015 [P]; T019 ∥ T020 [P] in Polish

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 2 (Foundational) — T001–T007
2. Complete Phase 3 (US1) — T008–T012
3. **STOP and VALIDATE**: `POST .../cancel` works; browse shows correct would-have-been; queue doesn't advance
4. US2 and Polish can follow

### Incremental delivery

1. Phase 2 complete → entity, DTO, and browse helpers are ready
2. Phase 3 complete → backend cancel endpoint fully functional; testable via Bruno
3. Phase 4 complete → full UX: balanced skip trigger, inline panel, Cancelled state
4. Phase 5 complete → test coverage; accessibility gated

---

## Notes

- `settle()` in `SkipService` requires **no changes** — it naturally handles date-cancel rows
- `rotation.nextIndex` advancement logic is **unchanged**
- The unique constraint on `(rotation_id, occurrence_date)` is **unchanged**
- T006 fixes a pre-existing bug that was latent before this feature; it must ship with this change regardless
- All new i18n keys must be present in both `en.json` and `nl.json` before T016 can compile cleanly
