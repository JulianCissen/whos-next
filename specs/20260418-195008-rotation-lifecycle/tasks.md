# Tasks: Rotation Lifecycle (Create, Rename, Delete)

**Input**: Design documents from `specs/20260418-195008-rotation-lifecycle/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/rotations-api.md ✓, quickstart.md ✓

**Tests**: Included — backend unit, backend integration (Testcontainers), frontend component, and E2E + a11y tests are all explicitly specified in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- Exact file paths are included in each description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the new domain directories in the monorepo before any implementation begins.

- [ ] T001 Create `packages/shared/src/rotations/` directory structure for new shared types
- [ ] T002 [P] Create `apps/backend/src/rotations/dto/` and `apps/backend/src/common/slug/` directory structures
- [ ] T003 [P] Create `apps/frontend/src/app/core/api/`, `apps/frontend/src/app/features/landing/`, and `apps/frontend/src/app/features/rotation/` directory structures

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core building blocks that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Implement rotation shared types — `SLUG_LENGTH`, `SLUG_REGEX`, `ROTATION_NAME_MIN_LENGTH`, `ROTATION_NAME_MAX_LENGTH`, `CreateRotationRequestDto`, `RenameRotationRequestDto`, `RotationResponseDto`, `ApiErrorResponseDto`, and `validateRotationName()` — in `packages/shared/src/rotations/index.ts`
- [ ] T005 Re-export the rotations module from `packages/shared/src/index.ts`
- [ ] T006 [P] Create `BaseEntity` with `id` (UUID), `createdAt`, and `updatedAt` columns using MikroORM `defineEntity` in `apps/backend/src/common/base-entity.ts`
- [ ] T007 [P] Implement base-58 slug generator using `node:crypto.randomBytes` with rejection sampling over the Bitcoin base-58 alphabet (R-1) in `apps/backend/src/common/slug/slug.generator.ts`
- [ ] T008 Write slug generator unit tests (alphabet membership, length, uniformity, no modulo bias) in `apps/backend/src/common/slug/slug.generator.spec.ts`
- [ ] T009 Implement `Rotation` entity using MikroORM `defineEntity` (slug, name, timestamps, hidden id, `rename()` and `touchAccess()` methods per data-model.md) in `apps/backend/src/rotations/rotation.entity.ts`
- [ ] T010 Generate MikroORM migration for the `rotations` table via `pnpm --filter @whos-next/backend exec mikro-orm migration:create --name rotations`; manually add `CHECK (char_length(name) BETWEEN 1 AND 100)` and `CHECK (char_length(slug) = 8)` constraints in `apps/backend/src/database/migrations/Migration<TS>_rotations.ts`
- [ ] T011 Create `RotationsModule` (imports `MikroOrmModule.forFeature([Rotation])`, exports `RotationsService`) in `apps/backend/src/rotations/rotations.module.ts`
- [ ] T012 Register `RotationsModule` in `apps/backend/src/app.module.ts`

**Checkpoint**: Foundation ready — `pnpm run dev` starts cleanly, migration applies, `Rotation` entity is registered.

---

## Phase 3: User Story 1 — Create a rotation and receive a shareable link (Priority: P1) 🎯 MVP

**Goal**: A visitor submits a rotation name, the backend creates a rotation with a cryptographically random 8-char slug, and the frontend navigates them to the rotation URL.

**Independent Test**: Submit a valid name via the landing page → backend returns 201 with a slug → browser navigates to `/<slug>`. Verified independently once US2's rotation page exists as a shell.

### Backend — User Story 1

- [ ] T013 [P] [US1] Implement `CreateRotationDto` with `class-validator` decorators (`@IsString`, `@MinLength(1)`, `@MaxLength(100)`, `@Matches` for control-char rejection) wrapping `CreateRotationRequestDto` in `apps/backend/src/rotations/dto/create-rotation.dto.ts`
- [ ] T014 [US1] Implement `RotationsService.create()` — slug generation with up to 5 collision retries (catching `UniqueConstraintViolationException`, R-2), `Rotation` entity instantiation, EM flush, and fire-and-forget last-access update — in `apps/backend/src/rotations/rotations.service.ts`
- [ ] T015 [US1] Implement `RotationsController POST /api/rotations` — validates via `CreateRotationDto`, calls `RotationsService.create()`, returns 201 `RotationResponseDto` with `Location` header — in `apps/backend/src/rotations/rotations.controller.ts`
- [ ] T016 [US1] Write `RotationsService` unit tests for `create()` (mocked EM, slug generator, collision retry logic, name validation rejection) in `apps/backend/src/rotations/rotations.service.spec.ts`

### Frontend — User Story 1

- [ ] T017 [P] [US1] Add creation-flow i18n strings (field label, placeholder, submit button, validation messages, page title) to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`
- [ ] T018 [P] [US1] Implement `RotationsApiService.create()` (typed `HttpClient` POST returning `Observable<RotationResponseDto>`) in `apps/frontend/src/app/core/api/rotations.api.ts`
- [ ] T019 [US1] Implement `CreateRotationFormComponent` (standalone, OnPush, `mat-form-field`, name input with `validateRotationName` reactive validation, submit button) in `apps/frontend/src/app/features/landing/create-rotation-form.component.ts`
- [ ] T020 [US1] Implement `LandingPage` (standalone, OnPush, composes `CreateRotationFormComponent`, calls `RotationsApiService.create()`, navigates to `/:slug` with `Router.navigateByUrl(..., { state: { justCreated: true } })`) in `apps/frontend/src/app/features/landing/landing.page.ts` and `apps/frontend/src/app/features/landing/landing.page.html`
- [ ] T021 [US1] Add lazy `''` route (`loadComponent` → `LandingPage`) to `apps/frontend/src/app/app.routes.ts`

**Checkpoint**: Landing page renders at `/`. Submitting a valid name hits `POST /api/rotations`, receives a slug, and navigates to `/<slug>`.

---

## Phase 4: User Story 2 — Access a rotation via its shareable link (Priority: P1)

**Goal**: Opening a valid slug URL loads the rotation page with its name. Malformed or unknown slugs produce a consistent "not found" state. The share banner appears on first view only.

**Independent Test**: A visitor in a clean session opens a pre-created rotation URL → rotation page loads showing the correct name. Opening an unknown slug → not-found page.

### Backend — User Story 2

- [ ] T022 [P] [US2] Implement `RotationsService.findBySlug()` — DB lookup by slug, `NotFoundException` on miss, fire-and-forget conditional `last_accessed_at` update (R-6) — in `apps/backend/src/rotations/rotations.service.ts`
- [ ] T023 [US2] Implement `RotationsController GET /api/rotations/:slug` — `@Matches(SLUG_REGEX)` param validation (returns 404 without DB hit on mismatch per FR-014), calls `findBySlug()`, returns 200 `RotationResponseDto` — in `apps/backend/src/rotations/rotations.controller.ts`
- [ ] T024 [US2] Write `RotationsService` unit tests for `findBySlug()` (found, not found, last-access throttle window) in `apps/backend/src/rotations/rotations.service.spec.ts`
- [ ] T025 [US2] Write controller integration tests using Testcontainers (POST happy path, GET 200, GET 404 unknown slug, GET 404 malformed slug) in `apps/backend/src/rotations/rotations.controller.integration.spec.ts`

### Frontend — User Story 2

- [ ] T026 [P] [US2] Add rotation-page and not-found i18n strings (heading, not-found title/message, share banner copy, copy-button label, dismiss label) to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`
- [ ] T027 [P] [US2] Add `RotationsApiService.get()` (typed `HttpClient` GET returning `Observable<RotationResponseDto>`, maps 404 to a typed error) in `apps/frontend/src/app/core/api/rotations.api.ts`
- [ ] T028 [US2] Implement `ShareLinkBannerComponent` (standalone, OnPush, shows full URL, copy-to-clipboard, dismiss button; only rendered when `@Input() visible = true`) in `apps/frontend/src/app/features/rotation/share-link-banner.component.ts`
- [ ] T029 [US2] Implement `RotationPage` (standalone, OnPush, loads rotation by slug via `ActivatedRoute`, shows `ShareLinkBannerComponent` when `history.state.justCreated`, replaces history state to suppress banner on reload, renders not-found state on 404) in `apps/frontend/src/app/features/rotation/rotation.page.ts` and `apps/frontend/src/app/features/rotation/rotation.page.html`
- [ ] T030 [US2] Add lazy `':slug'` route (with `canMatch` guard checking `SLUG_REGEX` per R-5) and `'**'` not-found fallback route in `apps/frontend/src/app/app.routes.ts`
- [ ] T031 [P] [US2] Write `RotationsApiService` unit tests (create, get — happy paths and error mapping) in `apps/frontend/src/app/core/api/rotations.api.spec.ts`
- [ ] T032 [P] [US2] Write `LandingPage` component tests (renders form, calls API, navigates on success, shows validation errors) in `apps/frontend/src/app/features/landing/landing.page.spec.ts`
- [ ] T033 [US2] Write `RotationPage` component tests (loads rotation, share banner shows on `justCreated`/hidden on reload, not-found state) in `apps/frontend/src/app/features/rotation/rotation.page.spec.ts`
- [ ] T034 [P] [US2] Write E2E test — create rotation, receive link, open in fresh session, rotation loads with correct name, banner absent on second visit — in `apps/e2e/tests/rotation-create.spec.ts`
- [ ] T035 [P] [US2] Write E2E test — open valid slug (no banner), open unknown slug (not-found), open malformed slug (not-found) — in `apps/e2e/tests/rotation-view.spec.ts`

**Checkpoint**: Full create-and-share flow works end-to-end. Share banner visible on first load, suppressed on reload. Unknown and malformed slugs show not-found.

---

## Phase 5: User Story 3 — Rename an existing rotation (Priority: P2)

**Goal**: A visitor viewing a rotation can edit its name in-place. The slug remains unchanged; subsequent visitors see the updated name.

**Independent Test**: With an existing rotation, change the name, reload — new name persists. Original shareable link still resolves to the same rotation.

### Backend — User Story 3

- [ ] T036 [P] [US3] Implement `RenameRotationDto` (class-validator decorators, same constraints as `CreateRotationDto`) in `apps/backend/src/rotations/dto/rename-rotation.dto.ts`
- [ ] T037 [US3] Implement `RotationsService.rename()` (findBySlug or throw, call `entity.rename()`, flush) in `apps/backend/src/rotations/rotations.service.ts`
- [ ] T038 [US3] Implement `RotationsController PATCH /api/rotations/:slug` (validates `RenameRotationDto`, returns 200 `RotationResponseDto`) in `apps/backend/src/rotations/rotations.controller.ts`
- [ ] T039 [US3] Write `RotationsService` unit tests for `rename()` (success, invalid name, not-found) in `apps/backend/src/rotations/rotations.service.spec.ts`
- [ ] T040 [US3] Extend integration tests with PATCH scenarios (200 success, 400 invalid name, 404 unknown slug) in `apps/backend/src/rotations/rotations.controller.integration.spec.ts`

### Frontend — User Story 3

- [ ] T041 [P] [US3] Add rename i18n strings (edit hint, save/cancel labels, validation messages) to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`
- [ ] T042 [P] [US3] Add `RotationsApiService.rename()` (typed `HttpClient` PATCH returning `Observable<RotationResponseDto>`) in `apps/frontend/src/app/core/api/rotations.api.ts`
- [ ] T043 [US3] Add inline rename form to `RotationPage` (click heading to enter edit mode, `mat-form-field` with `validateRotationName` validation, submit on Enter/blur, revert on Escape, optimistic name update) in `apps/frontend/src/app/features/rotation/rotation.page.ts` and `apps/frontend/src/app/features/rotation/rotation.page.html`
- [ ] T044 [US3] Extend `RotationPage` component tests with rename scenarios (enter edit mode, submit valid/invalid name, cancel) in `apps/frontend/src/app/features/rotation/rotation.page.spec.ts`
- [ ] T045 [US3] Write E2E rename test (rename to valid name → name updates, slug unchanged; attempt empty name → rejected) in `apps/e2e/tests/rotation-rename.spec.ts`

**Checkpoint**: Visitor can rename rotation inline. New name persists across reloads. Slug is unaffected.

---

## Phase 6: User Story 4 — Permanently delete a rotation (Priority: P3)

**Goal**: A visitor can delete a rotation after a typed-name confirmation. The rotation is permanently removed. Subsequent link visits return not-found. A toast confirms the deletion.

**Independent Test**: With an existing rotation, trigger delete, cancel → unchanged. Trigger delete, type correct name, confirm → navigates to landing with toast; previous slug returns not-found.

### Backend — User Story 4

- [ ] T046 [US4] Implement `RotationsService.delete()` (findBySlug or throw, `em.remove()`, flush) in `apps/backend/src/rotations/rotations.service.ts`
- [ ] T047 [US4] Implement `RotationsController DELETE /api/rotations/:slug` (returns 204 on success, 404 if not found) in `apps/backend/src/rotations/rotations.controller.ts`
- [ ] T048 [US4] Write `RotationsService` unit tests for `delete()` (success, not-found) in `apps/backend/src/rotations/rotations.service.spec.ts`
- [ ] T049 [US4] Extend integration tests with DELETE scenarios (204 success, 404 unknown slug, GET after DELETE → 404) in `apps/backend/src/rotations/rotations.controller.integration.spec.ts`

### Frontend — User Story 4

- [ ] T050 [P] [US4] Add delete i18n strings (dialog title, warning paragraph, confirm-field label, delete/cancel button labels, toast message) to `apps/frontend/src/assets/i18n/en.json` and `apps/frontend/src/assets/i18n/nl.json`
- [ ] T051 [P] [US4] Add `RotationsApiService.delete()` (typed `HttpClient` DELETE returning `Observable<void>`) in `apps/frontend/src/app/core/api/rotations.api.ts`
- [ ] T052 [US4] Implement `DeleteRotationDialogComponent` (standalone, `MatDialog`, typed-name confirm input with `aria-describedby` wired to the warning paragraph, Delete button `[disabled]` until value matches, Cancel has default focus per R-7) in `apps/frontend/src/app/features/rotation/delete-rotation-dialog.component.ts`
- [ ] T053 [US4] Wire `DeleteRotationDialogComponent` and `MatSnackBar` post-deletion toast ("Rotation '<name>' was deleted", 5 s, `politeness: 'polite'` per R-8) into `RotationPage`; navigate to `''` on confirmed delete in `apps/frontend/src/app/features/rotation/rotation.page.ts`
- [ ] T054 [US4] Extend `RotationPage` component tests with delete dialog scenarios (opens dialog, cancel preserves rotation, confirm triggers delete + toast + navigation) in `apps/frontend/src/app/features/rotation/rotation.page.spec.ts`
- [ ] T055 [P] [US4] Write E2E delete test (cancel → rotation intact; type wrong name → Delete disabled; type correct name → confirm → toast → not-found) in `apps/e2e/tests/rotation-delete.spec.ts`
- [ ] T056 [P] [US4] Write or extend a11y tests asserting zero axe violations on landing page, rotation page, share banner, and delete dialog in `apps/e2e/tests/a11y.spec.ts`

**Checkpoint**: Full rotation lifecycle is functional. Delete confirmation prevents accidental deletion. Post-deletion toast announced accessibly. Deleted slug returns not-found.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Developer tooling, seed data, and sign-off verification that spans all user stories.

- [ ] T057 [P] Create Bruno request files (create.bru, create-validation-error.bru, get.bru, get-not-found.bru, rename.bru, rename-validation-error.bru, delete.bru) referencing `{{baseUrl}}` from `environments/local.bru` in `apps/backend/bruno/rotations/`
- [ ] T058 [P] Implement `RotationSeeder` populating six rotations (plain Latin, two-word, emoji-prefix, non-ASCII Latin, non-Latin script, 100-char max) with staggered `createdAt` timestamps via the shared slug generator in `apps/backend/seeders/RotationSeeder.ts`
- [ ] T059 [P] Implement `DatabaseSeeder` dispatching to `RotationSeeder` in `apps/backend/seeders/DatabaseSeeder.ts`
- [ ] T060 Run `pnpm --filter @whos-next/backend run test` and confirm all backend Vitest unit and integration tests pass
- [ ] T061 [P] Run `pnpm --filter @whos-next/frontend run test` and confirm all frontend Vitest component tests pass
- [ ] T062 Run `pnpm --filter @whos-next/e2e run test` against the running dev stack and confirm all Playwright E2E and a11y tests pass
- [ ] T063 Run `pnpm exec tsc -b` (or per-package `tsc --noEmit`) across all affected packages and resolve any TypeScript errors
- [ ] T064 [P] Run `pnpm run lint` and resolve any ESLint errors or warnings across all affected files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational completion
- **US2 (Phase 4)**: Depends on Foundational completion — can overlap with US1 backend work
- **US3 (Phase 5)**: Depends on US1 + US2 being shippable (rotation page must exist to add rename UI)
- **US4 (Phase 6)**: Depends on US2 (rotation page); can be implemented in parallel with US3
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Backend independent after Phase 2. Frontend independent after Phase 2 (landing page has no dependency on rotation page).
- **US2 (P1)**: Backend independent after Phase 2. Frontend rotation page is a dependency of US1's navigation target — implement US2's rotation page shell before testing US1 end-to-end.
- **US3 (P2)**: Purely additive — extends the rotation page (US2) and `RotationsService`/`RotationsController` (Phase 2).
- **US4 (P3)**: Purely additive — extends the rotation page (US2) with a dialog and post-deletion flow.

### Within Each User Story

- DTOs and shared types → before service implementation
- Service methods → before controller implementation
- Controller implementation → before integration tests
- API service (frontend) and i18n → can be done in parallel with backend work
- Presentational child components (ShareLinkBanner, DeleteDialog) → before parent RotationPage integration

### Parallel Opportunities

- T006 (BaseEntity) and T007 (slug generator) can run in parallel (different files)
- T013 (CreateRotationDto) and T017 (i18n) can run in parallel with T014 (service)
- T022 (RotationsService.findBySlug) and T026 (i18n) and T027 (API GET) can run in parallel
- T036 (RenameRotationDto) and T041 (i18n) and T042 (API PATCH) can run in parallel
- T046–T049 (backend delete) and T050–T051 (frontend delete prep) can run in parallel
- T057, T058, T059 (Bruno + seeders) can all run in parallel

---

## Parallel Example: User Story 2

```
# Launch in parallel (different files, no inter-dependency):
T022: Implement RotationsService.findBySlug() in rotations.service.ts
T026: Add i18n strings to en.json + nl.json
T027: Add RotationsApiService.get() in rotations.api.ts

# Then in parallel once T022 done:
T023: Implement RotationsController GET  ← depends on T022
T028: Implement ShareLinkBannerComponent ← depends on T026

# Then sequentially:
T029: Implement RotationPage             ← depends on T023, T027, T028
T030: Update app.routes.ts              ← depends on T029

# Then in parallel (different test files):
T031: RotationsApiService tests
T032: LandingPage tests
T033: RotationPage tests                ← depends on T029
T034: E2E rotation-create.spec.ts      ← depends on full stack
T035: E2E rotation-view.spec.ts        ← depends on full stack
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 backend (POST endpoint)
4. Complete Phase 4: US2 backend (GET endpoint) + frontend (rotation page + routing)
5. Complete Phase 3: US1 frontend (landing page, navigation)
6. **STOP and VALIDATE**: End-to-end flow — create rotation → share link → open in new session → name shown. Share banner visible on first load, gone on reload.
7. Deploy/demo as MVP

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 + US2 → create, share, and view — **deploy as MVP**
3. US3 → rename — extend rotation page
4. US4 → delete — complete the lifecycle
5. Polish → verify, seed, document

### Parallel Team Strategy

With two developers:
- **Dev A**: Backend (Phases 2–6 backend tasks)
- **Dev B**: Frontend + E2E (Phases 3–6 frontend tasks, Phase 7 E2E)
- Both: Phase 1 setup, Phase 7 sign-off

---

## Notes

- [P] = different files, no unresolved dependencies — safe to run in parallel
- [USn] label maps each task to its user story for traceability to spec.md
- Each user story phase is independently completable and testable
- Collision-retry logic (R-2) must be implemented in T014 before integration tests (T025)
- `history.state.justCreated` pattern (R-9) requires T029 and T030 to be complete before first-view banner tests
- The `canMatch` guard in T030 must use `SLUG_REGEX` from `@whos-next/shared` — never hardcode the regex
- Sign-off requires zero TypeScript errors (T063) and zero ESLint errors/warnings (T064) per CLAUDE.md
