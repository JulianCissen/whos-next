# Tasks: V3 UI Redesign — Landing & Dashboard Pages

**Input**: Design documents from `specs/20260425-120000-v3-redesign/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story. US2 (landing page shell) precedes US1 (pick-up section) because US1 needs the landing page layout to exist first, even though both are P1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (targets different files)
- **[Story]**: Which user story this task belongs to
- Exact file paths are specified in each task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Global styles, fonts, and app shell changes that every subsequent task builds on.

**⚠️ CRITICAL**: Complete before any component work — changes here affect all pages visually.

- [x] T001 [P] Update `apps/frontend/src/index.html` — replace Google Fonts link: add Inter (300..700 variable), Inter Tight (500..700 variable), JetBrains Mono (400,500); remove Plus Jakarta Sans and Roboto links; keep Material Icons link unchanged
- [x] T002 Rewrite `apps/frontend/src/styles.scss` — (a) light M3 theme: `mat.theme()` with `primary: mat.$violet-palette, tertiary: mat.$orange-palette, theme-type: light`, typography `plain-family: 'Inter', brand-family: 'Inter Tight'`, density 0; (b) dark theme block: `@media (prefers-color-scheme: dark)` re-invoking `mat.theme()` with `theme-type: dark`; (c) on `html`: `--color-primary-dark: color-mix(in srgb, var(--mat-sys-primary) 70%, black 30%)`, `--color-primary-subtle: color-mix(in srgb, var(--mat-sys-primary-container) 50%, var(--mat-sys-surface))`, plus design tokens `--radius-sm: 8px`, `--radius: 12px`, `--radius-lg: 18px`, `--radius-xl: 24px`, `--shadow-1: 0 1px 2px rgba(20,16,28,0.06), 0 1px 3px rgba(20,16,28,0.04)`, `--shadow-2: 0 2px 6px rgba(20,16,28,0.06), 0 8px 24px rgba(20,16,28,0.05)`; (d) `body` font-family: `'Inter', sans-serif`; (e) `.page-container`: `max-width: 1080px`, `padding: 20px 28px`; (f) remove old `h1/h2/h3 Plus Jakarta Sans` rule
- [x] T003 Simplify `apps/frontend/src/app/app.component.ts` — remove `<mat-toolbar>` and all toolbar content from template; remove `MatToolbarModule`, `MatButtonModule`, `MatIconModule`, `MatMenuModule` from imports array; remove `switchLanguage()` method (moving to `LanguageService`); keep `ngOnInit()` with default lang setup; template becomes just `<main class="app-content"><router-outlet /></main>`; remove `.app-bar` styles from component styles; update `:host` to `display: block; min-height: 100%`

**Checkpoint**: App renders with Inter font, no global toolbar, correct background token — ready for page-level work

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services and shared component that all user story phases depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create `apps/frontend/src/app/core/language.service.ts` — `@Injectable({ providedIn: 'root' })`, inject `TranslateService`, expose `current = signal(...)` and `use(lang: 'en' | 'nl'): void` method that calls `this.translate.use(lang)` and updates the signal
- [x] T005 [P] Create `apps/frontend/src/app/core/recent-rotation-store.service.ts` — export `interface RecentRotationRecord { slug: string; name: string; cadence: string; nextMember: string; nextDate: string; }` (frontend-only type, NOT in shared package); `@Injectable({ providedIn: 'root' })` with storage key constant `RECENT_ROTATIONS_KEY = 'whos-next:recent-rotations'`; `getAll(): RecentRotationRecord[]` (try localStorage.getItem → JSON.parse → validate array → return; catch → return []); `add(record: RecentRotationRecord): void` (getAll → filter out same slug → prepend → slice(0, 3) → try localStorage.setItem → catch no-op)
- [x] T006 Create `apps/frontend/src/app/shared/pill-app-bar/pill-app-bar.component.ts` + `pill-app-bar.component.scss` — standalone OnPush component, `dashboard` boolean input (default false), template: `<nav class="pill-bar" [class.pill-bar--dashboard]="dashboard()"><div class="pill-bar__left"><ng-content select="[slot=left]" /></div><div class="pill-bar__right"><ng-content select="[slot=right]" /></div></nav>`; styles: pill shape with `border-radius: 999px`, `background: var(--mat-sys-surface)`, `border: 1px solid var(--mat-sys-outline-variant)`, `box-shadow: var(--shadow-1)`, `padding: 10px 16px 10px 14px`, `display: flex; justify-content: space-between; align-items: center`, `margin-bottom: 32px` (landing) / `20px` (dashboard via `--dashboard` modifier)
- [x] T007 [P] Add new i18n keys to `apps/frontend/src/assets/i18n/en.json` and `nl.json` — keys to add: `nav.back_to_rotations` ("Rotations" / "Rotaties"), `landing.pick_up_title` ("Pick up where you left off" / "Ga verder"), `landing.tips_title` ("Tips" / "Tips"), `landing.tips_tip1/tip2/tip3` (three tip strings), `queue.drag_to_reorder` ("Drag to reorder" / "Versleep om te sorteren"), `queue.add_member` ("Add member" / "Lid toevoegen"), `occurrence.hero.up_next_label` ("UP NEXT · IN {{n}} DAYS" / "VOLGENDE · OVER {{n}} DAGEN"), `occurrence.hero.up_next_today` ("UP NEXT · TODAY" / "VOLGENDE · VANDAAG"), `occurrence.hero.then_on` ("then {{member}} on {{date}}" / "dan {{member}} op {{date}}")

**Checkpoint**: Foundation complete — all shared services and the pill bar component exist; user story phases can now proceed

---

## Phase 3: User Story 2 — Redesigned landing page with create form (Priority: P1)

**Goal**: The landing page shows the v3 two-column card layout with the redesigned create form, Tips card, and pill app bar. The create-rotation flow still works correctly. After creation, the new rotation is written to `RecentRotationStore`.

**Independent Test**: Navigate to `/` — should see pill bar, large create form card (full width), Tips card in right column. Fill in a name, click "Create rotation" — should navigate to the new dashboard. In DevTools → Application → localStorage: `whos-next:recent-rotations` should contain an entry for the new rotation.

- [x] T008 [P] [US2] Create `apps/frontend/src/app/features/landing/tips-card/tips-card.component.ts` + `tips-card.component.scss` — standalone OnPush, no inputs, injects `TranslateService`; template: card div with title ("TIPS" via `landing.tips_title` key, Inter Tight 600 14px uppercase +0.08em tracking, `--mat-sys-on-primary-container`) and ordered list of 3 tips each with JetBrains Mono `01/02/03` number (`--mat-sys-primary`) + tip text (13px `--mat-sys-on-surface-variant`); styles: `background: var(--color-primary-subtle)`, `border: 1px solid var(--mat-sys-primary-container)`, `border-radius: var(--radius-lg)`, `padding: 22px`
- [x] T009 [US2] Restyle `apps/frontend/src/app/features/landing/create-rotation-form.component.ts` — keep all existing reactive form logic, validators, API call, and `created` output unchanged; replace `<mat-form-field>` with a custom name input container: `div.name-container` with `background: var(--mat-sys-surface-container-low)`, `border-radius: 16px`, `padding: 14px 18px`, `border: 1px solid transparent`, users SVG icon 20px `--mat-sys-outline`, and `<input>` with `font-family: 'Inter Tight'`, `font-size: 22px`, `font-weight: 600`, `letter-spacing: -0.01em`, no border, transparent bg; add "New rotation" chip above headline (chip: `--mat-sys-primary-container` bg, `--mat-sys-on-primary-container` text, sparkle icon 12px, pill shape, margin-bottom 14px); add `<h2>` headline (Inter Tight 700 32px -0.02em, `--mat-sys-on-surface`) and `<p>` subheading (15px `--mat-sys-on-surface-variant`); keep `<app-schedule-config>` for cadence row; submit button becomes primary filled pill (padding 12px 22px, Inter Tight 600); remove old `<mat-label>` and mat-error elements (add inline validation message divs instead); add accent corner element (`position: absolute; right: -120px; top: -120px; width: 320px; height: 320px; background: radial-gradient(circle, var(--mat-sys-primary-container), transparent 70%)`, `aria-hidden="true"`)
- [x] T010 [US2] Rewrite `apps/frontend/src/app/features/landing/landing.page.ts` + `landing.page.scss` — (a) template: `<app-pill-app-bar>` with left slot: logo SVG 26px + "Who's Next" Inter Tight 700 16px + separator div + rotation count span (13px `--mat-sys-outline`); right slot: language icon button calling `languageService.use()`; page grid: `display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; max-width: 1080px; padding: 20px 28px; margin: 0 auto`; create form card `grid-column: 1 / -1` (full width, `background: var(--mat-sys-surface)`, `border-radius: var(--radius-xl)`, `border: 1px solid var(--mat-sys-outline-variant)`, `padding: 32px`, `box-shadow: var(--shadow-1)`, `position: relative; overflow: hidden`); Tips card in right column; `@if (recentRotations().length)` block for pick-up section in left column (renders nothing for now — component added in T012); (b) inject `RecentRotationStore`, `LanguageService`; `recentRotations = signal([] as RecentRotationRecord[])`; in `onCreated(slug)`: call `this.store.add({slug, name: ..., cadence: ..., nextMember: '', nextDate: ''})` before navigating (cadence from form state); (c) remove old hero/radial-gradient and `min-height: calc(100dvh - 64px)` styles

**Checkpoint**: Landing page renders v3 layout with create form, tips, pill bar. Create a rotation → localStorage entry created → navigate to dashboard. Pill bar shows rotation count = 1.

---

## Phase 4: User Story 1 — "Pick up where you left off" (Priority: P1)

**Goal**: The landing page shows up to 3 recently visited rotations in the second-row left card when localStorage has entries. Each row links directly to the rotation dashboard.

**Independent Test**: Visit any rotation dashboard (so localStorage gets written in Phase 5/T015), then navigate back to `/`. The "Pick up where you left off" card should appear with a row for that rotation showing its name, cadence, next member, and date.

- [x] T011 [P] [US1] Create `apps/frontend/src/app/features/landing/pick-up-where-you-left-off/pick-up-where-you-left-off.component.ts` + `.scss` — standalone OnPush; input `records: RecentRotationRecord[]`; template: card div with title (Inter Tight 600 14px uppercase +0.08em, `--mat-sys-on-surface-variant`, `landing.pick_up_title` key) + `@for (record of records(); track record.slug)` loop of row `<a [routerLink]="['/', record.slug]">`: `display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 12px 14px; border-radius: 12px; background: var(--mat-sys-surface-container-low); text-decoration: none; color: inherit` with hover → `--mat-sys-surface-container`; left side: name (Inter Tight 600 14px `--mat-sys-on-surface`) + meta line (12px `--mat-sys-outline`: "{cadence} · next: {nextMember} ({nextDate})"); right: chevron icon 16px `--mat-sys-outline`; card styles: `background: var(--mat-sys-surface)`, `border: 1px solid var(--mat-sys-outline-variant)`, `border-radius: var(--radius-lg)`, `padding: 22px`; each row `aria-label="Go to {{record.name}} rotation"` for accessibility
- [x] T012 [US1] Update `apps/frontend/src/app/features/landing/landing.page.ts` — (a) inject `RecentRotationStore` (already done in T010 for the signal); update `recentRotations` to actually read from store: `readonly recentRotations = signal(this.store.getAll())`; (b) add `PickUpWhereYouLeftOffComponent` to imports array; (c) in the template's `@if (recentRotations().length)` block, render `<app-pick-up-where-you-left-off [records]="recentRotations()" />` in the landing grid left column (second row); (d) update the pill bar rotation count span to use `recentRotations().length`

**Checkpoint**: With prior rotation visits in localStorage, landing shows pick-up card with correct rows. Without localStorage data, pick-up card is absent. Rotation count badge in pill bar reflects stored count.

---

## Phase 5: User Story 3 — Redesigned two-column dashboard (Priority: P1)

**Goal**: The rotation dashboard uses a two-column CSS grid with a gradient Up Next hero card on the left, the member queue below it, and the schedule timeline spanning the right column. A skeleton loading state appears before data arrives.

**Independent Test**: Navigate to any existing rotation with a schedule and members. Should see pill app bar, two-column layout, gradient hero card with member name and Skip button, queue with drag handles, schedule timeline on the right.

- [x] T013 [P] [US3] Create `apps/frontend/src/app/features/rotation/dashboard-skeleton/dashboard-skeleton.component.ts` + `dashboard-skeleton.component.scss` — standalone OnPush; host attrs: `role="status"`, `aria-busy="true"`, `aria-label` from i18n; template: two-column grid wrapper matching dashboard grid (`grid-template-columns: 1.05fr 1fr; gap: 16px`) with three shimmer blocks: tall-left (min-height 220px, border-radius var(--radius-xl), represents hero card), short-left (min-height 200px, border-radius var(--radius-lg), represents queue), right-tall (grid-row: 1 / 3, min-height 480px, border-radius var(--radius-lg), represents schedule); shimmer animation: `@keyframes skeleton-shimmer` with `background-position` gradient trick using `var(--mat-sys-surface-container-high)` and `var(--mat-sys-surface-container)` colors
- [x] T014 [P] [US3] Create `apps/frontend/src/app/features/rotation/up-next-hero-card/up-next-hero-card.component.ts` + `up-next-hero-card.component.scss` — standalone OnPush; inputs: `occurrence: OccurrenceDto | null`, `nextAfter: OccurrenceDto | null`, `schedule: ScheduleDto | null`, `canSkip: boolean`; output: `skip = output<void>()`; computed: `daysUntil()` from `occurrence.date` → integer; computed: `heroLabel()` → "UP NEXT · IN N DAYS" or "UP NEXT · TODAY"; computed: `dateDisplay()` → formatted weekday + date string; computed: `thenDisplay()` → "then {nextAfter.memberName} on {date}" if nextAfter exists; template: card div with `position: relative; overflow: hidden`; decorative radial element `position: absolute; right: -40px; top: -40px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(255,255,255,0.15), transparent 60%); pointer-events: none; aria-hidden="true"`; label (11px 600 +0.16em tracking 0.85 opacity uppercase); hero name (Inter Tight 700 44px -0.02em, `--mat-sys-on-primary`); date line (14px 0.9 opacity); skip button (`rgba(255,255,255,0.18)` bg, `--mat-sys-on-primary` text, `1px solid rgba(255,255,255,0.3)` border, pill shape, 600 13px, calls `skip.emit()`); styles: `background: linear-gradient(180deg, var(--mat-sys-primary), var(--color-primary-dark))`, `color: var(--mat-sys-on-primary)`, `border-radius: var(--radius-xl)`, `padding: 26px`, `min-height: 220px`, `display: flex; flex-direction: column; justify-content: space-between`; `@if (!occurrence)` shows empty state text
- [x] T015 [US3] Restructure `apps/frontend/src/app/features/rotation/rotation.page.ts` + `rotation.page.scss` — (a) replace loading state `<div class="page-container state-message">` with `<app-dashboard-skeleton />`; (b) add `PillAppBarComponent`, `DashboardSkeletonComponent`, `UpNextHeroCardComponent` to imports; (c) pill bar: left slot: `<a routerLink="/">← nav.back_to_rotations</a>` + separator + rotation name span + cadence chip (small pill: `--mat-sys-primary-container` bg, `--mat-sys-on-primary-container` text, 11px uppercase); right slot: Share icon button + Settings icon button; (d) two-column grid: `display: grid; grid-template-columns: 1.05fr 1fr; gap: 16px` around the content area; left column: `<app-up-next-hero-card>` + queue card div; right column: `<app-occurrence-view>` with `grid-row: 1 / 3`; (e) add `windowLoaded = signal<OccurrenceWindowDto | null>(null)` to hold occurrence data; add `(windowLoaded)="onWindowLoaded($event)"` handler on `<app-occurrence-view>`; compute `nextOccurrence()` and `nextAfterOccurrence()` from `windowLoaded()`; pass to `UpNextHeroCardComponent`; (f) `onSkip()` handler on `UpNextHeroCardComponent` — delegate to existing cancel logic; (g) call `this.recentRotationStore.add({slug, name, cadence, nextMember, nextDate})` after rotation data loads successfully; (h) `rotation.page.scss`: replace old single-column styles with grid layout, queue card custom div styles (background surface, border radius-lg, border outline-variant, padding 20px), remove mat-card and expansion-panel classes
- [x] T016 [US3] Update `apps/frontend/src/app/features/rotation/member-queue/member-queue.component.ts` + `.scss` — (a) member row layout: change to CSS grid `grid-template-columns: auto auto 1fr auto auto; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--mat-sys-outline-variant)` (first row no border-top); drag handle: dots icon 16px `--mat-sys-outline-variant`; avatar: 32px color-generated (existing oklch hash pattern); name: Inter 500 14px `--mat-sys-on-surface`; date: 12px (first member: `--mat-sys-primary` 600 actual date, others: `--mat-sys-outline` 400 "+Nw" offset); remove button: transparent bg no border `--mat-sys-outline-variant` icon 14px; (b) add "Add member" button at bottom of list: outlined ghost pill style, full width, `justify-content: center`, `padding: 10px`, plus icon 14px, emits new `addMemberClicked` output; (c) in `rotation.page.ts`: handle `(addMemberClicked)` by toggling `addMemberExpanded` signal; show `<app-add-member-form>` inline when expanded (replacing the old `mat-expansion-panel`); remove `MatExpansionModule` from imports

**Checkpoint**: Dashboard renders two-column layout with gradient hero card, queue with drag handles and "Add member" button, skeleton during loading. Skeleton → content transition works correctly. RecentRotationStore is written on load.

---

## Phase 6: User Story 4 — Extended schedule timeline (Priority: P2)

**Goal**: The schedule timeline shows exactly 1 past occurrence and 8 future occurrences. Backend accepts and honours `?past=1&future=8` query params.

**Independent Test**: Open a rotation with an active recurring schedule that has both past and future occurrences. The timeline should show: 1 muted past row at top, current/next row with accent dot, 8 future rows. Network tab confirms `?past=1&future=8` in the request URL.

- [x] T017 [P] [US4] Update `apps/backend/src/schedule/schedule.controller.ts` — add `@Query('past') pastStr?: string` and `@Query('future') futureStr?: string` to `getOccurrenceWindow()`; parse: `const past = Math.min(52, Math.max(0, Number.parseInt(pastStr ?? '1', 10) || 1))` and similarly for future (default 2); call `this.occurrenceService.getWindow(slug, past, future)`
- [x] T018 [P] [US4] Update `apps/backend/src/schedule/occurrence.service.ts` — change `getWindow(slug: string)` to `getWindow(slug: string, pastCount = 1, futureCount = 2)`; replace `limit: 2` in past query → `limit: pastCount`; replace `getFutureRecurrenceDatesAfter(schedule, nextDate, 2)` → `getFutureRecurrenceDatesAfter(schedule, nextDate, futureCount)`; replace `.slice(0, 2)` in custom date list filter → `.slice(0, futureCount)`; update existing test file `apps/backend/src/schedule/occurrence.service.spec.ts` — pass `pastCount`/`futureCount` arguments to `getWindow()` calls; add test cases: `getWindow(slug, 1, 8)` returns at most 1 past and 8 future entries
- [x] T019 [P] [US4] Update `apps/frontend/src/app/core/api/schedule.api.ts` — change `getWindow(slug: string)` signature to `getWindow(slug: string, params: { past: number; future: number } = { past: 1, future: 2 })`; update URL: `` `/api/rotations/${slug}/occurrences?past=${params.past}&future=${params.future}` ``
- [x] T020 [US4] Update `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts` — (a) in `loadWindow()`: call `this.api.getWindow(slug, { past: 1, future: 8 })`; (b) add `windowLoaded = output<OccurrenceWindowDto>()` and emit in the `next:` callback after setting `this.window`; (c) remove the existing `<div class="hero">` block from the component template (hero card is now `UpNextHeroCardComponent` in the rotation page); update `allOccurrences()` computed if needed now that `past` and `future` arrays have different sizes
- [x] T021 [US4] Restyle `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts` template + `.scss` — (a) schedule card wrapper: `background: var(--mat-sys-surface)`, `border: 1px solid var(--mat-sys-outline-variant)`, `border-radius: var(--radius-lg)`, `padding: 20px`; card header: flex space-between align baseline, title Inter Tight 600 16px, count label 12px `--mat-sys-outline`; (b) timeline container: `position: relative; padding-left: 24px`; vertical line: `position: absolute; left: 11px; top: 6px; bottom: 6px; width: 2px; background: var(--mat-sys-surface-container-high)`; (c) each row: `display: flex; align-items: center; gap: 12px; padding: 10px 0; position: relative`; dot `position: absolute; left: -19px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; border-radius: 50%` — current: `background: var(--mat-sys-primary); border: 3px solid var(--mat-sys-primary-container)` — past: `background: var(--mat-sys-surface-container-high); border: 2px solid var(--mat-sys-outline-variant)` — future: `background: var(--mat-sys-surface); border: 2px solid var(--mat-sys-outline-variant)`; (d) date column: `width: 64px; font-family: 'JetBrains Mono'; font-size: 12px` — current: `color: var(--color-primary-dark); font-weight: 600` — others: `color: var(--mat-sys-outline); font-weight: 400`; (e) name sub-label for current: 11px `--mat-sys-primary` 600 "Up next"; (f) ⋯ "more options" button: transparent bg no border `--mat-sys-outline` icon 14px padding 4px; (g) update `OccurrenceCardComponent` props/template as needed to expose these styles

**Checkpoint**: Navigate to a rotation with recurring schedule and past occurrences. Timeline shows 1 muted past row, accent dot for current/next, 8 future rows. Network request has `?past=1&future=8`.

---

## Phase 7: User Story 5 — Pill app bar on both pages (Priority: P2)

**Goal**: Both pages' pill app bars show their full specified content. The cadence chip on the dashboard shows the correct human-readable cadence. The rotation count on the landing page is correct. The language switcher is accessible via the settings panel.

**Independent Test**: Load landing page — pill bar shows "Who's Next" + separator + count. Load dashboard — pill bar shows "← Rotations" + separator + rotation name + cadence chip + Share + Settings. Click "← Rotations" → navigates to `/`.

- [x] T022 [P] [US5] Update `apps/frontend/src/app/features/landing/landing.page.ts` — ensure pill bar left slot includes the app logo SVG (inline 26px monochrome), separator (`width: 1px; height: 16px; background: var(--mat-sys-outline-variant); margin: 0 8px`), and the rotation count span shows exactly `recentRotations().length`; ensure right slot includes language icon button (uses `languageService.use()`, icon `language`, `aria-label` from i18n); verify count updates reactively if `recentRotations` signal is updated
- [x] T023 [P] [US5] Update `apps/frontend/src/app/features/rotation/rotation.page.ts` — (a) pill bar left slot: `<a routerLink="/" class="back-link"><mat-icon>arrow_back</mat-icon> {{ 'nav.back_to_rotations' | translate }}</a>` + separator + rotation name bold Inter Tight 700 16px + cadence chip (use existing `describeSchedule()` logic from occurrence-view or extract helper; format as "WEEKLY · MON", uppercase, chip: `--mat-sys-primary-container` bg, `--mat-sys-on-primary-container` text, `border-radius: 999px`, `padding: 3px 10px`, `font-size: 11px`, `font-weight: 600`, `letter-spacing: +0.06em`); (b) right slot: Share icon button (existing `copyUrl()` + `urlCopied()` icon toggle) + Settings icon button that scrolls to / expands the `app-rotation-settings` section; (c) move language switcher into `app-rotation-settings` component (add language toggle buttons to settings expansion content); remove language switcher from any remaining global location
- [x] T024 [US5] Final cleanup of `apps/frontend/src/app/app.component.ts` — verify template is minimal (only `<main class="app-content"><router-outlet /></main>`); verify `:host` style gives correct flex/height behavior without toolbar offset; verify no `64px` offset references remain in any page styles (grep for `64px` in frontend SCSS files and remove/update any occurrence `min-height: calc(100dvh - 64px)` → `min-height: 100dvh`)

**Checkpoint**: Both pages have full pill app bar content. Language switcher accessible in settings. No layout gaps or overflow from removed toolbar.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and accessibility verification across all modified files.

- [x] T025 Run `pnpm run lint` from repo root — fix any ESLint errors or warnings in all modified files (`import type`, import ordering, no floating promises, no hardcoded hex values in styles)
- [x] T026 [P] Run `pnpm tsc --noEmit` from repo root (or per-package: `apps/frontend` and `apps/backend`) — resolve all TypeScript errors; verify `RecentRotationRecord` is not accidentally imported from `@whos-next/shared`
- [x] T027 [P] Manual accessibility audit — (a) tab through landing page: pill bar links/buttons reachable, create form inputs reachable, pick-up rows reachable; (b) tab through dashboard: pill bar back link reachable, Skip button in hero card reachable, queue drag handles and remove buttons reachable; (c) verify skeleton has `aria-busy="true"` and `role="status"`; (d) verify hero card decorative element has `aria-hidden="true"`; (e) check color contrast on hero card text (white on primary gradient) meets AA minimum 4.5:1
- [x] T028 Run e2e axe-core accessibility scan — verify no axe violations on landing page (`/`) and dashboard (`/:slug`) (WCAG 2.2 AA gate per Constitution Principle IV); fix any violations before marking done

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US2)**: Depends on Phase 2
- **Phase 4 (US1)**: Depends on Phase 3 (needs landing page layout from T010)
- **Phase 5 (US3)**: Depends on Phase 2; independent from Phases 3–4
- **Phase 6 (US4)**: Depends on Phase 5 (T020 depends on occurrence-view from T015); backend tasks (T017, T018) are independent
- **Phase 7 (US5)**: Depends on Phases 3, 4, 5 (polishes pill bars already wired in those phases)
- **Phase 8 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US2 (Phase 3)**: After Foundation — no story dependencies
- **US1 (Phase 4)**: After US2 (needs landing page layout from T010)
- **US3 (Phase 5)**: After Foundation — independent from US1/US2; can run in parallel with Phase 3
- **US4 (Phase 6)**: After US3 (T020 needs occurrence-view component from T015); T017/T018/T019 independent
- **US5 (Phase 7)**: After US2, US1, US3

### Within Each Phase — Parallel Opportunities

- T001, T004, T005, T007, T008, T013, T014, T017, T018, T019, T025, T026, T027 all marked [P] — run in parallel within their phases

---

## Parallel Execution Examples

```
# Phase 1 (can run T001 alongside T002/T003 start):
Simultaneously: T001 (index.html fonts), T002 (styles.scss), T003 (app.component.ts)

# Phase 2 (all parallel except T006 which is a new file):
Simultaneously: T004 (LanguageService), T005 (RecentRotationStore), T007 (i18n keys)
Then: T006 (PillAppBarComponent — depends on knowing final token names from T002)

# Phase 3 + Phase 5 (can run simultaneously):
Simultaneously: T008 (TipsCard), T013 (DashboardSkeleton), T014 (UpNextHeroCard)
Then: T009 (create form restyle) | T015 (rotation page restructure) — different files, can overlap

# Phase 6 backend + frontend in parallel:
Simultaneously: T017 (controller), T018 (service), T019 (API service)
Then: T020 (occurrence-view), then T021 (occurrence-view styles)
```

---

## Implementation Strategy

### MVP First (US2 + US3 Only — core redesign visible)

1. Complete Phase 1: Setup (styles, fonts, app shell)
2. Complete Phase 2: Foundation (services, pill bar)
3. Complete Phase 3 (US2): Landing page structure visible
4. Complete Phase 5 (US3): Dashboard two-column layout visible
5. **STOP and VALIDATE**: Both pages show v3 design — demo-ready

### Full Feature Delivery Order

1. Phase 1 → Phase 2 → Phase 3 (US2) → Phase 4 (US1) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5) → Phase 8
2. Each phase checkpoint is independently testable
3. Ship after Phase 8 passes all quality gates

### Parallel Team Strategy

With two developers:
- Dev A: Phase 1 + Phase 3 (US2) + Phase 4 (US1) → landing page track
- Dev B: Phase 2 + Phase 5 (US3) + Phase 6 (US4) → dashboard track
- Both: Phase 7 (US5 polish) + Phase 8 (quality gates)

---

## Notes

- `RecentRotationRecord` is defined in `recent-rotation-store.service.ts` (frontend-only). Do NOT add it to `packages/shared/` — it is not a server DTO.
- The `OccurrenceViewComponent` hero section (`<div class="hero">`) is removed in T020. The hero card is now `UpNextHeroCardComponent` in the rotation page. Ensure no orphaned i18n key `occurrence.hero_label` references remain after T020.
- All file size limits apply: max 300 lines per component; split if approached.
- `mat-card`, `mat-expansion-panel` are removed from the dashboard; their Angular Material modules may be removed from `rotation.page.ts` imports if no longer used elsewhere.
- Color-generated avatars (oklch hue hash from member name) are an existing pattern — verify it is carried over correctly to the new queue card and timeline rows.
