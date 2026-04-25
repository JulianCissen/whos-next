# Feature Specification: Date-Bound Skip

**Feature Branch**: `20260423-211423-skip-behavior`  
**Created**: 2026-04-24  
**Status**: Draft  
**Input**: User description: "A date in a recurring schedule should be skippable (e.g. a public holiday where no one performs the task). This prevents any member from getting a free ride — the queue must not advance. Two skip modes (date-bound and member-bound) must have equal UX weight, and neither should be too prominent."

## Context

The member-bound skip (marking a specific member unavailable so the next member covers) was specified separately in `specs/20260423-211423-skip-behavior/spec.md`. This spec covers the complementary date-bound skip mode and the unified UX that presents both modes as peers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Skip an Entire Occurrence Date (Priority: P1)

A visitor is viewing an upcoming occurrence and realises the whole team will be unavailable that day (public holiday, office closure, team event). They want to cancel the task for that date without disadvantaging any team member. They mark the occurrence as a date skip. No one is assigned to cover; the member who would have been assigned is simply deferred to the next occurrence — their turn is not consumed.

**Why this priority**: This is the core new behaviour. Without it, a holiday silently gives the scheduled member a "free ride": the queue advances past them even though no work was done, which erodes fairness over time.

**Independent Test**: Can be fully tested by creating a rotation with members [A, B, C], skipping the next occurrence (currently A's turn) as a date skip, and verifying that A is still assigned to the immediately following occurrence rather than B.

**Acceptance Scenarios**:

1. **Given** a rotation with members [A, B, C] where A is assigned to occurrence O, **When** a visitor applies a date skip to O, **Then** O is marked as cancelled, no cover member is shown, A is still displayed as the would-have-been assignee, and the next occurrence after O still shows A as the assignee.
2. **Given** the scenario above, **When** the date skip is applied, **Then** B's and C's queue positions are also unchanged — the entire queue is frozen for that date.
3. **Given** a cancelled occurrence viewed after the date has passed, **When** a visitor opens it, **Then** the "Cancelled" status remains visible with the original would-have-been assignee shown.
4. **Given** an occurrence that already has a member-bound skip applied, **When** a visitor attempts to apply a date skip, **Then** the system prevents the action and explains that a skip has already been recorded for this occurrence.

---

### User Story 2 — Balanced Skip Mode Selection (Priority: P2)

A visitor wants to skip an occurrence but needs to choose between skipping the date entirely (no one performs) or marking the specific member unavailable (next member covers). Both options are presented on the occurrence card with equal visual weight — neither dominates. The visitor can make an informed choice without the UI steering them toward one option.

**Why this priority**: The original member-bound skip UI was identified as too visually prominent. Introducing a second skip mode is the right moment to redesign the skip entry point so both modes are discoverable and balanced, preventing one mode from becoming the default by accident of layout.

**Independent Test**: Can be fully tested by opening an occurrence card and confirming both skip actions are visually equivalent — same size, same emphasis — and that neither is the obvious "primary" action. No functional dependency on P1 beyond the existence of both skip modes.

**Acceptance Scenarios**:

1. **Given** an occurrence with no skip applied, **When** a visitor views the occurrence card, **Then** a single "Skip" trigger is visible; when activated, it expands inline to reveal both the date-skip and member-skip options with equal visual prominence — same hierarchy, same weight.
2. **Given** the two skip actions are visible, **When** a visitor selects the date-skip action, **Then** the date-bound skip flow is initiated (occurrence cancelled, queue not advanced).
3. **Given** the two skip actions are visible, **When** a visitor selects the member-skip action, **Then** the member-bound skip flow is initiated (next member covers, queue unchanged as per the existing spec).
4. **Given** an occurrence that already has either skip type applied, **When** a visitor views the card, **Then** neither skip action is accessible — the card shows only the recorded skip state.

---

### Edge Cases

- What happens when both skip types are attempted on the same occurrence? The second attempt must be blocked; whichever skip is recorded first is the authoritative record.
- What happens when a date skip is applied to a past occurrence? It must be allowed (historical record-keeping), consistent with how member-bound skips handle past occurrences.
- What is shown as the "would-have-been assignee" on a cancelled occurrence if the queue has changed since the skip was recorded? The assignee at the time of the skip must be stored and displayed — not recalculated dynamically.
- What happens when the date-skip action fails (network error, server rejection)? The expanded skip panel remains open and displays an inline error message; the visitor can retry without re-opening the trigger.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Any visitor MUST be able to apply a date-bound skip to any occurrence, marking it as cancelled with no cover member assigned.
- **FR-002**: When a date-bound skip is applied, the member who would have been assigned MUST retain their queue position — the queue MUST NOT advance for that occurrence.
- **FR-003**: A cancelled occurrence MUST display the would-have-been assignee alongside a "Cancelled" label, so the record remains interpretable after the fact.
- **FR-004**: Once a date-bound skip is applied to an occurrence, it MUST be immutable — no further skip (of either type) can be applied to that occurrence.
- **FR-005**: An occurrence that already has a member-bound skip applied MUST NOT accept a date-bound skip, and vice versa — one occurrence, one skip record.
- **FR-006**: The would-have-been assignee captured in a date skip record MUST be the member scheduled at the moment the skip is applied, not recalculated later.
- **FR-007**: Both skip modes (date-bound and member-bound) MUST be presented as peer actions with equal visual weight — neither may be styled as a primary action relative to the other.
- **FR-008**: The two skip modes MUST be revealed via a single "Skip" trigger on the occurrence card that expands inline; no modal or separate page is used.
- **FR-009**: Skip actions MUST NOT be accessible on an occurrence that already has any skip applied.

### Key Entities

- **Date Skip Record**: Attached to a cancelled occurrence (user-facing label: "Cancelled"). Stores the would-have-been assignee for display purposes. Contains no cover member. Immutable once created.
- **Occurrence**: Can hold at most one skip record — either a date skip or a member skip, never both. The skip type determines how the occurrence is displayed and how the queue is interpreted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can apply a date skip in a single interaction without navigating away from the occurrence view.
- **SC-002**: After a date skip, the next occurrence shows the same member who would have been assigned to the skipped date — verifiable by comparing the pre-skip and post-skip queue order.
- **SC-003**: Cancelled occurrences (date-bound skip applied) are visually distinguishable from member-skipped occurrences and from normal unskipped occurrences, such that a first-time visitor can interpret the record without additional explanation.
- **SC-004**: In a side-by-side visual review, the date-skip and member-skip actions on the occurrence card are judged as equal in prominence — neither is mistaken for the primary action.
- **SC-005**: Zero queue advancement errors occur across a representative test set of date-skip scenarios, including skips of the first member, last member, and a mid-queue member.
- **SC-006**: All date-skip UI elements and copy are fully translated in English and Dutch, with no untranslated strings visible to the visitor.
- **SC-007**: The date-skip interaction and all associated UI states meet WCAG 2.2 AA criteria — verifiable via automated accessibility audit and manual keyboard-navigation test.

## Clarifications

### Session 2026-04-24

- Q: Does this spec inherit WCAG 2.2 AA accessibility and i18n (EN + NL) requirements from the member-bound skip? → A: Yes — WCAG 2.2 AA + i18n (EN + NL), same requirements as the member-bound skip.
- Q: How are both skip modes surfaced on the occurrence card? → A: A single "Skip" trigger that expands inline to reveal both options — no modal, no permanent dual buttons.
- Q: What does the card show when a date-skip action fails? → A: An inline error message within the expanded skip panel; the panel stays open so the visitor can retry without re-opening.
- Q: Can multiple occurrences be date-skipped at once (e.g., a holiday week)? → A: No — one occurrence at a time only; batch skipping is out of scope.
- Q: What is the canonical user-facing label for an occurrence that has had a date-bound skip applied? → A: "Cancelled" — distinct from the member-bound skip state; shown on the occurrence card after the skip is applied.

## Assumptions

- Any visitor with the rotation link can apply a date skip, consistent with the product's no-account, full-access model.
- Date-skipped occurrences remain visible in the occurrence view and are not hidden or removed from the list.
- The would-have-been assignee is deterministic from the queue at the moment the skip is applied and is stored, not recomputed.
- The UX redesign of the skip entry point (equal-weight actions) applies to the existing occurrence card component — no new modal or separate page is introduced.
- Past occurrences (already elapsed) can receive a date skip for historical accuracy, consistent with the member-bound skip behaviour.
- Undoing or reversing a date skip is out of scope — all skip records are immutable once applied.
- Batch skipping (skipping multiple occurrences at once) is out of scope — each occurrence must be skipped individually.
