# Implementation Plan: V3 UI Redesign — Landing & Dashboard Pages

**Branch**: `20260425-120000-v3-redesign` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)

---

## Summary

Replace the current landing page and rotation dashboard with the v3 card-forward designs. Key changes: remove the global sticky toolbar (each page renders its own pill app bar), introduce a two-column CSS grid layout on both pages, add a "Pick up where you left off" section backed by browser localStorage, extend the occurrence window API with `past`/`future` query parameters to show 1 past + 8 future occurrences, update the Angular Material M3 theme to use Inter/Inter Tight/JetBrains Mono fonts with a dark mode variant, and add skeleton loading cards to the dashboard.

---

## Technical Context

**Language/Version**: TypeScript 5.9.3  
**Primary Dependencies**: Angular 21, Angular Material M3, @ngx-translate/core (frontend); NestJS 11, MikroORM 7 (backend)  
**Storage**: PostgreSQL 16 (no schema changes); browser localStorage (new, frontend-only)  
**Testing**: Vitest (unit/integration), Playwright + axe-core (e2e/accessibility)  
**Target Platform**: Browser SPA + Node.js API server (Railway single-instance)  
**Project Type**: Web application (monorepo: frontend Angular SPA + backend NestJS API)  
**Performance Goals**: No new latency targets. Occurrence window already fetched on route load; `past=1&future=8` returns ~10 rows — well within existing API performance envelope.  
**Constraints**: 300-line file limit per component/service; no new external npm packages; WCAG 2.2 AA required; pnpm workspace dependency rules enforced.  
**Scale/Scope**: ~15 source files modified or created; 1 API endpoint parameter addition; 0 new DB migrations.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Verified post-research below.*

| Principle | Check | Notes |
|-----------|-------|-------|
| **I — Monorepo / Shared Types** | ✅ Pass | No new DTOs added to shared; `OccurrenceWindowDto` and `OccurrenceDto` are unchanged. `RecentRotationRecord` is frontend-only (localStorage), not a cross-package type. |
| **II — Stateless URL-Based Access** | ✅ Pass | No auth, sessions, or user accounts introduced. localStorage stores only UI convenience data; it does not gate access to any rotation. |
| **III — Privacy by Design** | ✅ Pass | localStorage stores `slug` (non-identifying), rotation name (user-provided display label), cadence (derived), member first name (display label). No PII beyond what the user already entered as free text. No new data sent to the server. |
| **IV — Accessibility Hard Gate** | ✅ Pass | WCAG 2.2 AA is a named success criterion (SC-005). Skeleton cards carry `aria-busy="true"` on the containing region. All new interactive elements (pill app bar links/buttons) are keyboard-reachable. |
| **V — Simplicity / No Speculative Infrastructure** | ✅ Pass | No new external services, npm packages, or Redis. Shimmer skeleton: ~15 lines CSS. localStorage service: ~30 lines TS. No abstractions beyond what this feature requires. |

**Complexity Tracking**: No constitution violations — section not applicable.

---

## Project Structure

### Documentation (this feature)

```text
specs/20260425-120000-v3-redesign/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── occurrence-window.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (affected files)

```text
apps/frontend/
├── src/
│   ├── index.html                         MODIFY — update Google Fonts link
│   ├── styles.scss                        MODIFY — M3 theme update, dark mode, tokens, fonts
│   ├── app/
│   │   ├── app.component.ts               MODIFY — remove toolbar, keep shell only
│   │   ├── core/
│   │   │   ├── api/
│   │   │   │   └── schedule.api.ts        MODIFY — add past/future params to getWindow()
│   │   │   ├── language.service.ts        NEW — extract switchLanguage() from AppComponent
│   │   │   └── recent-rotation-store.service.ts  NEW — localStorage recent rotations
│   │   ├── shared/
│   │   │   └── pill-app-bar/
│   │   │       ├── pill-app-bar.component.ts     NEW — shared pill bar shell (content projection)
│   │   │       └── pill-app-bar.component.scss   NEW
│   │   └── features/
│   │       ├── landing/
│   │       │   ├── landing.page.ts        MODIFY — new layout, pick-up section, tips, local storage write
│   │       │   ├── landing.page.scss      NEW/MODIFY — two-column grid, page styles
│   │       │   ├── create-rotation-form.component.ts  MODIFY — restyle to v3 design
│   │       │   ├── pick-up-where-you-left-off/
│   │       │   │   ├── pick-up-where-you-left-off.component.ts  NEW
│   │       │   │   └── pick-up-where-you-left-off.component.scss NEW
│   │       │   └── tips-card/
│   │       │       ├── tips-card.component.ts     NEW
│   │       │       └── tips-card.component.scss   NEW
│   │       └── rotation/
│   │           ├── rotation.page.ts       MODIFY — two-column grid, skeleton loading, pill app bar
│   │           ├── rotation.page.scss     MODIFY — replace single-column with grid layout
│   │           ├── up-next-hero-card/
│   │           │   ├── up-next-hero-card.component.ts    NEW
│   │           │   └── up-next-hero-card.component.scss  NEW
│   │           ├── dashboard-skeleton/
│   │           │   ├── dashboard-skeleton.component.ts   NEW
│   │           │   └── dashboard-skeleton.component.scss NEW
│   │           └── occurrence-view/
│   │               └── occurrence-view.component.ts  MODIFY — pass past=1&future=8

apps/backend/
└── src/
    └── schedule/
        ├── schedule.controller.ts    MODIFY — add @Query past/future params
        └── occurrence.service.ts    MODIFY — parameterize past/future counts

apps/frontend/src/assets/i18n/
├── en.json    MODIFY — add new translation keys
└── nl.json    MODIFY — add Dutch translations for new keys
```

---

## Phase 0 Research Findings

See [research.md](./research.md) for full rationale. Summary of decisions:

| Topic | Decision |
|-------|----------|
| M3 seed color | Use existing `mat.$violet-palette` (closest pre-defined palette to `#7b3eee`; no custom palette generation needed) |
| Dark theme | Add `@media (prefers-color-scheme: dark)` block calling `mat.theme()` with `theme-type: dark` |
| `--mat-sys-*` emission | Already default in Angular Material 21; no `use-system-variables` flag needed |
| Fonts | Google Fonts variable fonts: Inter (300–700), Inter Tight (500–700), JetBrains Mono (400,500) |
| Skeleton shimmer | Pure CSS `@keyframes` with `background-position` gradient trick; no library |
| localStorage service | `@Injectable({ providedIn: 'root' })` with try/catch; key `whos-next:recent-rotations` |
| Language switcher | Extracted to `LanguageService`; shown in landing pill app bar right slot; in rotation settings panel |
| Pill app bar | Single `PillAppBarComponent` with content projection (`[slot=left]`, `[slot=right]`) |
| Backend params | Optional `past` (default 1) and `future` (default 2) query params; clamped to [0, 52] |

---

## Phase 1 Implementation Guide

### 1. Backend: Occurrence Window Parameter Addition

**File**: `apps/backend/src/schedule/schedule.controller.ts`

Add `@Query('past')` and `@Query('future')` parameters to `getOccurrenceWindow`. Parse as integers, default to 1 and 2, clamp to [0, 52].

```typescript
@Get('occurrences')
async getOccurrenceWindow(
  @Param('slug') slug: string,
  @Query('past') pastStr?: string,
  @Query('future') futureStr?: string,
): Promise<OccurrenceWindowDto> {
  const past = Math.min(52, Math.max(0, Number.parseInt(pastStr ?? '1', 10) || 1));
  const future = Math.min(52, Math.max(0, Number.parseInt(futureStr ?? '2', 10) || 2));
  return this.occurrenceService.getWindow(slug, past, future);
}
```

**File**: `apps/backend/src/schedule/occurrence.service.ts`

Update `getWindow(slug)` to `getWindow(slug, pastCount = 1, futureCount = 2)`. Replace:
- `limit: 2` (past query) → `limit: pastCount`
- `getFutureRecurrenceDatesAfter(schedule, nextDate, 2)` → `getFutureRecurrenceDatesAfter(schedule, nextDate, futureCount)`
- `.slice(0, 2)` (custom date list future filter) → `.slice(0, futureCount)`

No changes to settlement logic, DTO shape, or any other service method.

**Tests**: Update `occurrence.service.spec.ts` — pass `pastCount`/`futureCount` to `getWindow()` calls; add test cases verifying `past=1` returns at most 1 entry, `future=8` returns up to 8 entries.

---

### 2. Frontend API: `OccurrencesApiService.getWindow`

**File**: `apps/frontend/src/app/core/api/schedule.api.ts`

```typescript
getWindow(slug: string, params: { past: number; future: number } = { past: 1, future: 2 }): Observable<OccurrenceWindowDto> {
  return this.http.get<OccurrenceWindowDto>(
    `/api/rotations/${slug}/occurrences?past=${params.past}&future=${params.future}`
  );
}
```

---

### 3. Theme & Global Styles

**File**: `apps/frontend/src/index.html`

Replace existing Google Fonts link with:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Inter+Tight:wght@500..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```
Remove Plus Jakarta Sans and Roboto links.

**File**: `apps/frontend/src/styles.scss`

Full rewrite:
1. Light theme: `mat.theme()` with `primary: mat.$violet-palette, tertiary: mat.$orange-palette, theme-type: light`, typography `plain-family: 'Inter', brand-family: 'Inter Tight'`, density 0.
2. Dark theme: `@media (prefers-color-scheme: dark)` re-invoking `mat.theme()` with `theme-type: dark` (color config only, no typography/density re-emit needed).
3. Derived custom properties (once on `html` — values track dark mode via lazy `var()` resolution):
   - `--color-primary-dark: color-mix(in srgb, var(--mat-sys-primary) 70%, black 30%)`
   - `--color-primary-subtle: color-mix(in srgb, var(--mat-sys-primary-container) 50%, var(--mat-sys-surface))`
4. Design token custom properties (on `html`): `--radius-sm: 8px`, `--radius: 12px`, `--radius-lg: 18px`, `--radius-xl: 24px`, `--shadow-1: 0 1px 2px rgba(20,16,28,0.06), 0 1px 3px rgba(20,16,28,0.04)`, `--shadow-2: 0 2px 6px rgba(20,16,28,0.06), 0 8px 24px rgba(20,16,28,0.05)`.
5. `body` font-family: `'Inter', sans-serif`.
6. `.page-container`: `max-width: 1080px`, padding `20px 28px`.
7. Remove old h1/h2/h3 Plus Jakarta Sans rule (typography now handled by M3 brand-family).

---

### 4. App Component Simplification

**File**: `apps/frontend/src/app/app.component.ts`

Remove `<mat-toolbar>`, all toolbar-related imports (MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule). Retain `RouterOutlet`, `TranslateModule`, inject `LanguageService` + `TranslateService` (for init only). Template becomes:
```html
<main class="app-content">
  <router-outlet />
</main>
```
Remove `switchLanguage()` method (moved to `LanguageService`). Keep `ngOnInit()` for setting default language.

---

### 5. New: LanguageService

**File**: `apps/frontend/src/app/core/language.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal(this.translate.currentLang ?? 'en');

  use(lang: 'en' | 'nl'): void {
    this.translate.use(lang);
    this.current.set(lang);
  }
}
```

---

### 6. New: RecentRotationStore

**File**: `apps/frontend/src/app/core/recent-rotation-store.service.ts`

- Key: `whos-next:recent-rotations`
- `getAll()`: try `localStorage.getItem`, parse JSON, validate array, return; catch → return `[]`.
- `add(record)`: getAll(), remove any entry with same slug, prepend record, trim to 3, try `localStorage.setItem`; catch → no-op.
- Export `RecentRotationRecord` interface from this file (frontend-only type, not shared package).

---

### 7. New: PillAppBarComponent

**File**: `apps/frontend/src/app/shared/pill-app-bar/pill-app-bar.component.ts`

Standalone component. Template:
```html
<nav class="pill-bar" [class.pill-bar--dashboard]="dashboard()">
  <div class="pill-bar__left">
    <ng-content select="[slot=left]" />
  </div>
  <div class="pill-bar__right">
    <ng-content select="[slot=right]" />
  </div>
</nav>
```

`dashboard` is a boolean input (controls `margin-bottom`: 32px landing / 20px dashboard). Styles: pill shape, `--mat-sys-surface` bg, `1px solid var(--mat-sys-outline-variant)` border, `--shadow-1`, `padding: 10px 16px 10px 14px`, `display: flex; justify-content: space-between; align-items: center`.

---

### 8. Landing Page Full Redesign

**File**: `apps/frontend/src/app/features/landing/landing.page.ts`

Changes:
- Inject `RecentRotationStore`, `LanguageService`.
- `recentRotations = signal(this.store.getAll())` — read once on init.
- After `onCreated(slug)`: before navigating, call `this.store.add({...})` with data derived from the rotation creation response.
- Template: `PillAppBarComponent` + two-column grid: create form card (full-width row 1), pick-up card + tips card (row 2).
- Remove old `hero` markup and `min-height: calc(100dvh - 64px)` host style.

**File**: `apps/frontend/src/app/features/landing/create-rotation-form.component.ts`

Restyle to v3 design. The form structure stays (reactive forms, same validators, same API call) but visual treatment changes significantly:
- Custom name input (not `mat-form-field`): styled container div with icon + `<input>` inside.
- Cadence toggle (Manual / Repeats): custom button group, not `mat-button-toggle-group`.
- Schedule config row (repeats dropdowns): existing `ScheduleConfigComponent` may need wrapper style adjustments.
- Submit button: primary filled pill style.

> **Note**: `CreateRotationFormComponent` is the most design-intensive change. The existing Angular Material form field is replaced by a custom-styled input. Keep all existing form validation logic intact — only the visual layer changes.

**File**: `apps/frontend/src/app/features/landing/pick-up-where-you-left-off/pick-up-where-you-left-off.component.ts`

Input: `records: RecentRotationRecord[]`. Renders card with title + rows. Each row is a `routerLink` to `/${record.slug}`. Applies hover style. Shows nothing (component hidden by `@if` in parent) when `records.length === 0`.

**File**: `apps/frontend/src/app/features/landing/tips-card/tips-card.component.ts`

Static component. Three tips as specified in FR-008 / Visual Design Specification. Uses `--color-primary-subtle` background, `--mat-sys-primary-container` border.

---

### 9. Dashboard Page Restructure

**File**: `apps/frontend/src/app/features/rotation/rotation.page.ts`

Major restructure:
- Replace `<header class="rotation-header">` with `<app-pill-app-bar>` left slot (back link + name + cadence chip) and right slot (Share + Settings buttons).
- Replace `@if (loading())` plain text → `<app-dashboard-skeleton />`.
- Change `.page-container` inner structure from sequential blocks to CSS grid (`gridTemplateColumns: "1.05fr 1fr"`, `gap: 16px`).
- Left column: `<app-up-next-hero-card>` + queue card.
- Right column: `<app-occurrence-view>` (schedule timeline) spanning both left-column rows.
- Remove `mat-expansion-panel` for Add Member — replace with an inline expand/collapse mechanism inside the queue card.
- Remove `mat-card` wrappers around queue and schedule — use custom card divs styled per spec.
- After rotation data loads, call `RecentRotationStore.add()` with derived `RecentRotationRecord`.

**File**: `apps/frontend/src/app/features/rotation/up-next-hero-card/up-next-hero-card.component.ts`

Inputs: `occurrence: OccurrenceDto | null`, `schedule: ScheduleDto | null`, `nextAfter: OccurrenceDto | null` (for "then X on Y" line), `canSkip: boolean`.

Output: `skipClicked: EventEmitter<void>`.

Renders the gradient hero card per Visual Design Specification. Computes "in N days" label from occurrence date. Formats "then [NextMember] on [Date]" from `nextAfter` input. "Skip" button emits `skipClicked`. No "Mark done" button.

**File**: `apps/frontend/src/app/features/rotation/dashboard-skeleton/dashboard-skeleton.component.ts`

Renders two-column grid with shimmer blocks. Left column: tall shimmer (hero card area) + shorter shimmer (queue area). Right column: tall shimmer spanning both rows (schedule area). Uses `aria-busy="true"` on the host. Pure CSS shimmer animation.

---

### 10. OccurrenceViewComponent Update

**File**: `apps/frontend/src/app/features/rotation/occurrence-view/occurrence-view.component.ts`

In `loadWindow()`:
```typescript
this.api.getWindow(slug, { past: 1, future: 8 }).subscribe({ ... });
```

Visual update: The occurrence card and timeline styles need updating to match the new Schedule Timeline Card specification (see spec Visual Design Specification → Schedule Timeline Card). The component's template and SCSS are updated in-place.

---

### 11. i18n Updates

**Files**: `apps/frontend/src/assets/i18n/en.json` and `nl.json`

New keys to add:

```json
{
  "landing": {
    "pick_up_title": "Pick up where you left off",
    "tips_title": "Tips",
    "tips_tip1": "Members rotate in the order you add them — drag to reorder later.",
    "tips_tip2": "Skip a turn from the ⋯ menu on any upcoming card.",
    "tips_tip3": "Share a rotation with the copy icon next to its title."
  },
  "nav": {
    "back_to_rotations": "Rotations"
  },
  "queue": {
    "drag_to_reorder": "Drag to reorder",
    "add_member": "Add member"
  },
  "occurrence": {
    "hero": {
      "up_next_label": "UP NEXT · IN {{n}} DAYS",
      "up_next_today": "UP NEXT · TODAY",
      "then_on": "then {{member}} on {{date}}"
    }
  },
  "language": {
    "label": "Language"
  }
}
```

Dutch translations required for all new keys.

---

### 12. Accessibility Checklist

Per WCAG 2.2 AA requirements enforced by Constitution IV:

- `PillAppBarComponent`: use `<nav>` element with `aria-label="Page navigation"`.
- `PickUpWhereYouLeftOffComponent`: each row link has descriptive `aria-label="Go to {rotation name} rotation"`.
- `UpNextHeroCardComponent`: decorative radial highlight element has `aria-hidden="true"`.
- `DashboardSkeletonComponent`: host element carries `role="status"` and `aria-busy="true"`, `aria-label="Loading rotation..."`.
- Skip button: `aria-label` from i18n key `occurrence.skip.cancelDateAriaLabel` (existing).
- All color-generated avatars: include member name as `aria-label` or `title` (existing pattern; verify carried over).
- Color contrast: all text-on-gradient in hero card uses `--mat-sys-on-primary` (white in light, correct in dark). Verify with axe-core in e2e tests.

---

## Dependency Graph

```
Backend changes (controller + service) → independent of frontend
Frontend API change (getWindow params) → depends on backend being deployed
OccurrenceViewComponent update → depends on API change
UpNextHeroCardComponent → no dependencies (uses occurrence data already on rotation page)
RecentRotationStore → no dependencies
LandingPage → depends on RecentRotationStore, PillAppBarComponent
RotationPage → depends on UpNextHeroCardComponent, DashboardSkeletonComponent, PillAppBarComponent, RecentRotationStore
Theme/styles → independent (can land first, everything benefits)
i18n keys → independent (add before components that use them)
```

**Recommended implementation order**:
1. Backend: controller + service params + tests
2. Shared styles: `styles.scss` + `index.html` font update
3. Infrastructure: `LanguageService`, `RecentRotationStore`, `PillAppBarComponent`
4. Landing page: new components + landing page restructure
5. Dashboard: `UpNextHeroCardComponent`, `DashboardSkeletonComponent`, rotation page restructure + `OccurrenceViewComponent` update
6. i18n keys (add as needed during steps 4–5)
7. App component cleanup (remove toolbar)
8. E2e accessibility sweep
