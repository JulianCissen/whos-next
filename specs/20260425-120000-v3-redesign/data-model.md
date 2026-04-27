# Data Model: V3 UI Redesign — Landing & Dashboard Pages

**Branch**: `20260425-120000-v3-redesign` | **Date**: 2026-04-26

---

## Summary

This feature introduces no new database tables or columns. All data model changes are additive parameters to an existing API and a new browser-side store.

---

## New: RecentRotationRecord (Browser LocalStorage Only)

A record of a recently visited rotation, persisted client-side in browser localStorage. Not stored in the database.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | `string` | Rotation URL identifier (8-char base-58). Used as deduplication key and navigation target. |
| `name` | `string` | Display name of the rotation. Max 100 chars (enforced by existing API). |
| `cadence` | `string` | Human-readable cadence description computed at load time. E.g., `"Weekly · Mon"`, `"Monthly · day 15"`, `"Custom dates"`. |
| `nextMember` | `string` | Display name of the member assigned to the next occurrence. Empty string if none. |
| `nextDate` | `string` | Human-readable formatted next occurrence date. E.g., `"Mon, 27 Apr"`. Empty string if no schedule. |

**Store structure**: JSON array of `RecentRotationRecord`, max 3 entries, ordered most-recently-visited first.

**Storage key**: `whos-next:recent-rotations`

**Lifecycle**:
- Written: when a rotation dashboard loads successfully (after API response).
- Eviction: when a 4th entry is added, the oldest (last element) is removed.
- Deduplication: if the slug already exists in the store, it is moved to position 0 with updated field values (no duplicates).
- Read: once, on landing page `ngOnInit`.
- Deleted: never (entries persist until evicted by capacity or browser data cleared).

**Validation** (enforced in `RecentRotationStore` service):
- Max 3 entries; oldest evicted on overflow.
- `slug` is the unique key — duplicate slugs are moved, not duplicated.
- LocalStorage unavailability (private browsing, quota exceeded) is caught silently; the landing page renders without the section.

---

## Modified: OccurrenceWindowDto (shared package, API shape)

Existing DTO — no field changes. The window size is now controlled by query parameters.

```typescript
// packages/shared/src/schedule/index.ts — UNCHANGED
export interface OccurrenceWindowDto {
  past: OccurrenceDto[];   // Now: exactly `past` param entries (default 1)
  next: OccurrenceDto | null;
  future: OccurrenceDto[]; // Now: exactly `future` param entries (default 2)
}
```

The meaning of the `past` and `future` arrays has not changed — only their length is now caller-controlled via the `?past=` and `?future=` query parameters added to the endpoint.

---

## Unchanged: All Database Entities

No migration required. The following entities are consumed by this feature's UI but are not modified:

- `Rotation` — `slug`, `name`, `nextIndex`
- `Member` — `name`, `position`, `removedAt`
- `Schedule` — `type`, `recurrenceRule`
- `ScheduleDate` — `date`
- `OccurrenceAssignment` — `occurrenceDate`, `member`, `skipType`

---

## New: Angular Services (Frontend Only)

### RecentRotationStore

- **Location**: `apps/frontend/src/app/core/recent-rotation-store.service.ts`
- **Scope**: `providedIn: 'root'`
- **Methods**:
  - `getAll(): RecentRotationRecord[]` — reads and returns stored records; returns `[]` on localStorage error.
  - `add(record: RecentRotationRecord): void` — prepends record, deduplicates by slug, trims to max 3, persists.

### LanguageService

- **Location**: `apps/frontend/src/app/core/language.service.ts`
- **Scope**: `providedIn: 'root'`
- **Methods**:
  - `use(lang: 'en' | 'nl'): void` — delegates to `TranslateService.use()`.
  - `current(): string` — returns current language code.

---

## New: Angular Components (Frontend Only)

| Component | Location | Description |
|-----------|----------|-------------|
| `PillAppBarComponent` | `app/shared/pill-app-bar/` | Pill-shaped app bar shell. Left/right slots via content projection. |
| `UpNextHeroCardComponent` | `features/rotation/up-next-hero-card/` | Gradient hero card showing next member + Skip action. |
| `DashboardSkeletonComponent` | `features/rotation/dashboard-skeleton/` | Shimmer skeleton in two-column layout for loading state. |
| `PickUpWhereYouLeftOffComponent` | `features/landing/pick-up-where-you-left-off/` | Card listing recent rotations from localStorage. |
| `TipsCardComponent` | `features/landing/tips-card/` | Static tips card with three numbered tips. |
