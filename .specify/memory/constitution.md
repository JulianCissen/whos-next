<!-- SYNC IMPACT REPORT
Version change: (new) → 1.0.0
Added sections: Core Principles (I–V), Data & API Conventions, Development & Quality Standards, Governance
Modified principles: N/A — initial ratification
Removed sections: N/A
Templates reviewed:
  - .specify/templates/plan-template.md — Constitution Check placeholder intact; /speckit.plan fills it dynamically ✅
  - .specify/templates/spec-template.md — No constitution-specific overrides required ✅
  - .specify/templates/tasks-template.md — No constitution-specific overrides required ✅
Deferred TODOs: None
-->

# Who's Next Constitution

## Core Principles

### I. Monorepo with Shared Types as the Contract Boundary

The project MUST be structured as a pnpm monorepo with three packages: `frontend`, `backend`, and `shared`.
The `shared` package is the sole location for DTOs, enums, and any type shared between packages.
`frontend` and `backend` MUST NOT import from each other — only from `shared`.
All packages MUST declare their own dependencies explicitly; pnpm hoisting is disabled project-wide.

**Rationale**: Prevents type drift between the API surface and the UI layer. Enforcing this at package
boundaries makes violations visible at compile time rather than at runtime.

### II. Stateless URL-Based Access Model

Rotations are accessed exclusively via a cryptographically random 8-character base-58 slug. No user
accounts, sessions, or authentication tokens exist in v1. Any bearer of the rotation link has full
management access. This is a known and accepted constraint for the initial release.

MUST NOT: introduce session state, user accounts, or authentication middleware that blocks access to
rotation endpoints in v1 without an explicit PRD amendment.

**Rationale**: Zero-friction onboarding is a core product requirement. Adding auth infrastructure
breaks the "open URL and use" promise that drives the shareable-link growth model.

### III. Privacy by Design

No personally identifiable information (PII) MUST be collected or stored. Member names are free-text
display names only — no association to real identities. Rate-limit counters MUST use hashed browser
fingerprints derived from non-identifying signals (user-agent, timezone, screen resolution). Raw
fingerprint signals and IP addresses MUST NOT be persisted anywhere. Hashes are held in process
memory only and are lost on restart — this is an accepted tradeoff.

**Rationale**: The PRD explicitly excludes PII collection. Minimizing the GDPR surface is a product
goal, not just a compliance checkbox.

### IV. Accessibility as a Hard Gate

The application MUST target WCAG 2.2 AA compliance. Accessibility verification is integrated into the
automated e2e test suite via axe-core and Playwright. Accessibility regressions MUST be treated as
test failures — they block merge, not just warn.

**Rationale**: Retrofitting accessibility is expensive and disruptive. Making it a quality gate from
day one ensures it is never silently deferred.

### V. Simplicity and No Speculative Infrastructure

Infrastructure complexity MUST be justified against the known constraints of a single-instance
Railway deployment. In-memory counters are preferred over external stores (Redis, DB writes) for
rate limiting unless horizontal scaling is explicitly introduced. New external services MUST NOT be
added without a justification entry in the plan's Complexity Tracking section.

YAGNI applies strictly: no abstractions for hypothetical future requirements, no backwards-
compatibility shims, no over-engineering of patterns that serve one instance. Three similar lines of
code are preferable to a premature abstraction.

**Rationale**: Who's Next is a lightweight application. Complexity must be earned by real constraints,
not anticipated ones. The accepted limitation (rate-limit counters reset on restart; no horizontal
scaling) is documented in the PRD and must not be silently "fixed" by introducing infrastructure.

## Data & API Conventions

- All API request and response shapes MUST be defined as TypeScript interfaces in the `shared`
  package. Frontend and backend MUST NOT define duplicate DTO types.
- All API responses MUST use camelCase field names.
- Rotation slugs MUST be 8-character base-58 strings generated with a CSPRNG (~47 bits of entropy).
- Input caps enforced at the API layer (hard limits, not warnings):
  - Rotation name: max 100 characters
  - Member name: max 100 characters
  - Members per rotation: max 100
  - Custom dates per rotation: max 500
- Inactivity expiry: rotations not accessed in 12 months MUST be automatically deleted. The UI MUST
  display a warning 30 days before a rotation reaches its expiry date.

## Development & Quality Standards

- **Testing stack**: Vitest for unit and integration tests (frontend and backend); Playwright +
  axe-core for e2e and accessibility tests. Accessibility failures are test failures.
- **Assignment algorithm**: The queue-to-occurrence assignment function MUST be implemented as a
  pure, side-effect-free function. It takes the ordered member queue and a list of occurrence dates
  and returns the full assignment sequence. It MUST be independently testable with no database or
  HTTP dependency.
- **Design system**: Angular Material (Material 3 theme). All UI components MUST be sourced from
  Angular Material or be custom components conforming to the Material 3 specification.
- **Internationalisation**: i18n is included from the first deliverable. Dutch and English are the
  initial supported languages. String literals MUST NOT be hardcoded in templates or components.
- **Dockerization**: The dev environment MUST be fully Dockerized. All components share a single
  base image with per-component multi-stage build targets. A single `docker-compose.yml` at repo
  root orchestrates the full local stack including PostgreSQL 16.

## Governance

This constitution supersedes all conflicting practices and conventions in the project. Every
`plan.md` generated by `/speckit-plan` MUST include a Constitution Check section that references
these principles by Roman numeral (I–V) and confirms compliance or documents justified exceptions
before Phase 0 research begins.

Amendments require:
1. Updating this file with a version bump per semantic versioning:
   - MAJOR: backward-incompatible principle removal or redefinition
   - MINOR: new principle or section added
   - PATCH: clarification, wording, or non-semantic refinement
2. Updating the `Last Amended` date.
3. Propagating changes to affected `.specify/templates/` files.
4. Documenting the change in the Sync Impact Report HTML comment at the top of this file.

**Version**: 1.0.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15
