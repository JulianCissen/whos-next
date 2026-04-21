# Feature Specification: Rotation Lifecycle (Create, Rename, Delete)

**Feature Branch**: `001-rotation-feature-creation`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "A rotation is the top-level entity of the app. Create the rotation feature: a user can create a rotation by giving it a name. On creation, an 8-character base-58 cryptographically random slug is generated and returned as the shareable URL — this slug is the sole identifier for the rotation. No account is required. Anyone with the URL has full access to view and manage the rotation. The rotation name can be edited at any time. A rotation can be permanently deleted (irreversible action, requires confirmation)."

## Clarifications

### Session 2026-04-18

- Q: What safeguard mechanism must the delete confirmation use, given the no-ownership model (any link-holder can delete)? → A: Typed confirmation — the visitor must type the rotation's exact current name into a confirmation field before the confirm button becomes enabled.
- Q: Are slug lookups case-sensitive? → A: Strictly case-sensitive. A slug with the wrong case resolves to "rotation not found", the same as any other unknown or malformed slug. Full ~47 bits of entropy preserved.
- Q: Where does the creator land after successful creation? → A: Redirected to the rotation page. The shareable link is surfaced via a prominent in-page banner (or inline control) with a copy button on first view; the banner is dismissable and is not shown on subsequent visits.
- Q: What event triggers an update to a rotation's last-access timestamp? → A: Any read or write of the rotation, throttled to at most one update per rotation per 24-hour window.
- Q: After successful deletion, where does the visitor land? → A: The application's landing / create-rotation screen, with a transient toast/snackbar confirming "Rotation '<name>' was deleted."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a rotation and receive a shareable link (Priority: P1)

Someone arrives at the application wanting to coordinate a recurring responsibility across a group. They provide a name for the rotation and, on confirmation, the app creates the rotation and gives them a unique shareable link that points to it. They can immediately share that link with the group. The link is the only thing anyone needs to reach and manage the rotation — there is no sign-up, no login, and no additional setup required.

**Why this priority**: This is the entry point to the entire product. Without it, no other rotation feature can be exercised. The ability to create a rotation and share a link is the minimum viable slice that demonstrates the "zero onboarding friction" business goal and unlocks every downstream capability (queue management, schedules, occurrences).

**Independent Test**: A visitor with no prior state visits the application, submits a valid rotation name, and receives a shareable link. Opening the link (in the same or a different browser session) loads the rotation with the expected name. This can be fully demonstrated end-to-end with only the create and view capabilities present.

**Acceptance Scenarios**:

1. **Given** a visitor on the application with no existing rotation, **When** they submit a valid rotation name ("Dish duty"), **Then** the rotation is created, a unique shareable link is generated, and the visitor is navigated directly to the rotation page. A prominent in-page banner on that first view surfaces the shareable link alongside a copy-to-clipboard affordance and a dismiss control.
2. **Given** a visitor has just created a rotation and received its link, **When** they open the link in any browser session, **Then** the rotation page loads showing the exact name they entered. The share-link banner from first view is NOT shown on subsequent visits.
3. **Given** a visitor submits an empty rotation name, **When** they attempt to create the rotation, **Then** creation is rejected with a clear validation message and no rotation is persisted.
4. **Given** a visitor submits a rotation name longer than the permitted maximum length, **When** they attempt to create the rotation, **Then** creation is rejected with a clear validation message and no rotation is persisted.
5. **Given** two visitors create rotations with the same name independently, **When** both creations complete, **Then** each rotation is reachable by its own distinct link and neither interferes with the other.

---

### User Story 2 - Access a rotation via its shareable link (Priority: P1)

Anyone who receives the shareable link — the creator returning later, a group member opening the link for the first time, or a teammate forwarded the link — can open that URL and immediately view and manage the rotation. No account, login, or permission grant is required. The link itself is the access credential.

**Why this priority**: The "link is the sole identifier" and "no account required" model is a core product decision. Without link-based access, creating a rotation has no practical value. This story validates that the slug truly functions as both identifier and access token.

**Independent Test**: A visitor who did not create the rotation opens its shareable link in a clean browser session and successfully loads the rotation page showing its current name. A visitor who opens a link pointing to a rotation that does not exist sees a clear "not found" response rather than a generic error.

**Acceptance Scenarios**:

1. **Given** a valid shareable link for an existing rotation, **When** any visitor opens the link in any browser (with no cookies or prior session), **Then** the rotation loads and the visitor can perform all management actions on it.
2. **Given** a shareable link for a rotation that has been deleted or never existed, **When** a visitor opens it, **Then** the application responds with a clear "rotation not found" state rather than creating a new rotation or leaking unrelated rotations.
3. **Given** a shareable link with a malformed slug (wrong length, invalid characters), **When** a visitor opens it, **Then** the application treats it as "not found" and does not perform a database lookup that could be abused for enumeration.

---

### User Story 3 - Rename an existing rotation (Priority: P2)

A visitor viewing a rotation realises the name is no longer appropriate (the team renamed the responsibility, a typo needs fixing, the rotation's purpose evolved). They change the name in-place. The shareable link does not change — only the displayed name. The next visitor to open the link sees the updated name.

**Why this priority**: Rotations are long-lived and their purpose can shift. Without a rename capability, a mismatch between name and purpose forces users to delete and recreate — which breaks the shared link and forces redistribution. This is a meaningful quality-of-life feature but is not required to demonstrate the core "create and share" flow.

**Independent Test**: With a rotation already created, a visitor edits the rotation name, submits the change, and the new name is visible on the rotation page. Reloading the page, or opening the link in a different browser, also shows the new name. The link itself remains unchanged.

**Acceptance Scenarios**:

1. **Given** a visitor on an existing rotation page, **When** they submit a new valid name, **Then** the rotation's displayed name updates immediately and the change persists across reloads.
2. **Given** a visitor on an existing rotation page, **When** they submit an empty name or a name exceeding the maximum length, **Then** the rename is rejected with a validation message and the previous name is preserved.
3. **Given** a rotation has been renamed, **When** any visitor opens the original shareable link afterwards, **Then** the link resolves to the same rotation and shows the new name (the link is unaffected by rename).

---

### User Story 4 - Permanently delete a rotation (Priority: P3)

A visitor decides the rotation is no longer needed (the team disbanded, the responsibility ended, it was a mistake). They initiate deletion, receive a clear confirmation prompt warning that the action is irreversible, and confirm. The rotation and all its data are removed. The shareable link no longer resolves to anything — future visitors see a "not found" state.

**Why this priority**: Useful for hygiene and user comfort, but not required for the core create-and-use loop. Positioned as P3 because the link-holder trust model means careless or malicious deletion is a real concern; this priority reflects that we want to ship it, but after the safer primary flows are proven.

**Independent Test**: With a rotation already created, a visitor triggers deletion. A confirmation prompt is shown that clearly communicates the action is irreversible. On confirmation, the rotation is destroyed and subsequent attempts to open the shareable link return a "not found" response. On cancellation from the confirmation prompt, the rotation is unchanged.

**Acceptance Scenarios**:

1. **Given** a visitor on an existing rotation page, **When** they trigger the delete action, **Then** a confirmation prompt appears that explicitly states the deletion is permanent and cannot be undone, and requires the visitor to type the rotation's exact current name into a confirmation field before the confirm button becomes enabled.
2. **Given** the confirmation prompt is shown, **When** the visitor cancels, dismisses it, or confirms without typing the correct name, **Then** the rotation remains intact and no data is removed.
3. **Given** the confirmation prompt is shown and the visitor has typed the rotation's name correctly, **When** they confirm deletion, **Then** the rotation is permanently removed, the visitor is navigated to the application's landing / create-rotation screen, and a transient toast/snackbar announces "Rotation '<name>' was deleted."
4. **Given** a rotation has just been deleted, **When** any visitor opens its previous shareable link, **Then** the application responds with the same "rotation not found" state used for any other unknown slug.
5. **Given** a rotation has been deleted, **When** a new rotation is subsequently created, **Then** the new rotation receives a fresh unique slug and is never assigned the slug of the deleted rotation within any practical time horizon.

---

### Edge Cases

- **Slug collision on creation**: The random slug space is finite (~47 bits). If generation produces a slug that already exists, the system must detect the collision and generate a new slug, never overwriting an existing rotation.
- **Rotation not found**: Opening a link with a well-formed but unknown slug, a malformed slug, or the slug of a previously deleted rotation must all produce the same user-visible "not found" state, so that the response does not distinguish "never existed" from "was deleted" (avoids information leakage and simplifies the UI).
- **Concurrent rename**: Two visitors editing the rotation name at nearly the same time. The last write wins; neither visitor should see a broken state.
- **Concurrent delete while viewing**: A visitor is viewing a rotation that another visitor deletes. Any subsequent action the first visitor attempts on that rotation must fail gracefully with the "not found" state, not a generic error.
- **Whitespace-only or leading/trailing whitespace in names**: Names must be trimmed; a name that is only whitespace is treated as empty and rejected.
- **Name with emoji, non-Latin characters, or control characters**: Printable Unicode (including emoji and non-Latin scripts) is accepted. Control characters (including embedded newlines) are rejected or stripped, since names are single-line display strings.
- **Rapid-fire rotation creation**: A single client repeatedly creating rotations (abuse). Rate limiting applies per the PRD; however, for this feature spec, the relevant behaviour is that the creation endpoint responds with a clear "too many requests" state rather than silently failing, once the rate limit is hit.
- **Link shared verbally**: The slug must be visually unambiguous enough to dictate — base-58 excludes `0`, `O`, `I`, `l` by convention, which satisfies this.

## Requirements *(mandatory)*

### Functional Requirements

**Creation**

- **FR-001**: The system MUST allow any visitor to create a rotation by submitting a single field: a rotation name.
- **FR-002**: The system MUST require no account, login, or any identity verification step to create a rotation.
- **FR-003**: The system MUST validate the submitted rotation name against the following rules before creating the rotation: length between 1 and 100 characters (after trimming leading/trailing whitespace), no control characters (including newlines), printable Unicode characters otherwise permitted.
- **FR-004**: The system MUST reject creation with a clear, user-visible validation message when the name is invalid, and MUST NOT persist any partial rotation.
- **FR-005**: On successful creation, the system MUST generate a new shareable slug and atomically persist the rotation keyed by that slug.
- **FR-006**: On successful creation, the system MUST navigate the creator directly to the newly created rotation page. On the first view only, an in-page banner (or equivalent inline control) MUST display the shareable link with a copy-to-clipboard affordance and a dismiss control. The banner MUST NOT be shown on subsequent visits to the rotation. A persistent "share this rotation" affordance elsewhere on the page is allowed but out of scope for this requirement.

**Slug properties**

- **FR-007**: The system MUST generate slugs that are exactly 8 characters long, drawn from the base-58 alphabet (Bitcoin base-58: digits `1`–`9` and letters `A`–`Z`, `a`–`z`, excluding `0`, `O`, `I`, `l`).
- **FR-008**: The system MUST generate slugs using a cryptographically secure random source (not a general-purpose pseudo-random generator).
- **FR-009**: The system MUST treat the slug as the sole identifier of a rotation in any URL, API request, or shareable link. No other identifier is exposed externally.
- **FR-010**: The system MUST detect slug collisions at creation time and, on collision, regenerate the slug and retry, guaranteeing that a created rotation is never assigned a slug already in use.
- **FR-011**: The system MUST NOT reuse the slug of a deleted rotation for a new rotation, within any practical time horizon. (Given 58^8 ≈ 1.28 × 10^14 possible slugs and cryptographically random generation, the probability of accidental reuse is negligible for the foreseeable scale of the product, so no explicit "reserved slug" list is required.)

**Access via slug**

- **FR-012**: The system MUST allow any visitor holding a rotation's shareable link to view and fully manage that rotation, with no further authentication.
- **FR-013**: The system MUST respond with a "rotation not found" state, indistinguishable to the visitor regardless of the underlying reason, when the slug is well-formed but unknown, when the slug is malformed, or when the slug corresponds to a rotation that has been deleted.
- **FR-014**: The system MUST reject malformed slugs (wrong length, invalid characters) as "not found" without performing a data store lookup, so that malformed-URL traffic does not consume lookup resources.
- **FR-014a**: Slug lookups MUST be strictly case-sensitive. A slug with one or more characters in the wrong case MUST resolve to the same "rotation not found" state as any other unknown slug; the system MUST NOT perform case-folded or case-insensitive matching.

**Rename**

- **FR-015**: Any visitor holding a rotation's shareable link MUST be able to change the rotation's name.
- **FR-016**: Renaming MUST apply the same validation rules as creation (FR-003). Invalid renames MUST be rejected with a clear validation message and MUST NOT alter the stored name.
- **FR-017**: Renaming a rotation MUST NOT change its slug. The shareable link remains stable across renames.
- **FR-018**: A successful rename MUST be immediately visible to any subsequent visitor who loads the rotation.

**Delete**

- **FR-019**: Any visitor holding a rotation's shareable link MUST be able to initiate deletion of that rotation.
- **FR-020**: The system MUST require an explicit typed-confirmation step before deletion is performed. The confirmation UI MUST (a) communicate that the action is permanent and irreversible, (b) display the rotation's current name, (c) require the visitor to type that exact name (case-sensitive, whitespace-trimmed) into a confirmation field, and (d) keep the confirm action disabled until the typed value matches. If the typed value does not match, confirming MUST be a no-op.
- **FR-021**: On confirmation, the system MUST permanently remove the rotation. Deletion MUST be irreversible — there is no undo or soft-delete recovery path exposed to the visitor.
- **FR-022**: After deletion, any subsequent access attempt to the deleted rotation's slug MUST produce the "rotation not found" state (FR-013).
- **FR-023**: Cancelling or dismissing the confirmation step MUST leave the rotation unchanged.
- **FR-023a**: After successful deletion, the system MUST navigate the visitor to the application's landing / create-rotation screen and MUST display a transient toast/snackbar confirming the deletion, including the rotation's name. The toast MUST be conveyed accessibly (e.g., via an ARIA live region) so assistive technologies announce it.

**General behaviour**

- **FR-024**: All write operations (create, rename, delete) MUST be idempotent or safely repeatable in the sense that repeated submissions of the same action either succeed identically or return a predictable, non-destructive error — the UI MUST never leave the rotation in an inconsistent partial state after a failed action.
- **FR-025**: The system MUST not expose any internal identifier (such as a database primary key) of a rotation in any URL, response body, log visible to users, or error message.
- **FR-026**: The system MUST maintain a last-access timestamp on each rotation. It MUST update the timestamp when a rotation is read or written, subject to a throttle that permits at most one update per rotation per 24-hour window. Writes that are throttled out MUST NOT fail the originating operation. The timestamp is written by this feature but consumed by the inactivity-expiry feature (out of scope here).

### Key Entities

- **Rotation**: The top-level entity of the application. A named shared responsibility. Its externally visible identity is a slug; its human-readable identity is a name. Within this feature, a rotation's observable attributes are:
  - **Slug** — 8-character base-58 string; unique, immutable, cryptographically random; the sole external identifier.
  - **Name** — free-text display string (1–100 characters, trimmed, printable Unicode); mutable.
  - **Creation timestamp** — when the rotation came into existence; used downstream for expiry (PRD §5.2 — out of scope here, but the timestamp is established at creation).
  - **Last-access timestamp** — updated on any read or write of the rotation, throttled to at most one update per rotation per 24-hour window. Used downstream for the inactivity-expiry policy (PRD §5.2 — the policy itself is out of scope here, but this attribute is written within the scope of this feature).

  Rotations also carry a member queue, schedule configuration, skip behaviour, and occurrences — all of which are the subject of separate feature specifications and are explicitly out of scope for this one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can go from landing on the application to holding a shareable rotation link in under 15 seconds, performing only two interactions (entering a name, confirming creation).
- **SC-002**: 100% of rotations created are reachable via their shareable link on the first attempt, from a clean browser session, with no account or additional credential.
- **SC-003**: Zero observed slug collisions result in data loss or cross-rotation access across the lifetime of the product (achieved by collision detection on creation — FR-010).
- **SC-004**: Every validation failure on rotation creation or rename produces a user-visible message that a non-technical stakeholder can understand and act on, measured by usability review of all validation paths.
- **SC-005**: No visitor reports accidentally deleting a rotation because the confirmation was unclear, measured by user feedback over the first 3 months post-launch. (If even one such report occurs, the confirmation copy or flow must be revised.)
- **SC-006**: All three states — "unknown slug", "malformed slug", "deleted rotation" — present to the visitor as the same user-visible response, verified by end-to-end tests covering each path.
- **SC-007**: The rotation link remains stable across any number of renames: 100% of renames preserve the original slug, verified by automated test.

## Assumptions

- The initial release has no authentication, no accounts, and no ownership tiers. Any visitor with the link has full management access. This is explicitly inherited from the PRD and is not revisited here.
- The 8-character base-58 slug length is treated as fixed and non-negotiable in this feature, per the PRD's security model (§5.2). Longer or shorter slugs are out of scope.
- The base-58 alphabet used is the Bitcoin base-58 alphabet (excluding `0`, `O`, `I`, `l`) because it is the de-facto standard for human-shareable short identifiers and avoids visually ambiguous characters. If the project has a differing preference, this can be re-confirmed during planning; it does not affect any user-visible requirement in this spec.
- The maximum rotation name length is 100 characters, as specified in PRD §5.2.
- Rate limiting for rotation creation and for rotation lookups is a non-functional concern covered in PRD §5.2 and is assumed to be implemented at the platform layer. This spec covers only the user-visible behaviour that results when a rate limit is hit (clear "too many requests" state; see Edge Cases).
- Inactivity-based expiry (12 months) is governed by a separate feature/lifecycle concern (PRD §5.2) and is out of scope here. However, the attributes needed to support it — creation timestamp and last-access timestamp — are assumed to be written by this feature.
- The application is accessed via a standard web browser on desktop or mobile; native mobile apps are out of scope (per PRD §1.3).
- "Deletion" in this feature means permanent removal. No soft-delete, archive, or undo path is exposed to the visitor in this release.
- The post-deletion destination is the application's landing / create-rotation screen (clarified 2026-04-18). A transient toast/snackbar confirms the deletion.
- Member queue management, schedule configuration, occurrence browsing, skip behaviours, and all other rotation capabilities named in the PRD are out of scope for this feature and will be specified separately.
