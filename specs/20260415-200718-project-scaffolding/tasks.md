# Tasks: Project Scaffolding (Unit 0)

**Input**: Design documents from `/specs/20260415-200718-project-scaffolding/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Monorepo Skeleton)

**Purpose**: Create the bare project skeleton — workspace config, package manifests, root config files. No functional code yet.

- [x] T001 Initialize pnpm workspace: create `pnpm-workspace.yaml` (packages: frontend, backend, shared, e2e), root `package.json` (name: whos-next, private: true, workspace scripts), and `.npmrc` (`shamefully-hoist=false`, `public-hoist-pattern[]=''`)
- [x] T002 [P] Create `shared` package skeleton: `shared/package.json` (name: @whos-next/shared), `shared/tsconfig.json` extending tsconfig.base.json, `shared/src/index.ts` (empty barrel)
- [x] T003 [P] Create `backend` package skeleton: `backend/package.json` (name: @whos-next/backend, deps: @whos-next/shared workspace:\*, NestJS 11, MikroORM 7, Vitest), `backend/tsconfig.json`, `backend/nest-cli.json`
- [x] T004 [P] Create `frontend` package skeleton: `frontend/package.json` (name: @whos-next/frontend, deps: @whos-next/shared workspace:\*, Angular 21, Angular Material, @ngx-translate/core, Vitest — NO @whos-next/backend dep), `frontend/tsconfig.json`, `frontend/angular.json` (with `"poll": 2000` in serve options)
- [x] T005 [P] Create `e2e` package skeleton: `e2e/package.json` (name: @whos-next/e2e, deps: @playwright/test, @axe-core/playwright, axe-core), `e2e/playwright.config.ts` (baseURL: http://localhost:4200)
- [x] T006 Create root `tsconfig.base.json` (strict: true, target: ES2022, module: NodeNext, moduleResolution: NodeNext, paths for @whos-next/shared)
- [x] T007 Create `.gitignore` covering: `node_modules/`, `dist/`, `.env`, `*.env.local`, `coverage/`, `.angular/`, `playwright-report/`, `test-results/`

---

## Phase 2: Foundational (Docker + Database — Blocks All User Stories)

**Purpose**: Docker orchestration, database connectivity, and Angular Material theme — everything US1–US4 depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 Write multi-stage `Dockerfile` at repo root: `base` stage (node:22-slim + pnpm via corepack), `frontend-dev` stage (installs deps, exposes 4200), `backend-dev` stage (installs deps, exposes 3000)
- [x] T009 Write `docker-compose.yml` at repo root: `postgres` service (image: postgres:16, env vars, named volume, healthcheck), `backend` service (build target: backend-dev, env: CHOKIDAR_USEPOLLING=1, command: nest start --watch, source volume mount, depends_on postgres healthy), `frontend` service (build target: frontend-dev, command: ng serve --host 0.0.0.0, source volume mount, depends_on backend healthy)
- [x] T010 [P] Write `.env.example` with all required variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, BACKEND_PORT, FRONTEND_PORT
- [x] T011 [P] Write `backend/mikro-orm.config.ts` (defineConfig from @mikro-orm/postgresql, reads env vars for DB credentials, entities glob, migrations path: src/database/migrations, Migrator extension)
- [x] T012 Create empty baseline migration `backend/src/database/migrations/Migration20260415000000_init.ts` (empty up/down methods, no DDL — establishes migration history row on fresh DB)
- [x] T013 [P] Configure Angular Material M3 theme: add `@angular/material` to `frontend/package.json`, import Material prebuilt M3 theme in `frontend/src/styles.scss`, add `provideAnimationsAsync()` in `frontend/src/app/app.config.ts`

---

## Phase 3: User Story 1 — Reproducible Local Stack (Priority: P1) 🎯 MVP

**Goal**: A developer with only Docker runs `docker compose up` and gets all three services healthy — frontend accessible in browser, backend health check returns 200 with DB confirmation.

**Independent Test**: From a clean clone, `docker compose up` completes with all services healthy within 5 minutes. `curl http://localhost:3000/health` returns `{"status":"ok","database":"connected"}`. Opening `http://localhost:4200` shows the Angular placeholder page with no browser console errors.

- [x] T014 [US1] Implement `HealthResponseDto` interface in `shared/src/health/health-response.dto.ts` and re-export from `shared/src/index.ts`
- [x] T015 [US1] Create `backend/src/health/health.controller.ts`: `@Controller('health') @Get() check(): HealthResponseDto` — queries DB via MikroORM `EntityManager` to verify connectivity, returns `{status:'ok', database:'connected'}` on success, throws on failure (NestJS converts to 503)
- [x] T016 [US1] Create `backend/src/health/health.module.ts` declaring `HealthController`
- [x] T017 [US1] Create `backend/src/app.module.ts`: imports `MikroOrmModule.forRoot()` (reads mikro-orm.config.ts), `HealthModule`
- [x] T018 [US1] Create `backend/src/main.ts`: `NestFactory.create(AppModule)`, listen on `process.env.BACKEND_PORT ?? 3000`, global prefix `''` (no prefix — health lives at `/health`)
- [x] T019 [US1] Create Angular placeholder home page: `frontend/src/app/app.component.ts` (standalone, imports MatToolbarModule, MatButtonModule, TranslateModule), `frontend/src/app/app.component.html` (Material toolbar, placeholder content — NO hardcoded strings, all via translate pipe placeholder keys), `frontend/src/app/app.config.ts` (provideRouter, provideHttpClient, provideAnimationsAsync), `frontend/src/app/app.routes.ts`, `frontend/src/main.ts`
- [x] T020 [US1] Configure Angular dev server proxy: create `frontend/proxy.conf.json` (`/api/*` → `http://backend:3000`), add `"proxyConfig": "proxy.conf.json"` to serve options in `frontend/angular.json`
- [x] T021 [US1] Add Docker Compose `healthcheck` to backend service (`curl -f http://localhost:3000/health || exit 1`, interval 10s, retries 5) and set `depends_on: backend: condition: service_healthy` on frontend service in `docker-compose.yml`

**Checkpoint**: `docker compose up` → all three services healthy → `curl /health` returns 200 with DB confirmation → browser shows placeholder page

---

## Phase 4: User Story 2 — Enforced Package Boundaries (Priority: P2)

**Goal**: Any attempt to import directly from `@whos-next/backend` inside `frontend` code fails at compile time — no manual enforcement required.

**Independent Test**: Add `import {} from '@whos-next/backend'` to `frontend/src/main.ts`, run `ng build` or `tsc --noEmit` inside the frontend container — build exits non-zero with a module-not-found error. Remove the import and build succeeds.

- [x] T022 [US2] Verify (and run) `pnpm install` from repo root to materialize the workspace dependency graph — confirm `frontend/node_modules/@whos-next/shared` exists but `frontend/node_modules/@whos-next/backend` does NOT exist
- [x] T023 [US2] Add a working import of `HealthResponseDto` from `@whos-next/shared` in `backend/src/health/health.controller.ts` to confirm shared-package cross-package import resolves correctly
- [x] T024 [US2] Add a working import of `@whos-next/shared` types in `frontend/src/app/app.config.ts` (import a shared type as a type-only import) to confirm frontend→shared import resolves correctly without a frontend→backend path existing

**Checkpoint**: `tsc --noEmit` passes in both frontend and backend. Importing from `@whos-next/backend` in frontend produces a TS2307 error.

---

## Phase 5: User Story 3 — Test Suite Ready from Day One (Priority: P3)

**Goal**: All three test commands — frontend unit, backend unit, e2e+accessibility — execute and exit 0 on a fresh checkout with the local stack running.

**Independent Test**: Frontend unit tests: `docker compose run --rm frontend pnpm test` exits 0. Backend unit tests: `docker compose run --rm backend pnpm test` exits 0. E2e+a11y: `docker compose run --rm e2e pnpm test` (with stack up) exits 0 and shows axe scan passing.

*Note: Frontend and backend unit tests (T026–T029) do not require the Docker stack to be running. The e2e test (T030) requires US1 to be complete and the stack healthy.*

- [x] T025 [US3] Configure Vitest for backend: create `backend/vitest.config.ts` (globals: true, environment: node, include: src/\*\*/\*.spec.ts), add `"test": "vitest run"` script to `backend/package.json`
- [x] T026 [US3] Add placeholder backend unit test `backend/src/health/health.controller.spec.ts` (import HealthController, describe/it placeholder that passes — zero assertions, just confirms runner executes)
- [x] T027 [US3] Configure Vitest for frontend: create `frontend/vitest.config.ts` (using Angular Vitest builder integration for Angular 21, globals: true, include: src/\*\*/\*.spec.ts), add `"test": "vitest run"` script to `frontend/package.json`
- [x] T028 [US3] Add placeholder frontend unit test `frontend/src/app/app.component.spec.ts` (describe/it placeholder that passes — confirms Vitest/Angular runner executes)
- [x] T029 [US3] Write e2e accessibility test `e2e/tests/accessibility.spec.ts`: `test('placeholder page has no accessibility violations', async ({page}) => { await page.goto('/'); await page.waitForLoadState('networkidle'); const results = await new AxeBuilder({page}).analyze(); expect(results.violations).toEqual([]); })`
- [x] T030 [US3] Add workspace-level test scripts to root `package.json`: `"test:frontend"`, `"test:backend"`, `"test:e2e"`, `"test"` (runs all three sequentially)

**Checkpoint**: All three test commands exit 0. Accessibility test report shows 0 violations on placeholder page.

---

## Phase 6: User Story 4 — Internationalised UI Shell (Priority: P4)

**Goal**: The placeholder home page displays in both Dutch and English. Switching languages updates all visible text without a page reload. No string literals appear in any template.

**Independent Test**: Open `http://localhost:4200` → click the Dutch language button → all shell text switches to Dutch immediately (no reload) → click English → text switches back. Inspect `app.component.html` — zero string literals present.

- [x] T031 [US4] Create English translation file `frontend/src/assets/i18n/en.json` with keys: `app.title`, `app.tagline`, `nav.home`, `language.switch_to_dutch`, `language.switch_to_english`
- [x] T032 [US4] Create Dutch translation file `frontend/src/assets/i18n/nl.json` with the same keys translated to Dutch
- [x] T033 [US4] Configure `@ngx-translate/core` in `frontend/src/app/app.config.ts`: `importProvidersFrom(TranslateModule.forRoot({ defaultLanguage: 'en', loader: { provide: TranslateLoader, useFactory: HttpLoaderFactory, deps: [HttpClient] } }))` using `TranslateHttpLoader` pointed at `/assets/i18n/`
- [x] T034 [US4] Update `frontend/src/app/app.component.ts`: inject `TranslateService`, set default language to `'en'` on init, add `switchLanguage(lang: string)` method that calls `translateService.use(lang)`
- [x] T035 [US4] Update `frontend/src/app/app.component.html`: replace all string literals with `{{ 'KEY' | translate }}` pipes; add two `<button mat-button>` elements calling `switchLanguage('nl')` and `switchLanguage('en')` with translated labels

**Checkpoint**: Language toggle switches all text without reload. `app.component.html` has zero hardcoded string literals.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and documentation alignment.

- [x] T036 [P] Run `pnpm install` from repo root with `--frozen-lockfile` and commit the generated `pnpm-lock.yaml`
- [x] T037 [P] Verify `.gitignore` excludes `node_modules/` in all four packages, `dist/`, `.env`, `.angular/`, `postgres-data/`, `playwright-report/`, `test-results/`
- [x] T038 [P] Confirm `docker compose down -v && docker compose up` completes within 5 minutes and all acceptance criteria in SC-001 through SC-005 are met
- [x] T039 Validate `quickstart.md` commands against the actual implementation (correct service names, ports, and script names match what was implemented)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — functional stack required before US2/US3/US4
- **US2 (Phase 4)**: Depends on Phase 2 — pnpm install required; also benefits from US1 types in shared
- **US3 (Phase 5)**: Unit tests (T025–T028, T030) depend on Phase 2; e2e test (T029) depends on US1 (Phase 3) being complete
- **US4 (Phase 6)**: Depends on Phase 3 (US1) for the running Angular app; T031–T032 (JSON files) can start after Phase 1
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) only — no other story dependency
- **US2 (P2)**: Depends on Foundational (Phase 2) — pnpm install from Phase 2 materializes the graph; shares setup with US1 but does not depend on US1 completion
- **US3 (P3)**: Unit tests are independent of US1; e2e test requires US1 running stack
- **US4 (P4)**: Depends on US1 (Angular app shell must exist to add i18n to it)

### Parallel Opportunities Within Phases

**Phase 1**: T002, T003, T004, T005 can all run in parallel after T001.

**Phase 2**: T010, T011, T013 can run in parallel after T008 and T009 are done. T012 depends on T011.

**Phase 3 (US1)**: T014 and T018 can run in parallel. T015 depends on T014 (uses HealthResponseDto). T019 can run in parallel with T015.

**Phase 5 (US3)**: T025 and T027 can run in parallel. T026 depends on T025. T028 depends on T027. T029 depends on US1 (T014–T021).

**Phase 6 (US4)**: T031 and T032 can run in parallel. T034 and T035 depend on T033.

---

## Parallel Example: Phase 1

```
Parallel batch after T001:
  Task T002: Create shared/ package skeleton
  Task T003: Create backend/ package skeleton
  Task T004: Create frontend/ package skeleton
  Task T005: Create e2e/ package skeleton

Then sequential:
  Task T006: root tsconfig.base.json (references all packages)
  Task T007: .gitignore
```

## Parallel Example: Phase 5 (US3)

```
Parallel batch:
  Task T025: Vitest config for backend
  Task T027: Vitest config for frontend

Then parallel:
  Task T026: Placeholder backend unit test (after T025)
  Task T028: Placeholder frontend unit test (after T027)

Then (after US1 complete):
  Task T029: e2e accessibility test
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T007)
2. Complete Phase 2: Foundational (T008–T013)
3. Complete Phase 3: US1 — Reproducible Local Stack (T014–T021)
4. **STOP AND VALIDATE**: `docker compose up` → health check passes → browser shows page
5. US1 is the complete deliverable; everything else adds to it

### Incremental Delivery

1. Phase 1 + 2 → skeleton + Docker ready
2. Phase 3 (US1) → running stack — **first demo-able state**
3. Phase 4 (US2) → boundaries confirmed
4. Phase 5 (US3) → full CI-ready test suite
5. Phase 6 (US4) → i18n shell complete — **Unit 0 done**

### Suggested MVP Scope

**Phase 1 + 2 + 3 = a deployable, database-connected skeleton** that satisfies SC-001 (single command) and SC-005 (health check with DB confirmation). This is the minimum to unblock all future development units.

---

## Notes

- No tests were explicitly requested beyond those defined in the spec (FR-008, FR-009). Test tasks T025–T030 are specification requirements, not optional additions.
- All tasks produce files that did not exist before — this is greenfield scaffolding, not modification of existing code.
- `[P]` tasks touch different files with no shared state; they are safe to implement simultaneously.
- Each phase ends with a verifiable checkpoint that can be validated before the next phase begins.
- Commit after each phase checkpoint to maintain a clean, bisectable history.
