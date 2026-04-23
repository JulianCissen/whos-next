# Tasks: Schedule Configuration and Occurrence View

**Input**: Design documents from `/specs/20260422-170340-schedule-occurrence-view/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in the same batch)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared type additions and the DB migration. No application logic — safe to complete before touching backend or frontend.

- [X] T001 Create `packages/shared/src/schedule/index.ts` with all schedule DTOs, `OccurrenceDto`, `OccurrenceWindowDto`, `BrowseOccurrencesResponseDto`, request DTOs (`ConfigureRecurrenceRuleRequestDto`, `SwitchScheduleTypeRequestDto`, `AddCustomDateRequestDto`, `CustomDateDto`), and the `computeRecurrenceDates` function signature (stub body — implemented in T007)
- [X] T002 Update `packages/shared/src/index.ts` to re-export all symbols from `./schedule/index.js`
- [X] T003 [P] Update `packages/shared/src/rotations/index.ts`: extend `CreateRotationRequestDto` to add required `schedule: CreateRotationScheduleDto`; extend `RotationResponseDto` to add `schedule: ScheduleDto | null`; add `CreateRotationScheduleDto` interface (imports `ScheduleType`, `RecurrenceRuleDto` from `../schedule/index.js` using `import type`)
- [X] T004 Create `apps/backend/src/database/migrations/Migration20260422000003_schedule.ts` with `up()` that creates the `schedules` and `schedule_dates` tables exactly as specified in `data-model.md` (including UNIQUE on `rotation_id`, UNIQUE on `(schedule_id, date)`, and the `schedule_dates_schedule_id_idx` index); `down()` drops both tables

**Checkpoint**: Shared types compile and migration file exists — no runtime changes yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend entities, module skeleton, helpers, and the RotationsService extension. All user stories depend on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create `apps/backend/src/schedule/schedule.entity.ts` using `defineEntity` (decorator-less MikroORM API per backend rules): properties `rotation` (manyToOne Rotation, CASCADE), `type` (string), `rruleType` (string, nullable), `dayOfWeek` (number, nullable), `intervalN` (number, nullable), `monthlyDay` (number, nullable), `startDate` (date, nullable); export `ScheduleEntity` type
- [X] T006 [P] Create `apps/backend/src/schedule/schedule-date.entity.ts` using `defineEntity`: properties `schedule` (manyToOne Schedule, CASCADE), `date` (date); export `ScheduleDateEntity` type
- [X] T007 Implement `computeRecurrenceDates(rule, startDate, from, limit)` in `packages/shared/src/schedule/index.ts`: handle `weekly` (step 7 days), `every_n_weeks` (step 7×N days), and `monthly` (advance month-by-month, detect overflow via `result.getDate() !== rule.monthlyDay` and skip that month per FR-003); ISO weekday → JS day conversion: `jsDay = isoDay % 7`; always return dates ≥ `from`, stop after `limit` results
- [X] T008 [P] Create `packages/shared/src/schedule/index.test.ts` with Vitest unit tests for `computeRecurrenceDates`: test weekly Monday series, every-2-weeks Friday series, monthly-15th series, Feb-skip for monthly-31st, start date inclusive, `from` filter, `limit` cap (constitution requires this function to be independently testable)
- [X] T009 Create `apps/backend/src/schedule/recurrence.helper.ts`: re-export or wrap `computeRecurrenceDates` from `@whos-next/shared` with a backend-specific helper `getElapsedRecurrenceDates(schedule: ScheduleEntity, before: Date): Date[]` that calls the shared function with `new Date(0)` as `from`, a large `limit`, and filters results to `< before`
- [X] T010 [P] Create `apps/backend/src/schedule/occurrence.helper.ts`: implement `toIsoDate(d: Date): string` (returns `YYYY-MM-DD`), `localToday(): Date` (UTC midnight for today), `localYesterday(): Date`; implement `computeRetroactiveAssignments(unsettledDates: Date[], queue: MemberEntity[], startIndex: number): Array<{ date: Date; member: MemberEntity | null }>` pure helper used by settlement
- [X] T011 Create `apps/backend/src/schedule/schedule.service.ts` with methods: `configureRecurrenceRule(slug, dto: ConfigureRecurrenceRuleRequestDto)` → creates or updates Schedule row, resets `startDate` to today if not supplied; `addDate(slug, dto: AddCustomDateRequestDto)` → inserts ScheduleDate, enforces 500-cap and UNIQUE (catch UniqueConstraintViolation → 409); `removeDate(slug, dateStr)` → deletes ScheduleDate row, 404 if missing; `switchType(slug, dto: SwitchScheduleTypeRequestDto)` → updates `type`, clears old config (deletes schedule_dates OR nulls rrule fields), sets `startDate = today` when switching to recurrence_rule; uses `this.orm.em.fork()` for all operations
- [X] T012 Create `apps/backend/src/schedule/occurrence.service.ts` with: private `settle(rotation, schedule, em)` transactional method per quickstart.md algorithm; `getWindow(slug): Promise<OccurrenceWindowDto>` that loads rotation+schedule, calls settle, then computes `previous` (most recent occurrence_assignment) and `next` (first upcoming date with queue-derived assignment); `browse(slug, after?, before?, limit)` → stub returning empty result (implemented in T032)
- [X] T013 [P] Create `apps/backend/src/schedule/schedule.controller.ts` with `@Controller('rotations/:slug')` — stub `@Get('occurrences')`, `@Put('schedule/recurrence-rule')`, `@Put('schedule/type')`, `@Post('schedule/dates')`, `@Delete('schedule/dates/:date')`, `@Get('occurrences/browse')` routes; each handler delegates to the appropriate service; thin controller, no business logic
- [X] T014 Create `apps/backend/src/schedule/schedule.module.ts`: declare `ScheduleController`; provide `ScheduleService` and `OccurrenceService`; import `MikroOrmModule` (or use the shared ORM token per project convention); export `ScheduleService` and `OccurrenceService`
- [X] T015 Update `apps/backend/src/app.module.ts` to import `ScheduleModule`
- [X] T016 Update `apps/backend/src/rotations/rotations.service.ts`: in `create(dto)` — after persisting the Rotation, instantiate a new `Schedule` entity from `dto.schedule` and persist it (validate that `recurrenceRule` is present when `type = recurrence_rule`, else throw `UnprocessableEntityException`); in `toDto(rotation)` — query and include the Schedule (with its ScheduleDates if `custom_date_list`) as `schedule: ScheduleDto | null`
- [X] T017 [P] Create `apps/frontend/src/app/core/api/schedule.api.ts`: `ScheduleApiService` with `configureRecurrenceRule(slug, dto)`, `switchType(slug, dto)`, `addDate(slug, dto)`, `removeDate(slug, date)` methods (all using Angular `HttpClient`); `OccurrencesApiService` with `getWindow(slug): Observable<OccurrenceWindowDto>` and `browse(slug, params): Observable<BrowseOccurrencesResponseDto>` methods; both services use `inject(HttpClient)` and `@Injectable({ providedIn: 'root' })` patterns

**Checkpoint**: Backend compiles, migration is runnable, module is wired — no occurrence data yet.

---

## Phase 3: User Story 1 — View Current and Previous Occurrence (Priority: P1) 🎯 MVP

**Goal**: A visitor opens a rotation with a configured recurrence-rule schedule and immediately sees the next upcoming occurrence (date + assignee) and the most recent past occurrence.

**Independent Test**: Create a rotation via `POST /api/rotations` with `{ name, schedule: { type: 'recurrence_rule', recurrenceRule: { type: 'weekly', dayOfWeek: 1 }, startDate: '<2 weeks ago>' } }`, add 2 members via the member API, navigate to `/:slug`, verify next occurrence date and member name are prominently displayed and most recent past occurrence is shown.

- [X] T018 [US1] Fully implement `getWindow(slug)` in `apps/backend/src/schedule/occurrence.service.ts`: run `settle()`, then query `occurrence_assignments` for the most recent past date (previous), compute the next upcoming date using `getElapsedRecurrenceDates` or `schedule_dates` filtered to `≥ today`, derive the assigned member from `rotation.nextIndex + active queue`, return `OccurrenceWindowDto`; handle null cases (no past, no future, empty queue)
- [X] T019 [US1] Wire `GET /rotations/:slug/occurrences` in `apps/backend/src/schedule/schedule.controller.ts` to `OccurrenceService.getWindow(slug)`, return `200 OccurrenceWindowDto`
- [X] T020 [P] [US1] Create `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-card.component.ts`: presentational `@Component` with `ChangeDetectionStrategy.OnPush`; `@Input() occurrence: OccurrenceDto | null` and `@Input() label: string`; displays date, member name, or i18n empty-state message when `occurrence` is null; uses Angular Material card/typography
- [X] T021 [US1] Create `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts`: `@Component` with `ChangeDetectionStrategy.OnPush`; `@Input({ required: true }) slug: string`; on init calls `OccurrencesApiService.getWindow(slug)` → stores result in signals `previousOccurrence` and `nextOccurrence`; renders two `<app-occurrence-card>` instances (previous + next); forward/backward navigation buttons (disabled, to be enabled in T033)
- [X] T022 [US1] Update `apps/frontend/src/app/features/rotation/rotation.page.ts` to import and embed `OccurrenceViewComponent` near the top of the template, passing `[slug]="slug()"` as input; import `OccurrenceViewComponent` in the standalone component's `imports` array
- [X] T023 [P] [US1] Add occurrence i18n keys to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`: `occurrence.next.label`, `occurrence.previous.label`, `occurrence.empty_state.no_upcoming`, `occurrence.empty_state.no_history`, `occurrence.assigned_to`

**Checkpoint**: Opening a rotation with a configured schedule shows the next and previous occurrence. Empty states render when no past/future occurrences exist.

---

## Phase 4: User Story 2 — Configure Recurrence Rule Schedule at Creation (Priority: P2)

**Goal**: A visitor creating a new rotation selects "recurrence rule" and configures one of three patterns (weekly, every N weeks, monthly). The schedule drives occurrence generation immediately.

**Independent Test**: Use `ScheduleConfigComponent` in creation mode, select "every Monday", submit — verify `POST /api/rotations` body contains correct `schedule` payload and `GET /api/rotations/:slug` returns a rotation with the configured schedule. Then check that occurrence view shows a Monday date.

- [X] T024 [US2] Implement `configureRecurrenceRule(slug, dto)` in `apps/backend/src/schedule/schedule.service.ts` (full body, not stub): validate rule parameters (422 for missing required fields), update existing Schedule row (or throw 409 if type is `custom_date_list`); reset `startDate` to today when no explicit `startDate` supplied in `dto` (FR-002b); flush; return `ScheduleDto`; add the corresponding `PUT /rotations/:slug/schedule/recurrence-rule` handler in `apps/backend/src/schedule/schedule.controller.ts`
- [X] T025 [P] [US2] Create `apps/frontend/src/app/features/rotation/schedule-config/schedule-config.component.ts`: `@Component` with `ChangeDetectionStrategy.OnPush`; `@Input() schedule: ScheduleDto | null` (null = creation mode); `@Output() scheduleChange: EventEmitter<CreateRotationScheduleDto>` (for creation mode) or calls `ScheduleApiService` directly (for edit mode, determined by presence of `slug` input `@Input() slug?: string`); reactive form with schedule type selector (radio/toggle), rule type selector (`weekly` / `every_n_weeks` / `monthly`), day-of-week picker, interval-N input, monthly-day input; start date collapse panel (hidden by default, FR-002a); Angular Material form fields throughout; validates required fields before emitting
- [X] T026 [US2] Update `apps/frontend/src/app/features/landing/create-rotation-form.component.ts` to embed `<app-schedule-config>` in the creation form, collect the emitted `CreateRotationScheduleDto`, and include it in the `CreateRotationRequestDto` sent to `RotationsApiService.create()`; import `ScheduleConfigComponent` in `imports`
- [X] T027 [US2] Update `apps/frontend/src/app/features/rotation/rotation.page.ts` to also embed `<app-schedule-config [slug]="slug()" [schedule]="rotation().schedule">` in the settings expansion panel so existing recurrence rules can be edited inline (US2 acceptance scenario 5)
- [X] T028 [P] [US2] Add recurrence rule i18n keys to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`: `schedule.type.recurrence_rule`, `schedule.type.custom_date_list`, `schedule.rrule.weekly`, `schedule.rrule.every_n_weeks`, `schedule.rrule.monthly`, `schedule.rrule.day_of_week.label`, `schedule.rrule.interval_n.label`, `schedule.rrule.monthly_day.label`, `schedule.start_date.label`, `schedule.start_date.toggle`

**Checkpoint**: A visitor can create a rotation with a weekly, bi-weekly, or monthly recurrence rule. The schedule persists and the occurrence view reflects the configured rule.

---

## Phase 5: User Story 3 — Configure Custom Date List Schedule (Priority: P3)

**Goal**: A visitor creating a rotation with a custom date list can add and remove individual dates. Occurrences exist exactly for stored dates. Duplicates are rejected.

**Independent Test**: Create a rotation with `schedule.type = custom_date_list`, add three dates via the UI, verify occurrence view shows the next date from the list. Remove a date and verify the occurrence list updates correctly.

- [X] T029 [US3] Implement `addDate(slug, dto)` and `removeDate(slug, dateStr)` in `apps/backend/src/schedule/schedule.service.ts` (full bodies): `addDate` — load schedule, verify type is `custom_date_list` (409 otherwise), check cap ≤ 500 (422 otherwise), insert ScheduleDate (catch UniqueConstraintViolation → 409), return `CustomDateDto`; `removeDate` — load ScheduleDate by `(scheduleId, date)`, 404 if absent, delete row, flush, return 204; wire `POST /rotations/:slug/schedule/dates` and `DELETE /rotations/:slug/schedule/dates/:date` in `apps/backend/src/schedule/schedule.controller.ts`
- [X] T030 [P] [US3] Create `apps/frontend/src/app/features/rotation/schedule-config/custom-dates-list.component.ts`: `@Component` with `ChangeDetectionStrategy.OnPush`; `@Input({ required: true }) slug: string`; `@Input() dates: string[]` (current sorted list from `ScheduleDto`); `@Output() datesChanged: EventEmitter<string[]>`; date input field + "Add" button that calls `ScheduleApiService.addDate(slug, { date })`; renders list of current dates each with a remove button that calls `ScheduleApiService.removeDate(slug, date)`; shows 409 duplicate error and 422 cap error inline
- [X] T031 [US3] Update `apps/frontend/src/app/features/rotation/schedule-config/schedule-config.component.ts` to render `<app-custom-dates-list>` when `schedule.type === 'custom_date_list'`; update creation mode to set `type = 'custom_date_list'` in the emitted DTO (no dates in creation request — dates added afterward)
- [X] T032 [P] [US3] Add custom date list i18n keys to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`: `schedule.custom_date.add_label`, `schedule.custom_date.remove_label`, `schedule.custom_date.empty_state`, `schedule.custom_date.date_input_label`, `schedule.error.duplicate_date`, `schedule.error.date_cap_exceeded`

**Checkpoint**: A visitor can create and manage a custom date list rotation. Occurrence view reflects only stored dates.

---

## Phase 6: User Story 4 — Browse Future and Past Occurrences (Priority: P4)

**Goal**: A visitor can navigate forward through unlimited future occurrences and backward through all past occurrences one step at a time.

**Independent Test**: Configure a weekly Monday rotation starting 6 weeks ago with 3 members. Navigate forward 10 steps from today — verify each step shows a Monday date and member assignments cycle in queue order. Navigate backward past the first occurrence — verify the backward button becomes disabled.

- [X] T033 [US4] Implement `browse(slug, after?, before?, limit)` in `apps/backend/src/schedule/occurrence.service.ts`: run `settle()` first; for `after` queries — compute occurrence dates after the anchor from the schedule (custom dates: filter `schedule_dates > after`; recurrence: generate from `after+1` up to `limit` dates), map to `OccurrenceDto` with member assignments from `nextIndex`; for `before` queries — look up `occurrence_assignments WHERE occurrence_date < before ORDER BY occurrence_date DESC LIMIT limit`; set `hasMore` appropriately (recurrence-rule `after` queries always return `hasMore: true`); wire `GET /rotations/:slug/occurrences/browse` in `apps/backend/src/schedule/schedule.controller.ts` with `after`, `before`, `limit` query params (validate: exactly one of after/before, limit 1–10)
- [X] T034 [US4] Update `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts` to add: `browseCursor` signal `{ date: string; direction: 'forward' | 'backward' } | null` (null = window mode); "Next" button that calls `OccurrencesApiService.browse(slug, { after: currentDate, limit: 1 })` and updates displayed occurrence; "Previous" button that calls `OccurrencesApiService.browse(slug, { before: currentDate, limit: 1 })`; disable "Previous" when `hasMore: false` (FR-018); "Back to today" link that resets to window mode
- [X] T035 [P] [US4] Add browse i18n keys to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`: `occurrence.navigate.forward`, `occurrence.navigate.backward`, `occurrence.navigate.back_to_today`

**Checkpoint**: Forward browsing is unbounded on recurrence-rule rotations. Backward browsing stops at the earliest recorded occurrence with the nav button disabled.

---

## Phase 7: User Story 5 — Switch Schedule Type (Priority: P5)

**Goal**: A visitor can switch a rotation's schedule type (recurrence rule ↔ custom date list) with a confirmation step. Past occurrence records are preserved; the new schedule type starts unconfigured.

**Independent Test**: Configure a rotation with a weekly rule. Click "Switch to custom date list", confirm the dialog — verify the schedule shows `type: custom_date_list` with empty dates, recurrence fields are gone, and past occurrence records (if any) are still present.

- [X] T036 [US5] Implement `switchType(slug, dto)` in `apps/backend/src/schedule/schedule.service.ts` (full body): load schedule, update `type`; if switching to `custom_date_list` — null all rrule fields and `startDate`, do NOT delete `occurrence_assignments`; if switching to `recurrence_rule` — delete all `schedule_dates` rows, null rrule fields, set `startDate = today`; flush; return `ScheduleDto`; wire `PUT /rotations/:slug/schedule/type` in `apps/backend/src/schedule/schedule.controller.ts`
- [X] T037 [P] [US5] Update `apps/frontend/src/app/features/rotation/schedule-config/schedule-config.component.ts` to add a "Switch schedule type" button that opens a `MatDialog` confirmation (reuse the existing dialog pattern from `DeleteRotationDialogComponent`) warning that the current configuration will be permanently discarded; on confirm, call `ScheduleApiService.switchType(slug, { type: otherType })` and reload the schedule
- [X] T038 [P] [US5] Add schedule type switch i18n keys to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`: `schedule.switch_type.button_label`, `schedule.switch_type.confirm_title`, `schedule.switch_type.confirm_body`, `schedule.switch_type.confirm_action`

**Checkpoint**: A visitor can switch schedule type. Confirmation is required. Past assignments survive the switch.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Empty states, error handling, accessibility verification, and the pre-feature rotation edge case.

- [X] T039 [P] Add "Set up schedule" empty-state section to `apps/frontend/src/app/features/rotation/rotation.page.ts`: when `rotation().schedule === null`, render a prominent prompt with a button that opens the `ScheduleConfigComponent` in creation mode (covers pre-feature rotations); add i18n key `schedule.empty_state.no_schedule` to both translation files
- [X] T040 [P] Add HTTP error handling in `apps/frontend/src/app/core/api/schedule.api.ts`: map 409 → typed `{ conflict: true }` result, 422 → `{ validationError: true, message }` result; update `ScheduleConfigComponent` and `CustomDatesListComponent` to surface these errors using `MatSnackBar` or inline error messages
- [X] T041 [P] Verify `apps/frontend/src/app/features/rotation/schedule-config/schedule-config.component.ts` and `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts` all have `changeDetection: ChangeDetectionStrategy.OnPush` and no hardcoded string literals (i18n gate)
- [X] T042 Update `apps/e2e/` Playwright tests to cover the updated rotation page: verify occurrence view renders, verify axe-core reports zero violations on the updated rotation page (constitution IV — accessibility failures are test failures)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2. Can run in parallel with Phase 3.
- **Phase 5 (US3)**: Depends on Phase 2. Can run in parallel with Phases 3–4.
- **Phase 6 (US4)**: Depends on Phase 3 (extends the occurrence view component).
- **Phase 7 (US5)**: Depends on Phase 2. Can run in parallel with Phases 3–5.
- **Phase 8 (Polish)**: Depends on all desired user story phases being complete.

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (P1) | Phase 2 | US2, US3, US5 |
| US2 (P2) | Phase 2 | US1, US3, US5 |
| US3 (P3) | Phase 2 | US1, US2, US5 |
| US4 (P4) | US1 (extends occurrence view component) | US2, US3, US5 |
| US5 (P5) | Phase 2 | US1, US2, US3 |

### Within Each Phase

1. [P]-marked tasks in the same phase can be launched simultaneously.
2. Non-[P] tasks within a phase execute in task-ID order.
3. Service implementations before controller wiring.
4. Backend tasks before frontend tasks within the same story (API contract must exist before service calls).

---

## Parallel Execution Examples

### Phase 2 (Foundational) — parallel launch

```
Simultaneously:
  T005  schedule.entity.ts
  T006  schedule-date.entity.ts
  T010  occurrence.helper.ts
  T017  schedule.api.ts (frontend)

Then sequentially:
  T007  computeRecurrenceDates implementation
  T008  unit tests for computeRecurrenceDates
  T009  recurrence.helper.ts (wraps T007)
  T011  schedule.service.ts (uses T009)
  T012  occurrence.service.ts (uses T010, T011)
  T013  schedule.controller.ts (uses T011, T012)
  T014  schedule.module.ts
  T015  app.module.ts
  T016  rotations.service.ts update
```

### Phase 3 (US1) — parallel launch

```
Simultaneously (after T018, T019 complete):
  T020  occurrence-card.component.ts
  T023  i18n keys

Then:
  T021  occurrence-view.component.ts (depends on T020)
  T022  rotation.page.ts update (depends on T021)
```

### Phase 4 (US2) — parallel launch

```
Simultaneously:
  T025  schedule-config.component.ts
  T028  i18n keys

Then:
  T024  configureRecurrenceRule backend (unblocks T026)
  T026  create-rotation-form update
  T027  rotation.page.ts settings panel update
```

---

## Implementation Strategy

### MVP (User Story 1 Only — Occurrence View)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — seeded data needed for US1 testing
3. Complete Phase 3 (US1 — Occurrence View)
4. **STOP and VALIDATE**: Open a rotation (seed via API) and confirm next/previous occurrence display

### Incremental Delivery

1. Phase 1 + 2 → foundation ready
2. Phase 3 → occurrence view works (MVP)
3. Phase 4 → visitors can configure recurrence rule at creation (full round-trip)
4. Phase 5 → custom date list supported
5. Phase 6 → forward/backward browsing
6. Phase 7 → schedule type switching
7. Phase 8 → polish, accessibility gate

### Single Developer Order

```
T001 → T002 → T003 → T004
→ T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017
→ T018 → T019 → T020 → T021 → T022 → T023   ← MVP done
→ T024 → T025 → T026 → T027 → T028
→ T029 → T030 → T031 → T032
→ T033 → T034 → T035
→ T036 → T037 → T038
→ T039 → T040 → T041 → T042
```

---

## Notes

- `[P]` = different files, no incomplete task dependencies in the same batch
- `[Story]` label maps each task to its user story for traceability
- All new `.ts` files must stay under the 300-line hard limit (backend-rules, angular-rules)
- All frontend components require `changeDetection: ChangeDetectionStrategy.OnPush`
- All `import type` for type-only imports (`consistent-type-imports` ESLint rule)
- All relative backend imports use explicit `.js` extensions (NodeNext module resolution)
- No hardcoded string literals in Angular templates or components — all strings via `@ngx-translate/core`
- Accessibility failures from axe-core (T042) block merge per constitution IV
