# Feature Specification: Project Scaffolding

**Feature Branch**: `20260415-200718-project-scaffolding`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Can we implement unit 0 from @specs/README.md? So basically scaffolding the entire project? Create a spec."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reproducible Local Stack (Priority: P1)

A developer clones the repository and, without any manual setup beyond installing Docker, gets the entire application stack — frontend, backend, and database — running locally with a single command. All three services start, communicate with each other, and are accessible in the browser and via API calls.

**Why this priority**: Every subsequent development task depends on a working local environment. If this isn't reliable, no other work can proceed.

**Independent Test**: A developer with a clean machine (Docker only, no Node/pnpm installed) runs one command and can access the frontend in a browser and call the backend API within five minutes.

**Acceptance Scenarios**:

1. **Given** a freshly cloned repository, **When** the developer runs the single orchestration command, **Then** all three services (frontend, backend, database) are running and healthy within five minutes, with no manual configuration required.
2. **Given** the stack is running, **When** the developer opens the frontend URL in a browser, **Then** they see the application shell (placeholder home page) with no console errors.
3. **Given** the stack is running, **When** the developer sends a health-check request to the backend API, **Then** they receive a successful response confirming the backend is running and the database connection is healthy.

---

### User Story 2 - Enforced Package Boundaries (Priority: P2)

A developer working on the frontend or backend cannot accidentally import code from the opposite package. The project structure makes cross-package imports a build-time error, not a runtime surprise. The `shared` package is the only permitted bridge.

**Why this priority**: Architectural boundaries must be enforced from the first commit. Retrofitting them once code exists is expensive and disruptive.

**Independent Test**: Attempting to import a backend module from the frontend (or vice versa) produces a compile-time or lint error.

**Acceptance Scenarios**:

1. **Given** the monorepo is set up, **When** a developer adds an import from `backend` inside `frontend` code, **Then** the build fails with a clear error explaining the boundary violation.
2. **Given** the monorepo is set up, **When** a developer imports from the `shared` package inside either `frontend` or `backend`, **Then** the import resolves correctly and the build succeeds.
3. **Given** the monorepo is set up, **When** a developer adds a new type to `shared`, **Then** it is immediately available to both `frontend` and `backend` without any configuration changes.

---

### User Story 3 - Test Suite Ready from Day One (Priority: P3)

A developer can run unit tests for both the frontend and backend, and run end-to-end accessibility tests, immediately after setup — before any feature code has been written. All test commands succeed (with empty suites or placeholder passing tests).

**Why this priority**: Establishing the test pipeline before feature development ensures tests are never retrofitted and accessibility is enforced from the first deliverable.

**Independent Test**: All three test commands (frontend unit, backend unit, e2e/accessibility) execute without errors and exit with a passing status on a fresh checkout.

**Acceptance Scenarios**:

1. **Given** the project is scaffolded, **When** the developer runs the frontend unit test command, **Then** the test runner launches successfully and reports zero failures.
2. **Given** the project is scaffolded, **When** the developer runs the backend unit test command, **Then** the test runner launches successfully and reports zero failures.
3. **Given** the local stack is running, **When** the developer runs the e2e test command, **Then** Playwright executes against the running frontend, the axe-core accessibility check passes on the placeholder page, and the suite exits with zero failures.

---

### User Story 4 - Internationalised UI Shell (Priority: P4)

The frontend application shell supports two languages (Dutch and English) from the first commit. Switching between languages works without a page reload. No string literals are hardcoded in components or templates.

**Why this priority**: Adding i18n support to an existing codebase is significantly more disruptive than including it from the start. Both Dutch and English must be available before any user-visible text is introduced.

**Independent Test**: The language toggle (or query parameter) switches all visible text in the placeholder shell between Dutch and English without a full page reload.

**Acceptance Scenarios**:

1. **Given** the frontend is running, **When** the developer switches the language to Dutch, **Then** all visible text in the shell is displayed in Dutch.
2. **Given** the frontend is running, **When** the developer switches the language to English, **Then** all visible text in the shell is displayed in English.
3. **Given** a developer adds a new UI string, **When** they attempt to hardcode it in a template instead of using the i18n mechanism, **Then** a lint or build warning is produced.

---

### Edge Cases

- What happens when Docker is not running when the orchestration command is executed? The command fails immediately with a clear, actionable error message — not a silent hang.
- How does the system handle a port conflict (e.g., PostgreSQL port already in use)? The orchestration command fails with a human-readable error indicating which port is in conflict and suggesting a resolution.
- What happens when a developer runs the setup on a machine where the database container already has stale data from a previous session? The existing volume persists; the developer can optionally reset to a clean state with a documented command.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST be structured as a monorepo with three packages: `frontend`, `backend`, and `shared`. Each package MUST declare all its own dependencies explicitly; shared dependency hoisting is disabled.
- **FR-002**: The `shared` package MUST be the sole permitted boundary for types, DTOs, and enums shared between `frontend` and `backend`. Imports between `frontend` and `backend` directly MUST be rejected at build time.
- **FR-003**: The full local development stack (frontend, backend, database) MUST be launchable with a single command requiring only Docker as a prerequisite — no local language runtimes or package managers are required.
- **FR-003a**: The development stack MUST support hot reload for both frontend and backend — file changes are automatically detected and trigger recompilation without restarting the container. File watching MUST use polling (not filesystem events) to ensure reliable detection inside Docker containers on all host operating systems.
- **FR-004**: All components MUST share a common base Docker image, with per-component multi-stage build targets, so that base image updates propagate consistently.
- **FR-005**: The backend skeleton MUST include a working database connection to PostgreSQL 16, confirming connectivity as part of its health check, before any feature tables exist. The database migration tooling MUST be configured and an initial empty baseline migration MUST be committed so that running the migrate command succeeds on a fresh database with no further setup.
- **FR-006**: The frontend skeleton MUST render a placeholder home page using the Material 3 design system components (via Angular Material), with no hardcoded string literals in any template or component.
- **FR-007**: The frontend MUST support Dutch and English as languages from the first commit, with a working language-switching mechanism in the placeholder shell.
- **FR-008**: Unit test runners MUST be configured for both `frontend` and `backend` and MUST execute successfully (passing, with zero or placeholder test cases) on a fresh checkout.
- **FR-009**: The e2e test suite MUST be configured with Playwright and axe-core, MUST target the running frontend, and MUST include at least one placeholder accessibility test that passes on the scaffold page.
- **FR-010**: The repository MUST include a `.gitignore` covering build artifacts, dependency directories, environment files, and Docker volumes for all three packages and the orchestration layer.
- **FR-011**: The frontend dev server MUST proxy all requests under `/api/*` to the backend service, so that frontend code calls a relative `/api` path and no cross-origin configuration is required in the development environment.

### Key Entities

- **Monorepo workspace**: The top-level project that declares and links the three packages. Has no runtime code itself; its role is dependency management and script orchestration.
- **`shared` package**: A TypeScript-only package containing placeholder DTO interfaces and enums. Has no runtime executable; compiled output is consumed by `frontend` and `backend`.
- **`frontend` package**: The Angular application shell. Produces a static build artifact served by the dev server. Has i18n resource files for Dutch and English.
- **`backend` package**: The NestJS application shell with a health-check endpoint and a verified database connection. No feature endpoints yet.
- **Orchestration configuration**: The `docker-compose.yml` that defines and links all service containers including PostgreSQL 16.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with only Docker installed can go from a clean repository clone to a fully running local stack in under five minutes by running a single, documented command.
- **SC-002**: Attempting to import directly between `frontend` and `backend` packages causes the build to fail; zero manual enforcement steps are required.
- **SC-003**: All three test commands (frontend unit, backend unit, e2e+accessibility) execute and exit with zero failures on a freshly cloned repository with the local stack running.
- **SC-004**: The frontend renders in both Dutch and English via the language-switch mechanism, with zero hardcoded strings in any template at the time of the initial commit.
- **SC-005**: The backend health check endpoint returns a successful response confirming database connectivity within five seconds of the stack reaching a healthy state.

## Clarifications

### Session 2026-04-15

- Q: Should hot reload (automatic re-compilation on file save) for both frontend and backend be included in Unit 0, or deferred? → A: Include for both; file watching MUST use polling inside Docker containers.
- Q: How should the frontend reach the backend API in the local development stack? → A: Frontend dev server proxies `/api/*` requests to the backend — no CORS config needed.
- Q: Should Unit 0 include MikroORM migration tooling configured with an initial empty baseline migration, or just a raw database connection? → A: Include migration tooling configured; initial empty baseline migration committed so `migrate:up` works from day one.

## Assumptions

- All subsequent development units (Units 1–5) depend on this scaffold being in place; Unit 0 is a prerequisite for everything else and must be completed before any feature work begins.
- The Docker-based setup is the canonical development environment; no guarantees are made about running the stack directly on the host machine without Docker.
- The placeholder DTO structure in `shared` does not need to be complete; it only needs to demonstrate the import pattern and compile successfully.
- Hot reload is included in Unit 0 and uses polling-based file watching to work reliably inside Docker containers regardless of host OS (Windows, macOS, Linux).
- Environment-specific configuration (database credentials, ports) is provided via a documented `.env` file or Docker Compose defaults; no secrets are committed to the repository.
