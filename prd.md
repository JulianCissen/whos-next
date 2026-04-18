# PRD: Who's Next

## 1. Product overview

### 1.1 Document title and version
- PRD: Who's Next
- Version: 0.1 (draft)

### 1.2 Product summary

Who's Next is a lightweight web application for managing recurring turn-based responsibilities within a group. Users create a rotation — a named, ordered list of members paired with a schedule — and the app automatically determines whose turn it is for any given occurrence, past or future.

The app is designed to be frictionless: no accounts, no sign-up. A rotation is created in seconds and shared via a URL. Anyone with the link can view and manage the rotation, making it ideal for small teams with informal coordination needs.

The initial release focuses on the core rotation lifecycle: creating a rotation, managing its member queue, viewing assignments across time, and handling the common case where a member is unavailable for a specific occurrence.

### 1.3 Scope

**In scope:**
- Creating and managing rotations with a member queue and a schedule
- Two schedule types: recurrence rules and manually curated date lists
- Viewing assignments for past, current, and future occurrences
- Adding and removing members, with queue position control
- Marking a member as unavailable for a specific occurrence and applying a configured skip behavior
- Shareable rotation links with no account requirement

**Out of scope (this release):**
- User accounts or authentication
- Rotation ownership or permission tiers (e.g., admin vs. viewer)
- Notifications or reminders (email, push, etc.)
- Multiple members assigned to the same occurrence
- Read-only view links
- Mobile native applications

## 2. Goals & success metrics

### 2.1 Business goals
- Launch a usable, publicly accessible product with zero onboarding friction
- Establish a shareable URL model that drives organic, link-based growth

### 2.2 User goals
- Know immediately whose turn it is for an upcoming occurrence without any manual tracking
- Manage a rotation queue (add, remove, reorder members) without coordination overhead
- Handle member unavailability in a way that the team agrees is fair

### 2.3 Success metrics

> **TBD:** Formal success metrics depend on whether any analytics or usage tracking will be added. Candidate metrics include: number of rotations created, number of return visits to a rotation link, and rate of member additions after initial creation.

## 3. Users & roles

### 3.1 Personas

- **Creator:** The person who initially sets up a rotation. They define the name, schedule type, member queue, and skip behavior. In the current release, creators have no special persistent privileges — they access the rotation via the same link as anyone else.
- **Visitor:** Any person who accesses a rotation via its shared rotation link. In the current release, all visitors have full management access (viewing and editing).

### 3.2 Role-based access & permissions

- **Rotation link holder** (Must have): Any person with the rotation link can view all occurrences and their assignments, add or remove members, mark members as unavailable for occurrences, and modify the schedule.

> **TBD:** A future release may introduce an ownership model where the creator receives a separate admin link and visitors receive a read-only or limited-edit link. This is explicitly out of scope for v1.

## 4. Functional requirements

### 4.1 Glossary

The following terms are used consistently throughout this document and the product:

| Term | Definition |
|---|---|
| **Rotation** | The top-level entity. A named, shared responsibility that cycles through a group of members on a schedule. |
| **Member** | A named slot in a rotation's queue. Not a user account — just a display name. Members are ordered and that order determines whose turn comes next. |
| **Queue** | The ordered list of members within a rotation. Queue order drives assignment priority. |
| **Schedule** | The recurrence configuration of a rotation — either a recurrence rule (e.g., every Monday) or a manually curated list of specific dates. |
| **Occurrence** | A single dated instance of a rotation. Each occurrence has exactly one assignment. |
| **Assignment** | The member designated to fulfill a specific occurrence. |
| **Skip** | Marking a member as unavailable for one occurrence, triggering the rotation's configured skip behavior. |
| **Skip behavior** | The rule that governs how the rotation handles a skipped assignment. Configured per rotation. |
| **Rotation link** | The shareable URL that grants full access to view and manage a rotation. No account required. |

### 4.2 Rotation management

- **R-01 Create a rotation** (Priority: Must have): A visitor can create a new rotation by providing a name. On creation, a unique rotation link is generated and displayed to the creator.
- **R-02 Rotation link as the sole identifier** (Priority: Must have): A rotation is accessed exclusively via its rotation link. No account or login is required at any point.
- **R-03 View rotation** (Priority: Must have): Any visitor with the rotation link can view the rotation name, member queue, schedule, and occurrence assignments.
- **R-04 Edit rotation name** (Priority: Should have): A visitor can rename a rotation at any time.
- **R-05 Delete rotation** (Priority: Could have): A visitor can permanently delete a rotation. This action is irreversible.
  > **TBD:** Without an ownership model, any visitor with the link can delete. Confirm whether a confirmation step is sufficient safeguard, or whether deletion should be deferred to a future release with ownership.

### 4.3 Member queue management

- **R-06 Add member** (Priority: Must have): A visitor can add a member to a rotation by entering a display name. When adding, they must specify whether the new member is placed at the front or the back of the queue.
- **R-07 Remove member** (Priority: Must have): A visitor can remove a member from the queue at any time. Past occurrences assigned to that member retain the assignment record for historical accuracy.
- **R-08 Reorder queue** (Priority: Should have): A visitor can manually reposition members within the queue to adjust the order of upcoming assignments.
- **R-09 Queue drives assignment** (Priority: Must have): Assignments are derived deterministically from the queue order and the schedule. The first member in the queue is assigned to the first upcoming occurrence; assignments cycle through the queue in order, wrapping around indefinitely.

### 4.4 Schedule configuration

- **R-10 Recurrence rule schedule** (Priority: Must have): A rotation can use a recurrence rule to define its occurrences. Supported rules at launch:
  - Weekly on a specific day of the week (e.g., every Monday)
  - Every N weeks on a specific day of the week (e.g., every two weeks on Friday)
  - Monthly on a specific day number (e.g., the 15th of every month)
- **R-11 Custom date list schedule** (Priority: Must have): A rotation can use a manually curated list of specific dates instead of a recurrence rule. Visitors can add or remove individual dates at any time.
- **R-12 Schedule type is selected at creation** (Priority: Must have): The schedule type (recurrence rule vs. custom date list) is chosen when creating the rotation. It can be changed after creation, though doing so will reset the schedule configuration.
- **R-13 Edit recurrence rule** (Priority: Should have): For recurrence-rule rotations, a visitor can update the rule (e.g., change the day of week or interval). Changes apply to future occurrences only; past assignments are preserved.

### 4.5 Occurrence view

- **R-14 View current occurrence** (Priority: Must have): The rotation prominently displays who is assigned to the next upcoming occurrence and its date.
- **R-15 View previous occurrence** (Priority: Must have): The rotation displays who was assigned to the most recent past occurrence and its date.
- **R-16 Browse future occurrences** (Priority: Must have): A visitor can navigate forward through upcoming occurrences to see who is assigned to each, with no defined upper limit.
- **R-17 Browse past occurrences** (Priority: Should have): A visitor can navigate backward through past occurrences to review the full historical assignment record.

### 4.6 Unavailability and skip behavior

- **R-18 Mark member unavailable** (Priority: Must have): On any occurrence, a visitor can mark the assigned member as unavailable for that specific occurrence. This triggers the rotation's configured skip behavior and cannot affect any other occurrence.
- **R-19 Skip behavior: Pass** (Priority: Must have): The next member in the queue covers the occurrence. The skipped member's position in the queue is unchanged; they continue at their normal cadence. No debt is incurred.
- **R-20 Skip behavior: Defer** (Priority: Should have): The next member in the queue covers the occurrence. Covering counts as that member's turn for this cycle — they are not owed an additional assignment. The skipped member is moved to after the last member who has not yet had a turn in the current cycle, ensuring the total number of assignments per cycle remains constant and no member does two consecutive occurrences as a result of the skip.
- **R-21 Skip behavior: Manual substitute** (Priority: Should have): The occurrence is flagged as needing a substitute. The visitor selects any member from the queue to cover. Neither the skipped member's nor the substitute's queue position is affected.
- **R-22 Skip behavior is configured per rotation** (Priority: Must have): The skip behavior (Pass, Defer, or Manual substitute) is set when creating a rotation and can be changed at any time. The default is Pass.
- **R-23 Skipped status is visible** (Priority: Must have): An occurrence where the original assignee was skipped displays both the substitute's name and a visual indication that the original member was unavailable for that occurrence.

## 5. Non-functional requirements

### 5.1 Performance

> **TBD:** To be defined in the technical architecture phase.

### 5.2 Security

Because Who's Next requires no account, the attack surface is low but not zero. The following abuse vectors are identified along with their mitigations. The goal is lightweight, low-effort protection appropriate for a non-critical application — not a hardened security posture.

**Abuse vectors and mitigations:**

| Vector | Description | Mitigation |
|---|---|---|
| **Rotation spam** | Automated or manual mass creation of rotations exhausting storage | Rate-limit rotation creation by hashed client fingerprint (see below). Apply a hard cap on total rotations per fingerprint per time window (e.g., 20 per hour). |
| **Link enumeration** | Guessing rotation links to access or vandalize other rotations | Use a short cryptographically random slug (8 characters, base-58 alphabet, ~47 bits of entropy) combined with server-side rate limiting on rotation lookups. Short slugs keep URLs readable; the lookup rate limit makes exhaustive enumeration impractical regardless of slug length. |
| **Oversized payloads** | Extremely long names, large member lists, or huge custom date lists causing storage or performance issues | Enforce input length caps: rotation names (max 100 characters), member names (max 100 characters), members per rotation (max 100), custom dates per rotation (max 500). |
| **Inactivity bloat** | Abandoned rotations accumulating indefinitely | Auto-expire rotations that have not been accessed in 12 months. Notify visitors via the UI that the rotation will be deleted 30 days before expiry. |

**On client fingerprinting:** Rate limiting on both rotation creation and rotation lookups is applied against a hashed browser fingerprint derived from non-identifying signals (e.g., user-agent, timezone, screen resolution). The raw signals are not stored — only the hash. This provides a reasonable friction floor against automated abuse without collecting personally identifiable information.

**On lookup rate limiting:** Rate limit counters are held in backend process memory only — no database writes, no external store. Counters reset on process restart, which is an accepted tradeoff for a single-instance deployment. This approach does not scale to multiple backend instances; if horizontal scaling is ever introduced, this decision must be revisited.

### 5.3 Accessibility

- The application targets **WCAG 2.2 AA** compliance.
- Accessibility is verified as part of the automated e2e test suite using axe-core via Playwright. Accessibility regressions are treated as test failures.

### 5.4 Reliability & availability

> **TBD:** Uptime targets and error handling strategy to be defined.

## 6. Standards & conventions

### 6.1 Coding standards

- **Language:** TypeScript throughout — frontend, backend, and shared packages. TypeScript 5.9.3 (latest version supported by Angular).
- **Package manager:** pnpm 10, no hoisting. All packages must declare their own dependencies explicitly. Shared dependency versions are aligned via pnpm catalogs (`catalog:` protocol in `pnpm-workspace.yaml`).
- **Runtime:** Node 24.
- **Project structure:** Monorepo with packages and apps in separate top-level folders: `apps/` (frontend, backend, e2e) and `packages/` (shared). The shared package contains DTOs, enums, and any other types consumed by both frontend and backend. Cross-package imports are only permitted from `shared` — `frontend` and `backend` do not import from each other.
- **Linting:** ESLint 9+ with a flat config (`eslint.config.mjs`) at the monorepo root. Required plugins: `typescript-eslint` (`recommendedTypeChecked`), `angular-eslint` (scoped to frontend), `eslint-plugin-import-x` (import ordering and cycle detection), `eslint-plugin-unicorn` (opinionated best practices), `eslint-plugin-prettier` (formatting integration), `eslint-plugin-package-json`.
- **Formatting:** Prettier via `prettier.config.mjs` at the monorepo root. Settings: `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `semi: true`.
- **Angular conventions:** Standalone bootstrap (`bootstrapApplication`). Zoneless change detection (`provideZonelessChangeDetection()`). All components must use `ChangeDetectionStrategy.OnPush`. All routes must be lazy-loaded with `loadComponent`.
- **NestJS conventions:** Structured JSON logging (`ConsoleLogger` with `json: true`). Global API prefix `api` (with `/health` excluded). Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. DTOs validated with `class-validator` and `class-transformer`.
- **API testing:** Every backend endpoint must have a corresponding [Bruno](https://www.usebruno.com/) request in `apps/backend/bruno/`.
- **AI sign-off checklist:** Before signing off on any change, verify: (1) zero TypeScript errors across all affected packages, (2) zero ESLint errors and warnings across all affected files.

### 6.2 Design & UX standards

- **Design system:** Material 3.
- **Component library:** Angular Material (Material 3 theme).
- All UI components must be sourced from Angular Material or be custom components that conform to the Material 3 specification.
- **Theming:** Both light and dark themes. A theme switcher must be included. Default to the user's system preference.
- **Internationalisation:** Required. English is the default (and minimum) language. `@ngx-translate/core` with `@ngx-translate/http-loader` is used for runtime translation loading.

### 6.3 API & data conventions

- Request and response shapes are defined as TypeScript interfaces in the `shared` package and imported by both the NestJS controllers and Angular services. Frontend and backend must not define their own duplicate DTO types.
- All API responses use camelCase field names.

### 6.4 Compliance & regulatory

- WCAG 2.2 AA (see section 5.3).
- No personally identifiable information is collected or stored. Member names are free-text display names only. Client fingerprints are stored as one-way hashes exclusively.

## 7. Technical specifications

### 7.1 Technology stack & packages

| Layer | Technology |
|---|---|
| Frontend framework | Angular 21 (client-side rendering) |
| Frontend UI | Angular Material (Material 3) |
| Internationalisation | @ngx-translate/core + @ngx-translate/http-loader |
| Backend framework | NestJS 11 |
| ORM | MikroORM 7 |
| Database | PostgreSQL 16 |
| Shared | TypeScript package for DTOs and common types |
| Unit testing | Vitest (unit and component tests via `vitest.config.ts`; integration tests via `vitest.integration.config.ts` + Testcontainers) |
| E2E & accessibility testing | Playwright + axe-core (`@axe-core/playwright`) |
| API testing | Bruno collections (`apps/backend/bruno/`) |
| Package manager | pnpm 10 (no hoisting, catalogs for shared versions) |
| Language | TypeScript 5.9.3 |
| Runtime | Node 24 |
| Linting | ESLint 9+ flat config |
| Formatting | Prettier |

### 7.2 Architecture & integrations

- **Monorepo** containing packages under `apps/` (frontend, backend, e2e) and `packages/` (shared).
- **Frontend** is a CSR Angular application deployed on Cloudflare Pages.
- **Backend** is a NestJS API deployed on Railway (single instance).
- **Dev environment** is fully Dockerized. All components share a common base image (Node 24), with separate multi-stage build targets per component (frontend, backend, shared watcher). A single `docker-compose.yml` at the repository root orchestrates the full local stack including the PostgreSQL instance. A dedicated `packages-watcher` Docker service runs `tsc --watch` inside `packages/shared/` to keep compiled output in sync; the backend service declares it as a dependency.
- No external services are introduced for the initial release. Rate limiting, slug generation, and all application logic run within the NestJS process.

### 7.3 Data storage & privacy

- **Database:** PostgreSQL 16, managed via MikroORM 7.
- No personally identifiable information is stored. Member names are free-text display names with no association to real identities.
- Client fingerprints used for rate limiting are stored only as hashes in process memory and are never written to the database.
- Rate limit counters are held exclusively in backend process memory and are lost on restart.

### 7.4 Constraints & known limitations

- **In-memory rate limiting** does not persist across backend restarts and does not function correctly if multiple backend instances are run. Acceptable for a single-instance Railway deployment; must be revisited before horizontal scaling.
- **No authentication** means the rotation link is the sole access control mechanism. Anyone who obtains a rotation link has full management access. This is a known and accepted constraint of the v1 no-account model.
- **CSR-only frontend** means the initial page load requires JavaScript. Server-side rendering is not in scope.

### 7.5 Backend patterns & conventions

- **BaseEntity:** All domain entities must extend a shared `BaseEntity` (defined with MikroORM's decorator-less `defineEntity` API) that provides:
  - UUID primary key — `gen_random_uuid()` as the database default, `randomUUID()` as the application-level default.
  - `createdAt` / `updatedAt` timestamps — both an `onCreate`/`onUpdate` application-level callback and a `defaultRaw('NOW()')` database-level default.
- **Entity seeders:** Every domain entity must have a seeder in `apps/backend/seeders/` that populates a representative set of test data covering a wide variety of scenarios.
- **Migration lifecycle:** During early development (no migration files present), the database schema is managed with the MikroORM CLI `schema:fresh` command. Once the first migration file is committed, every subsequent schema change requires a generated migration file. The presence of any migration file in the repository signals the project is in the post-stabilisation phase.

### 7.6 Integration testing

- Integration tests use Testcontainers to spin up a real PostgreSQL container during test runs.
- The `vitest.integration.config.ts` `globalSetup` file (`apps/backend/src/test/global-setup.ts`) starts a `postgres:16-alpine` container and writes the connection URI to `process.env` for tests to consume. The container reference is stored on `globalThis` so the teardown function can stop it.
- Set a `testTimeout` of at least 60 000 ms in `vitest.integration.config.ts` to allow for container startup.
- The `@testcontainers/postgresql` package must be added as a dev dependency when the first integration test is introduced.

### 7.7 Bruno API collection requirements

- Every backend endpoint must have a corresponding Bruno request in `apps/backend/bruno/`.
- Each request must cover at minimum: the primary success case and any meaningful error or edge-case variants (e.g. 400 validation failure, 404 not found).
- Use Bruno environment files (`apps/backend/bruno/environments/`) to parameterise the base URL so the collection works across local and any future environments without editing individual requests.
- The `bruno/` directory and all environment files (except those containing secrets) are committed to the repository.
