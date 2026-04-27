# Feature Specification: V3 UI Redesign — Landing & Dashboard Pages

**Feature Branch**: `20260425-120000-v3-redesign`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Fetch this design file, read its readme, and write a spec for the relevant aspects of the design. I'm looking to implement the v3 landing/create page and the v3 dashboard/details page. For the landing page specifically there is a pick up where you left off section. To implement this I suggest storing the most recent rotation visits in localstorage on a successful navigation with some short key data we can use to display the rotation on the dashboard. Create a spec. Write the spec as detailed as possible based on the designs. I'd like the implementation to match the designs as closely as possible. One more remark; for the dashboard schedule view, we'll probably need to increase the amount of future occurrences visible. I'd also like to always show the previous occurrence (but no more history than that)."

---

## Clarifications

### Session 2026-04-25

- Q: Does the new pill app bar replace the existing global toolbar entirely, or does it sit inside each page component while the existing global toolbar remains? → A: Replace the global toolbar entirely. The global shell provides only the router outlet; each page renders its own pill app bar as an in-page element.
- Q: How does the frontend tell the backend how many past/future occurrences to return? → A: Add `past` and `future` query parameters to the occurrence window endpoint; the frontend passes `?past=1&future=8`.
- Q: At what viewport width should the two-column layout collapse to a single column? → A: 960px.
- Q: What does pressing "Mark done" on the hero card do? → A: Omit the "Mark done" button entirely for now; the hero card shows only the "Skip" action. A dedicated done-marking API is out of scope for this feature.
- Q: While the dashboard data is loading, what visual treatment should the redesigned page show? → A: Skeleton cards — shimmer placeholder cards at the same positions as the real content, replacing the current plain "Loading…" text.

---

## Overview

This feature replaces the current landing page and rotation dashboard/details page with visually redesigned "v3 card-forward dashboard" variants. The redesign addresses two user-facing problems: the landing page lacks personality and context, and the dashboard buries key rotation information (next person, schedule) inside a dense layout with limited look-ahead. Additionally, a "pick up where you left off" feature is introduced on the landing page, making it easy for returning users to navigate directly to recently visited rotations without having to remember or bookmark URLs.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Returning user resumes a rotation from the landing page (Priority: P1)

A returning user opens the app and sees a list of up to 3 recently visited rotations beneath the create form. Each item shows the rotation name, its cadence, and who is up next with the date. The user clicks a recent rotation and is taken directly to its dashboard.

**Why this priority**: This is the primary value of the landing page redesign for users who already have rotations. It removes the step of navigating by URL or memorizing slugs, making the app feel like a product rather than a utility.

**Independent Test**: Can be fully tested by visiting the landing page after having previously visited one or more rotation dashboards. Delivers direct navigation to a known rotation.

**Acceptance Scenarios**:

1. **Given** a user has successfully navigated to at least one rotation dashboard in a previous session, **When** they open the landing page, **Then** a "Pick up where you left off" section appears beneath the create form listing that rotation with its name, cadence description, next member name, and next occurrence date.
2. **Given** up to 3 recent rotations are stored, **When** the user has visited more than 3 distinct rotations, **Then** only the 3 most recently visited appear, ordered most-recent first.
3. **Given** a recent rotation entry is shown, **When** the user clicks it, **Then** they are navigated to that rotation's dashboard.
4. **Given** no rotations have ever been visited, **When** the user opens the landing page, **Then** the "Pick up where you left off" section is not shown at all.

---

### User Story 2 — New user creates a rotation on the redesigned landing page (Priority: P1)

A new user lands on the redesigned page, reads the headline, and fills in the rotation name and cadence fields in the create-form card. They click "Create rotation" and are taken to the new dashboard.

**Why this priority**: Rotation creation is the primary action on the landing page; the redesign must not regress this flow.

**Independent Test**: Can be fully tested end-to-end by creating a rotation from scratch on the landing page and verifying arrival at the dashboard.

**Acceptance Scenarios**:

1. **Given** a user is on the landing page, **When** they type a rotation name and select a cadence, **Then** the "Create rotation" button becomes actionable and submits the form.
2. **Given** a rotation is created successfully, **When** the user is navigated to the rotation dashboard, **Then** the new rotation is recorded as the most recently visited entry in the browser's local storage.
3. **Given** the page loads, **When** the create form is rendered, **Then** the name input is visually prominent (large text size, full-width, with an icon prefix), and cadence selectors appear in a row below it.

---

### User Story 3 — User views the rotation dashboard with the redesigned two-column layout (Priority: P1)

A user navigates to a rotation's dashboard and sees the redesigned two-column layout. The left column shows a large gradient "Up next" hero card prominently displaying the next person's name, their date, and quick actions (Mark done / Skip). Below that is the member queue. The right column shows a vertical schedule timeline.

**Why this priority**: The dashboard redesign is a core deliverable and the most visible change for existing users.

**Independent Test**: Can be tested by navigating to any existing rotation with at least one member and an active schedule.

**Acceptance Scenarios**:

1. **Given** a rotation has a schedule and at least one member, **When** the dashboard loads, **Then** the "Up next" hero card shows the next person's name at large display size, their date, and both "Mark done" and "Skip" action buttons.
2. **Given** the dashboard loads, **When** the user views the right column, **Then** a vertical timeline lists schedule occurrences from the previous occurrence through the next several upcoming ones, each row showing date, member avatar, and member name.
3. **Given** the dashboard loads, **When** the left column renders, **Then** the member queue is shown as a list of avatar + name rows with drag handles and remove buttons, plus an "Add member" button at the bottom.
4. **Given** a rotation has no schedule configured, **When** the dashboard loads, **Then** the schedule timeline is not shown and an appropriate empty-state message is displayed in its place.

---

### User Story 4 — User sees previous occurrence and expanded future occurrences in the schedule timeline (Priority: P2)

On the rotation dashboard, the schedule timeline always includes the immediately preceding occurrence (greyed/muted) above the current/next entry, and shows significantly more upcoming occurrences than the prior design — enough to give meaningful look-ahead without excessive scrolling.

**Why this priority**: The user identified limited look-ahead as the one pain point with the current details view. Always showing the previous occurrence provides temporal context ("when was the last one?") without adding bulk.

**Independent Test**: Can be tested independently by viewing the schedule timeline on any rotation with an active recurring schedule, confirmed by counting the visible rows.

**Acceptance Scenarios**:

1. **Given** a rotation has past occurrences, **When** the schedule timeline renders, **Then** exactly one previous occurrence is always shown at the top of the timeline, visually distinct from upcoming entries (muted date and name).
2. **Given** a rotation has upcoming occurrences, **When** the timeline renders, **Then** at least 8 future occurrences are shown (up from the prior design's 3–4).
3. **Given** a rotation has fewer past occurrences than 1 (brand new rotation), **When** the timeline renders, **Then** the timeline begins at the current/next occurrence with no preceding row.

---

### User Story 5 — User uses the pill-shaped app bar on both pages (Priority: P2)

Both the landing page and the rotation dashboard display a pill-shaped app bar at the top. On the landing page it shows the app logo, name, and rotation count. On the dashboard it shows a back link ("← Rotations"), the rotation name, a cadence chip, a Share button, and a Settings icon button.

**Why this priority**: Consistent navigation chrome is a prerequisite for coherent UX across both pages.

**Independent Test**: Can be tested visually by loading each page and inspecting the top bar.

**Acceptance Scenarios**:

1. **Given** any page loads, **When** the app bar renders, **Then** it uses a pill/capsule shape (fully rounded borders) floating above the content with a 1px border and subtle shadow, on a surface-colored background.
2. **Given** the user is on the landing page, **When** the app bar renders, **Then** it shows the app logo, "Who's Next" name, a separator, and the count of rotations the user currently has stored in local storage.
3. **Given** the user is on the rotation dashboard, **When** the app bar renders, **Then** it shows a "← Rotations" back link, a separator, the rotation name, and its cadence chip, along with Share and Settings buttons on the right.
4. **Given** the user clicks "← Rotations" on the dashboard, **When** the navigation executes, **Then** the user is taken back to the landing page.

---

### Edge Cases

- What happens when local storage is unavailable (e.g., private browsing, storage quota exceeded)? The "Pick up where you left off" section is simply not shown; the create form works normally.
- What happens when a stored recent rotation no longer exists (deleted on the server)? The entry links to the dashboard; if the dashboard load fails (404), the rotation page handles the error as it already does. Stale entries are not pre-validated from the landing page.
- What happens when a rotation has no members and no schedule? The "Up next" hero card and the schedule timeline show appropriate empty states; the queue section shows the "Add member" prompt.
- What happens when the device screen is too narrow for the two-column layout? Below 960px, a single-column stacked layout is used. Dashboard order: hero card → queue → timeline. Landing order: create form → recent rotations → tips.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Landing Page

- **FR-001**: The global app shell MUST be stripped of any existing top-level toolbar/header. Each page renders its own pill-shaped app bar as an in-page element. The landing page pill bar MUST contain: the app logo, the "Who's Next" name, a separator, and the count of distinct rotation slugs currently recorded in the browser's local storage.
- **FR-002**: The landing page MUST display a prominent create-rotation card as the primary content area, containing: a large name input field with an icon prefix and placeholder text ("Fish duty, on-call, snack run…"); a cadence selector row with a toggle for "Cadence" / "Manual" scheduling modes; a "Repeats" dropdown (Daily, Weekly, Bi-weekly, Monthly); a "Day" dropdown for day-of-week when weekly cadence is selected; a "Set a custom start date" checkbox; and a "Create rotation" primary action button with a trailing arrow icon.
- **FR-003**: The create card MUST include a decorative radial-gradient accent element in the top-right corner, a "New rotation" chip with a sparkle icon above the headline, a headline ("What are we tracking?"), and a subheading ("Give it a name, set how often it repeats. We'll deal with the dates.").
- **FR-004**: The landing page MUST display a "Pick up where you left off" secondary card below (or beside) the create card when at least one recent rotation is stored in local storage. The card MUST list up to 3 recent rotations, each showing: rotation name (bold), cadence description, next member name, and next occurrence date. Each row MUST be a navigable link to the rotation dashboard. A trailing chevron icon MUST appear on the right of each row.
- **FR-005**: When no recent rotations are stored, the "Pick up where you left off" card MUST NOT be rendered.
- **FR-006**: The landing page MUST display a "Tips" tertiary card in the accent-tinted background color, with numbered tips (01, 02, 03) about how to use the app: member ordering, skipping turns from the menu, and sharing rotations.
- **FR-007**: The landing page MUST use a two-column grid layout (wider left, narrower right) at desktop width, with the create form card spanning both columns. The "Pick up where you left off" card and the "Tips" card occupy the left and right cells of the second row respectively.
- **FR-008**: On successful rotation creation, the system MUST store the new rotation as the most recent entry in local storage before navigating to the dashboard.

#### Recent Rotation Local Storage

- **FR-009**: When a user successfully navigates to a rotation dashboard (either by creating a new rotation or by visiting an existing one), the system MUST write a recent-rotation record to the browser's local storage under a single well-known key.
- **FR-010**: Each recent-rotation record MUST contain: the rotation slug (unique identifier used for navigation), the rotation name (display label), a human-readable cadence description (e.g., "Weekly · Mon"), the next member's display name, and the next occurrence date formatted for display (e.g., "27 Apr" or "today").
- **FR-011**: The recent-rotation store MUST hold at most 3 entries. When a 4th entry is added, the oldest entry MUST be evicted. Visiting an already-stored rotation MUST update it to the most-recent position rather than duplicating it.
- **FR-012**: The recent-rotation store MUST be updated with fresh data from the rotation's API response each time a rotation dashboard is successfully loaded.
- **FR-013**: If the browser's local storage is unavailable or throws when accessed, the system MUST silently fail: the "Pick up where you left off" section is not shown and rotation creation/navigation proceeds normally.

#### Dashboard / Details Page

- **FR-014**: The rotation dashboard MUST display a pill-shaped top app bar containing: a "← Rotations" back-navigation link; a vertical separator; the rotation name in bold display font; a cadence chip (e.g., "WEEKLY · MON"); and on the right: a "Share" ghost button with a share icon and a Settings icon ghost button.
- **FR-015**: The rotation dashboard MUST use a two-column grid layout at desktop width, with the left column slightly wider (approx. 51%) and the right column taking the remainder.
- **FR-016**: The left column MUST contain, in order from top to bottom: (a) the "Up next" hero card, and (b) the member queue card.
- **FR-017**: The "Up next" hero card MUST render with a vertical gradient from primary to primary-dark as its background, white text, and a decorative radial highlight in the top-right corner. It MUST display: an all-caps label "Up next · in N days" (where N is derived from the time until the next occurrence); the next member's name at large display size (approx. 44px equivalent); the formatted next date and a preview of the member after that ("then [Name] on [Date]"); and a single "Skip" semi-transparent action button. The "Mark done" button is omitted — done-tracking is automatic and a dedicated API is out of scope for this feature.
- **FR-018**: The member queue card MUST display: a "Queue" heading, a "Drag to reorder" hint, a list of all current members each shown as a drag-handle icon + color avatar + name + next-turn date + remove button row, and an "Add member" ghost button at the bottom.
- **FR-019**: The right column MUST contain a "Schedule" card with a vertical timeline showing: exactly one previous occurrence (if any) at the top, visually muted; then the current/next occurrence highlighted with an accent-colored dot; then upcoming occurrences up to a configurable count; each row showing date (monospace), member color avatar, member name, and a "more options" (⋯) button.
- **FR-020**: The vertical timeline MUST render a continuous vertical line connecting all occurrence dots, with the current/next dot styled with an accent fill and accent-tinted ring, and all other dots styled with a surface fill and a neutral border.
- **FR-021**: The schedule timeline MUST show at minimum 8 future occurrences beyond the current/next one when enough future dates exist, to provide meaningful look-ahead. The frontend MUST request this window by passing `?past=1&future=8` query parameters to the occurrence window endpoint.
- **FR-022**: The schedule timeline MUST always include exactly one previous occurrence at the top when the rotation has any past occurrences, displayed in a muted/secondary style (muted text color, neutral dot). This past occurrence is returned by the backend when `past=1` is passed.
- **FR-023**: When a rotation has no configured schedule, the right-column schedule card MUST display a clear empty-state message and not render the timeline.
- **FR-024**: Below 960px viewport width, the two-column layout on both pages MUST collapse to a single column.
- **FR-025**: While the dashboard page is loading its initial data (rotation name, schedule, members), the page MUST display skeleton placeholder cards at the same positions and approximate dimensions as the real content — one skeleton in the left column (covering the hero card and queue card area) and one skeleton in the right column (covering the schedule card area). A shimmer animation MUST be applied to the skeleton surfaces. No text content or spinner is shown during this loading state. On the dashboard the stacking order MUST be: "Up next" hero card → member queue → schedule timeline. On the landing page: create form card → "Pick up where you left off" card → Tips card.

### Key Entities

- **Recent Rotation Record**: A browser-side record of a recently visited rotation. Contains: `slug` (string, URL identifier), `name` (string, display label), `cadence` (string, human-readable cadence description), `nextMember` (string, name of the next person in the rotation), `nextDate` (string, human-readable formatted date of the next occurrence). Up to 3 records are stored, ordered most-recent-first.
- **Recent Rotation Store**: The collection of up to 3 recent rotation records, persisted in browser local storage under a single key. Managed as a list with eviction of the oldest entry when at capacity.
- **Up Next Hero Card**: The prominent accent-gradient card on the dashboard left column that surfaces the single most important piece of information — who is up next and when — along with quick actions.
- **Schedule Timeline**: The vertical list of past (1), current, and future occurrences rendered as a connected dot-and-row timeline in the dashboard right column.

---

## Visual Design Specification *(mandatory)*

This section documents exact design tokens and layout rules from the v3 designs that the implementation MUST match. These are requirements, not suggestions.

### M3 Theme Setup

The app uses Angular Material's M3 color system. The existing M3 theme MUST be updated to:

1. **Seed color**: The primary palette MUST be generated from the design's purple seed (`#7b3eee`). This produces the correct tonal palette across all M3 color roles in both light and dark modes.

2. **Light and dark themes**: Both a light scheme and a dark scheme MUST be defined. The dark scheme MUST be activated via `prefers-color-scheme: dark` media query (system-default) and optionally via a `.dark` host class for manual override. All M3 system variables (`--mat-sys-*`) MUST reflect the correct tonal values for the active scheme automatically.

3. **Typography**: The M3 theme MUST define Inter as the plain/body typeface and Inter Tight as the brand/display typeface. JetBrains Mono is used for date and label elements — loaded separately, not wired into M3 typography roles.

4. **System variables**: The theme MUST use M3 system variable emission (`use-system-variables: true`) so that `--mat-sys-primary`, `--mat-sys-surface`, etc. are available as CSS custom properties for use in component styles.

### M3 Color Role Mapping

The design's custom tokens map to M3 semantic roles as follows. All component styles MUST use these M3 tokens rather than hardcoded hex values, ensuring dark-mode correctness for free.

| Design intent | Design token (reference only) | M3 system token |
|---------------|-------------------------------|-----------------|
| Primary accent (buttons, active dot, hero gradient top) | `--accent-500` `#7b3eee` | `--mat-sys-primary` |
| Text/icon on primary-colored surfaces | `--accent-on` `#ffffff` | `--mat-sys-on-primary` |
| Light primary tint (chip bg, focus ring, corner gradient, dot ring) | `--accent-100` `#ede2ff` | `--mat-sys-primary-container` |
| Text on primary-container bg (chip text, tips title, label) | `--accent-ink` `#2a0a5a` | `--mat-sys-on-primary-container` |
| Darker primary (hero gradient bottom, "Mark done" text, active date text) | `--accent-700` `#4f17a8` | `color-mix(in srgb, var(--mat-sys-primary) 70%, black 30%)` — defined as a single custom property `--color-primary-dark` derived at theme setup time |
| Medium primary (upcoming date text, "Up next" sub-label) | `--accent-600` `#6422d4` | `--mat-sys-primary` at 85% opacity, or `--color-primary-dark` at 60% blend — whichever achieves AA contrast on surface |
| Tips card background (very light primary tint) | `--accent-50` `#f6f1ff` | `color-mix(in srgb, var(--mat-sys-primary-container) 50%, var(--mat-sys-surface))` — defined as `--color-primary-subtle` |
| Page background | `--surface-2` `#f5f3f8` | `--mat-sys-surface-container-low` |
| Card / app bar surface | `--surface` `#ffffff` | `--mat-sys-surface` |
| Input field bg / row hover bg | `--surface-2` `#f5f3f8` | `--mat-sys-surface-container-low` |
| Timeline vertical line / past dot fill | `--surface-3` `#ebe8f0` | `--mat-sys-surface-container-high` |
| Card borders / app bar border / dividers | `--line` `#e3deea` | `--mat-sys-outline-variant` |
| Past/future timeline dot border | `--line-2` `#d4cee0` | `--mat-sys-outline-variant` |
| Primary text | `--ink` `#14101c` | `--mat-sys-on-surface` |
| Secondary text / section labels | `--ink-2` `#4a4458` | `--mat-sys-on-surface-variant` |
| Tertiary text / muted icons / hints | `--ink-3` `#79738a` | `--mat-sys-outline` |
| Very muted icons (drag handle, remove) | `--ink-4` `#a39db1` | `--mat-sys-outline-variant` |

> **Note on derived tokens**: `--color-primary-dark` and `--color-primary-subtle` are two custom CSS properties that MUST be set once in the global theme scope using `color-mix()` from `--mat-sys-primary` and `--mat-sys-primary-container` respectively. They are NOT hardcoded hex values — they derive from M3 system tokens so they remain correct in dark mode.

### Typography

| Role | Family | Weight | Size | Letter-spacing |
|------|--------|--------|------|----------------|
| App name / headings | Inter Tight | 700 | 16–32px | −0.01em to −0.02em |
| Section labels | Inter Tight | 600 | 14px | +0.08em, uppercase |
| Body text | Inter | 400–500 | 13–15px | default |
| Mono (dates, tips numbers) | JetBrains Mono | 400–500 | 11–12px | +0.04em |
| Hero name | Inter Tight | 700 | 44px | −0.02em |
| Create form name input | Inter Tight | 600 | 22px | −0.01em |

### Border Radii

| Token | Value | Used on |
|-------|-------|---------|
| `--radius-sm` | 8px | Minor elements |
| `--radius` | 12px | Input fields; cadence pill rows |
| `--radius-lg` | 18px | Most cards (queue, schedule, secondary cards) |
| `--radius-xl` | 24px | Create form card; Up Next hero card |
| Pill/999px | 999px | App bar; buttons; toggle groups; chips |

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-1` | `0 1px 2px rgba(20,16,28,0.06), 0 1px 3px rgba(20,16,28,0.04)` |
| `--shadow-2` | `0 2px 6px rgba(20,16,28,0.06), 0 8px 24px rgba(20,16,28,0.05)` |

App bar and create form card use `--shadow-1`. Cards use border only (no shadow unless elevated).

### Layout — Landing Page

```
┌──────────────────────────────────────────────────┐
│ App bar (pill, 100% width, margin-bottom: 32px)  │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│ Create form card   [grid-column: 1 / -1]         │
│ padding: 32px · border-radius: 24px              │
│ Accent corner gradient (right: -120, top: -120,  │
│   320×320, radial accent-100→transparent)        │
│                                                  │
│  ✦ New rotation  [chip]                          │
│  What are we tracking?  [h1, 32px]               │
│  Give it a name…        [p, 15px, ink-2]         │
│                                                  │
│  [👥 _name input, 22px Inter Tight_____________] │
│  [Cadence|Manual]  [Repeats ▾]  [Day ▾]          │
│  ☐ Set a custom start date    [Create rotation →]│
└──────────────────────────────────────────────────┘
┌──────────────────────┐ ┌────────────────────────┐
│ Pick up where you    │ │ Tips                   │
│ left off             │ │ (accent-50 bg,         │
│                      │ │  accent-100 border)    │
│ [row] Fish duty      │ │                        │
│ [row] Standup host   │ │ 01  Members rotate…    │
│ [row] Snack run      │ │ 02  Skip a turn…       │
│               padding│ │ 03  Share a rotation…  │
│ 22px · radius-lg     │ │                padding │
│                      │ │ 22px · radius-lg       │
└──────────────────────┘ └────────────────────────┘
```

Grid: `gridTemplateColumns: "1.4fr 1fr"`, `gap: 20px`. Max-width: 1080px, centered.

App bar internal layout: `display: flex; justify-content: space-between; padding: 10px 16px 10px 14px`.

### Layout — Dashboard / Details Page

```
┌────────────────────────────────────────────────────┐
│ App bar (pill)                                     │
│ [← Rotations | Fish duty  WEEKLY·MON]  [Share][⚙] │
└────────────────────────────────────────────────────┘
┌─────────────────────────────┐ ┌──────────────────┐
│ Up next hero card           │ │ Schedule card    │
│ gradient(accent-500→700)    │ │ padding: 20px    │
│ border-radius: 24px         │ │ radius-lg        │
│ min-height: 220px           │ │                  │
│                             │ │ Schedule  Next N │
│ UP NEXT · IN 2 DAYS         │ │ turns            │
│ Alicia          [44px bold] │ │                  │
│ Mon, 27 Apr · then Bobus…   │ │ ●─ 20 Apr  Devra │
│                             │ │ ◉─ 27 Apr  Alicia│
│ [✓ Mark done] [⏭ Skip]     │ │ ○─  4 May  Bobus │
└─────────────────────────────┘ │ ○─ 11 May  Carol │
┌─────────────────────────────┐ │ ○─ 18 May  Devra │
│ Queue card                  │ │ … (8+ future)    │
│ padding: 20px · radius-lg   │ │                  │
│                             │ └──────────────────┘
│ Queue          Drag to reorder                   │
│ ⠿  [A]  Alicia      27 Apr  ✕                   │
│ ⠿  [B]  Bobus        +1w    ✕                   │
│ ⠿  [C]  Carolus      +2w    ✕                   │
│ ⠿  [D]  Devra        +3w    ✕                   │
│          [+ Add member]                          │
└─────────────────────────────────────────────────┘
```

Grid: `gridTemplateColumns: "1.05fr 1fr"`, `gap: 16px`. Max-width: 1080px, centered. Right column spans both rows of the left column.

### Component Details

#### App Bar (both pages)
- Background: `--mat-sys-surface`
- Border: `1px solid var(--mat-sys-outline-variant)`
- Border-radius: 999px (pill)
- Padding: `10px 16px 10px 14px`
- Shadow: `--shadow-1`
- Margin-bottom: 20px (dashboard) / 32px (landing)
- Logo: SVG, 26px
- App name: Inter Tight 700, 16px, `--mat-sys-on-surface`
- Separator: 1×16px, `--mat-sys-outline-variant` color, margin 0 8px
- Rotation count (landing only): 13px, `--mat-sys-outline`

#### Create Form Card
- Background: `--mat-sys-surface`
- Border-radius: 24px
- Border: `1px solid var(--mat-sys-outline-variant)`
- Padding: 32px
- Shadow: `--shadow-1`
- Overflow: hidden (for accent corner)
- Accent corner: `position: absolute; right: -120px; top: -120px; width: 320px; height: 320px; background: radial-gradient(circle, var(--mat-sys-primary-container), transparent 70%); pointer-events: none; aria-hidden`
- "New rotation" chip: `--mat-sys-primary-container` bg, `--mat-sys-on-primary-container` color, sparkle icon 12px, pill shape, margin-bottom 14px
- Headline: Inter Tight 700 32px, `−0.02em` tracking, `--mat-sys-on-surface`, margin 10px 0 6px
- Subheading: 15px, `--mat-sys-on-surface-variant`, margin 0 0 28px, max-width 520px
- Name input container: padding 14px 18px, `--mat-sys-surface-container-low` bg, radius 16px, border `1px solid transparent`, users icon 20px `--mat-sys-outline`
- Name input: Inter Tight 600, 22px, `−0.01em` tracking, no border, transparent bg, `--mat-sys-on-surface`
- Cadence row: `grid-template-columns: auto 1fr 1fr; gap: 8px`
- ToggleGroup: `--mat-sys-surface-container-low` bg, pill container, 4px padding, 2px gap. Active option: `--mat-sys-surface` bg + `--shadow-1`, `--mat-sys-on-surface`. Inactive: transparent, `--mat-sys-outline`.
- PillSelect: `--mat-sys-surface-container-low` bg, radius 12px, padding 8px 14px. Label: 11px uppercase 600 `+0.04em` `--mat-sys-outline`. Select: 14px 500 `--mat-sys-on-surface`.
- Bottom row: flex space-between, margin-top 6px. Checkbox label: 13px `--mat-sys-on-surface-variant`, `--mat-sys-primary` accent-color. Submit button: primary filled pill style, padding 12px 22px.

#### "Pick up where you left off" Card
- Background: `--mat-sys-surface`
- Border: `1px solid var(--mat-sys-outline-variant)`
- Border-radius: 18px
- Padding: 22px
- Title: Inter Tight 600 14px uppercase `+0.08em` tracking, `--mat-sys-on-surface-variant`, margin 0 0 14px
- Rows gap: 6px
- Each row: `display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 12px 14px; border-radius: 12px; background: --mat-sys-surface-container-low; text-decoration: none; color: inherit`
- Row name: 600 14px `--mat-sys-on-surface`
- Row meta: 12px `--mat-sys-outline` margin-top 2px — format: `{cadence} · next: {memberName} ({date})`
- Row trailing: chevron icon 16px `--mat-sys-outline`
- Hover state: `--mat-sys-surface-container` background (one step higher on the tonal scale)

#### Tips Card
- Background: `--color-primary-subtle` (= `color-mix(in srgb, var(--mat-sys-primary-container) 50%, var(--mat-sys-surface))`)
- Border: `1px solid var(--mat-sys-primary-container)`
- Border-radius: 18px
- Padding: 22px
- Title: Inter Tight 600 14px uppercase `+0.08em`, `--mat-sys-on-primary-container`, margin 0 0 14px
- List: no bullets, gap 12px
- Each item: flex row, gap 10px, 13px `--mat-sys-on-surface-variant`, line-height 1.5
- Number prefix: `--mat-sys-primary` color, JetBrains Mono 12px, flex-shrink 0 — values "01", "02", "03"
- Tip texts: "Members rotate in the order you add them — drag to reorder later.", "Skip a turn from the ⋯ menu on any upcoming card.", "Share a rotation with the copy icon next to its title."

#### Up Next Hero Card
- Background: `linear-gradient(180deg, var(--mat-sys-primary), var(--color-primary-dark))`
- Color: `--mat-sys-on-primary` (white in light mode, remains correct in dark mode)
- Border-radius: 24px
- Padding: 26px
- Min-height: 220px
- Display: flex column, justify-content space-between
- Overflow: hidden
- Decorative element: `position: absolute; right: -40px; top: -40px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(255,255,255,0.15), transparent 60%); pointer-events: none; aria-hidden`
- Label: 11px 600 `+0.16em` tracking, 0.85 opacity, uppercase — format: "UP NEXT · IN N DAYS"
- Hero name: Inter Tight 700 44px `−0.02em`, margin 8px 0 4px, line-height 1
- Date line: 14px, 0.9 opacity — format: "{Weekday}, {D} {Mon} · then {NextMember} on {D} {Mon}"
- "Mark done" button: `--mat-sys-on-primary` bg, `--color-primary-dark` text, no border, padding 10px 16px, pill, 600 13px, check icon 14px
- "Skip" button: `rgba(255,255,255,0.18)` bg, `--mat-sys-on-primary` text, `1px solid rgba(255,255,255,0.3)` border, padding 10px 16px, pill, 600 13px, skip icon 14px

#### Queue Card
- Background: `--mat-sys-surface`
- Border: `1px solid var(--mat-sys-outline-variant)`
- Border-radius: 18px
- Padding: 20px
- Header: flex space-between align baseline, margin-bottom 12px. Title: Inter Tight 600 16px `--mat-sys-on-surface`. Hint: 12px `--mat-sys-outline`
- Member rows: `grid-template-columns: auto auto 1fr auto auto; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--mat-sys-outline-variant)` (first row has no top border)
- Drag handle: dots icon 16px `--mat-sys-outline-variant`
- Avatar: 32px color-generated (oklch hue hash — see Assumptions)
- Name: 500 14px `--mat-sys-on-surface`
- Date: 12px — first member: `--mat-sys-primary` 600 showing actual next date; subsequent: `--mat-sys-outline` 400 showing "+Nw" offset
- Remove button: transparent bg, no border, `--mat-sys-outline-variant`, padding 4px, close icon 14px
- "Add member" button: outlined/ghost pill style, margin-top 14px, full width, justify-content center, padding 10px, plus icon 14px

#### Schedule Timeline Card
- Background: `--mat-sys-surface`
- Border: `1px solid var(--mat-sys-outline-variant)`
- Border-radius: 18px
- Padding: 20px
- Header: flex space-between align baseline, margin-bottom 16px. Title: Inter Tight 600 16px `--mat-sys-on-surface`. Count label: 12px `--mat-sys-outline` — e.g. "Next 9 turns"
- Timeline container: `position: relative; padding-left: 24px`
- Vertical line: `position: absolute; left: 11px; top: 6px; bottom: 6px; width: 2px; background: var(--mat-sys-surface-container-high)`
- Each row: flex align-center, gap 12px, padding 10px 0, position relative
- Dot: `position: absolute; left: -19px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; border-radius: 50%`
  - Current/next: `background: --mat-sys-primary; border: 3px solid var(--mat-sys-primary-container)`
  - Past (1 item): `background: --mat-sys-surface-container-high; border: 2px solid var(--mat-sys-outline-variant)`
  - Future: `background: --mat-sys-surface; border: 2px solid var(--mat-sys-outline-variant)`
- Date: width 64px, JetBrains Mono 12px — current: `--color-primary-dark` 600; past/future: `--mat-sys-outline` 400
- Avatar: 28px color-generated
- Name column: flex 1 — main text: current 600 14px `--mat-sys-on-surface`, others 500 14px `--mat-sys-on-surface`. Sub-label for current: 11px `--mat-sys-primary` 600 "Up next"
- More button: transparent bg, no border, `--mat-sys-outline` icon 14px, padding 4px

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning user with stored recent rotations can navigate from the landing page to any of those rotations in 1 click, without typing or remembering a URL.
- **SC-002**: Every color in the implemented pages is expressed via an M3 system token (`--mat-sys-*`) or a derived custom property (`--color-primary-dark`, `--color-primary-subtle`) — no hardcoded hex values appear in component styles. Both light and dark modes render correct contrast and tonal relationships.
- **SC-003**: The schedule timeline always displays 1 previous occurrence (when available) plus at least 8 future occurrences — verifiable by inspecting the rendered DOM row count.
- **SC-004**: After visiting any rotation dashboard, reloading the landing page shows that rotation in the "Pick up where you left off" section with accurate name, cadence, next member, and next date.
- **SC-005**: Both redesigned pages are WCAG 2.2 AA compliant — all interactive elements are keyboard-reachable, focus indicators are visible, and color contrast ratios meet AA minimums.
- **SC-006**: The two-column layout on both pages collapses gracefully to a single-column layout at the mobile breakpoint without any content overflow or horizontal scrolling.
- **SC-007**: When local storage is unavailable, the landing page still loads and the create-rotation form is fully functional; no JavaScript error is thrown.
- **SC-008**: While the dashboard is loading, skeleton placeholder cards with a shimmer animation are shown in both columns; no plain "Loading…" text or spinner appears at the page level.

---

## Assumptions

- **M3 theme**: The existing Angular Material M3 theme will be updated (not replaced) to use a purple seed color (`#7b3eee`) for palette generation. Both light and dark schemes are generated from the same seed. Theme switching to other accent colors (forest, slate, coral, etc.) is out of scope for this feature.
- **Derived CSS custom properties**: Two custom properties (`--color-primary-dark`, `--color-primary-subtle`) will be defined globally as `color-mix()` expressions against M3 system tokens. They must be redefined in both light and dark theme scopes so they remain correct in both modes.
- **Color-generated avatars**: Member avatars use a deterministic hue derived by hashing the member's name (the `oklch(0.62 0.13 {hue})` formula from the design). This is UI-only — no backend color storage.
- **Fonts**: Inter, Inter Tight, and JetBrains Mono are loaded via Google Fonts (or self-hosted equivalents). Plus Jakarta Sans used in the previous landing page is replaced by Inter Tight. The Angular Material typography configuration wires Inter Tight as the brand typeface and Inter as the plain typeface; JetBrains Mono is used directly via CSS where needed.
- **"Mark done"**: The button on the Up Next hero card maps to the existing cancel/done-tracking API. No new backend behavior is introduced.
- **"Skip"**: The button on the hero card maps to the existing skip/cancel-occurrence behavior, already implemented.
- **Schedule window API**: The occurrence window endpoint is extended with `past` and `future` integer query parameters (both optional, defaulting to the current behaviour when absent). The frontend passes `?past=1&future=8`. The backend MUST honour these parameters and return exactly that many occurrences on either side of the current/next occurrence (or fewer if the rotation doesn't have that many).
- **Rotation count on landing**: The count shown in the app bar is derived entirely from local storage (number of stored recent rotation entries, max 3) and requires no API call.
- **Cadence description in local storage**: The cadence string (e.g., "Weekly · Mon") is formatted from the rotation's schedule at load time and stored as a plain string. It is not re-fetched or re-derived on the landing page.
- **Page padding and max-width**: Both pages use `20px 28px` outer padding and a `1080px` max-width content grid, centered.
- **"Add member" flow**: The "Add member" button in the queue card expands the existing inline add-member form — it does not introduce a modal or drawer.
- **"Settings" button**: Opens the existing rotation settings section that already exists on the page, scrolling to it or expanding it.
- **"Share" button**: Copies the rotation URL to the clipboard (existing behavior).
- **Drag-to-reorder**: Uses the same CDK drag-and-drop mechanism already implemented in the queue component.
- **Global toolbar removed**: The existing app-level Material toolbar (currently imposing a 64px offset on page hosts) is removed entirely. Page host styles that reference the `64px` offset must be updated accordingly. Each page is solely responsible for its own top navigation chrome.
