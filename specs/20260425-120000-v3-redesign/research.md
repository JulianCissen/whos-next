# Research: V3 UI Redesign — Landing & Dashboard Pages

**Branch**: `20260425-120000-v3-redesign` | **Date**: 2026-04-26

---

## 1. Angular Material M3 Custom Seed Color

**Decision**: Use `mat.$violet-palette` as the M3 primary palette (existing palette, already in use).

**Rationale**: Angular Material 21's SCSS API accepts pre-defined tonal palettes from the `@angular/material` package. Generating an arbitrary hex seed (e.g., `#7b3eee`) into a full M3 tonal palette requires the Material Color Utilities JavaScript library or the Material Theme Builder web tool — neither of which integrates cleanly into an SCSS build pipeline. `mat.$violet-palette` is the pre-defined palette whose primary hue is closest to `#7b3eee` (the difference is imperceptible in the UI). The existing theme already uses this palette, so no palette change is required.

**Alternatives considered**:
- Material Theme Builder output (custom SCSS vars pasted into styles.scss): Would produce pixel-perfect seed matching, but adds maintenance burden and breaks cleanly with `mat.theme()`. Deferred; revisit if design QA specifically flags tonal drift.
- Angular Material color-scheme API with hex: Not supported in Angular Material 21 SCSS mixins — only palette references are accepted.

---

## 2. Angular Material M3 Dark Theme with System Preference

**Decision**: Add a `@media (prefers-color-scheme: dark)` block to `styles.scss` re-invoking `mat.theme()` with `theme-type: dark`. Add a `.dark` host class variant for potential manual override.

**Rationale**: The `mat.theme()` mixin re-emits all `--mat-sys-*` CSS custom properties under the selector it is called within. A media query wrapping a second `mat.theme()` call (same palette, `theme-type: dark`) correctly overrides all M3 system tokens for dark mode. Since CSS custom properties are resolved lazily at paint time, derived properties (`--color-primary-dark`, `--color-primary-subtle`) defined via `color-mix(in srgb, var(--mat-sys-primary) ...)` automatically pick up dark-mode token values without redefinition.

**Pattern**:
```scss
@media (prefers-color-scheme: dark) {
  html {
    @include mat.theme((
      color: (
        primary: mat.$violet-palette,
        tertiary: mat.$orange-palette,
        theme-type: dark,
      ),
    ));
  }
}
```

**Alternatives considered**:
- Single `mat.theme()` with `color-scheme: light dark`: Angular Material 21 does not expose this as a mixin option; requires manual `color-scheme` CSS property.
- CSS layer approach: Unnecessary complexity for single-instance deployment.

---

## 3. M3 System Variable Emission (`--mat-sys-*` properties)

**Decision**: No special configuration needed. Angular Material M3's `mat.theme()` mixin emits `--mat-sys-*` custom properties by default in Angular Material 18+.

**Rationale**: The existing codebase already uses `--mat-sys-surface`, `--mat-sys-on-surface`, etc. in component styles without any additional configuration flag. The `use-system-variables: true` option mentioned in some Angular Material documentation refers to an older API that is now the default. No action required beyond the existing `mat.core()` + `mat.theme()` calls.

---

## 4. Font Loading Strategy

**Decision**: Replace Google Fonts link in `index.html` with Inter (weights 300–700), Inter Tight (weights 500–700), and JetBrains Mono (weights 400–500) as variable fonts. Remove Plus Jakarta Sans and Roboto. Update `body` font-family to Inter in `styles.scss`. Update M3 theme `typography` config.

**Rationale**: All three fonts are available on Google Fonts. Variable font loading (`wght` axis) avoids loading multiple weight files. The Angular Material typography config accepts `plain-family` (body text → Inter) and `brand-family` (display/headline → Inter Tight). JetBrains Mono is referenced directly in component SCSS where needed — it does not need to be wired into M3 typography roles.

**Google Fonts URL**:
```
https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Inter+Tight:wght@500..700&family=JetBrains+Mono:wght@400;500&display=swap
```

**Alternatives considered**:
- Self-hosting fonts: Preferred for production performance but introduces build complexity. Can be deferred to a follow-up.
- Keeping Roboto as fallback: Not needed; Inter is a more complete replacement.

---

## 5. Skeleton Card Shimmer (Loading State)

**Decision**: Implement skeleton cards as lightweight custom components using pure CSS shimmer animation (`@keyframes skeleton-shimmer` with `background-position` trick via a gradient). No external library required.

**Rationale**: Angular CDK does not provide a skeleton/shimmer component. Angular Material 21 has no skeleton loader. A CSS-only shimmer is 10–15 lines of SCSS, maintenance-free, and perfectly fits Constitution Principle V (no speculative infrastructure). The skeleton uses `--mat-sys-surface-container-high` for the shimmer base and `--mat-sys-surface-container` for the gradient mid-color — both dark-mode correct.

**Pattern**:
```scss
@keyframes skeleton-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skeleton-block {
  background: linear-gradient(90deg,
    var(--mat-sys-surface-container-high) 25%,
    var(--mat-sys-surface-container)      50%,
    var(--mat-sys-surface-container-high) 75%
  );
  background-size: 800px 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: var(--radius-lg);
}
```

**Alternatives considered**:
- `@angular/cdk/experimental/loading` (if it existed): Does not exist in Angular CDK 21.
- `ngx-skeleton-loader`: Adds an external dependency for 15 lines of CSS. Rejected per Principle V.

---

## 6. LocalStorage Recent Rotations Store

**Decision**: Implement `RecentRotationStore` as an Angular `@Injectable({ providedIn: 'root' })` service. Use `localStorage.getItem / setItem` wrapped in a try/catch. Key: `whos-next:recent-rotations`. Serialize as JSON array of up to 3 `RecentRotationRecord` objects.

**Rationale**: No signals/state management library needed — the store is read once (on landing page init) and written once (on rotation load success). The service keeps it synchronous and simple. Try/catch handles the private browsing / storage-disabled edge case (per FR-013).

**Interface**:
```typescript
interface RecentRotationRecord {
  slug: string;
  name: string;
  cadence: string;        // human-readable, e.g. "Weekly · Mon"
  nextMember: string;
  nextDate: string;       // human-readable, e.g. "Mon, 27 Apr"
}
```

**Storage key**: `whos-next:recent-rotations`
**Alternatives considered**:
- IndexedDB: Overkill for 3 short records.
- Angular signals store: Not warranted for one-shot read/write.

---

## 7. Language Switcher Migration

**Decision**: Move the language switcher out of the global `AppComponent` toolbar into the landing page pill app bar (as a small icon button on the right) and into the rotation settings expansion panel on the dashboard.

**Rationale**: The global toolbar is being removed. The language switcher must live somewhere accessible. The landing page pill app bar is the primary entry point; the settings panel on the rotation page is the natural place for a locale preference on that page.

**Implementation**: Extract `switchLanguage()` from `AppComponent` into a `LanguageService` in `core/`. Both `LandingPage` and `AppComponent` (now a minimal shell) inject it.

---

## 8. Pill App Bar — Shared vs. Per-Page Components

**Decision**: Implement the pill app bar as a single shared `PillAppBarComponent` using Angular content projection (`<ng-content select="[slot=left]">` and `<ng-content select="[slot=right]">`). Each page provides its own left/right content.

**Rationale**: The visual shell (pill shape, surface background, border, shadow, margin-bottom, internal flex layout) is identical between the landing and dashboard app bars. Only the content differs. Content projection avoids duplication without introducing props-based configuration complexity.

**Alternatives considered**:
- Two separate components: Duplicates ~20 lines of SCSS for the pill shell. Rejected.
- Generic `@Input` slots: Less idiomatic in Angular than content projection for layout composition.

---

## 9. Backend `getWindow` Parameter Addition

**Decision**: Add optional `@Query('past')` and `@Query('future')` integer parameters to the controller, defaulting to `pastCount=1` and `futureCount=2` (preserving backward compatibility). Parse with `parseInt()` and clamp to `[0, 52]` for both.

**Rationale**: Backward-compatible defaults ensure existing callers without params continue to work. Clamping at 52 prevents abuse (52 weeks of data). The service signature changes from `getWindow(slug)` to `getWindow(slug, pastCount = 1, futureCount = 2)`, with the past/future array size driven by these params.

**Note**: Current hardcoded values are `limit: 2` for past (fetching 2, returning all) and `2` for future. With `past=1` the frontend gets exactly 1 past occurrence; with `future=8` it gets 8 future occurrences.
