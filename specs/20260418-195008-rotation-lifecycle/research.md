# Phase 0 Research — Rotation Lifecycle

**Feature**: Rotation Lifecycle (Create, Rename, Delete)
**Date**: 2026-04-18

This document resolves technology and implementation-strategy questions that the spec deliberately left open. Each entry follows the *Decision / Rationale / Alternatives considered* format.

---

## R-1. Base-58 slug generation

**Decision**: Implement a small in-repo generator using Node's `node:crypto.randomBytes` with rejection sampling over the Bitcoin base-58 alphabet (`123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`). Generate 8 characters per call; over-sample bytes and reject any byte `b` where `b >= 58 * Math.floor(256 / 58)` (i.e. `b >= 232`) to avoid modulo bias. No third-party base-58 library.

**Rationale**:
- The entire implementation is ~20 lines and stays inside Constitution V (no speculative deps).
- Rejection sampling over a 58-symbol alphabet discards on average ~9.4% of bytes; generating 16 random bytes yields > 8 usable symbols with probability > 99.99999%. A single `randomBytes(16)` call per attempt is sufficient.
- Using `randomBytes` (CSPRNG) satisfies FR-008. General-purpose PRNGs (`Math.random`) are explicitly prohibited by the spec.

**Alternatives considered**:
- `bs58` npm package: adds a dep for ~20 lines of code; also oriented towards binary-to-string encoding (fixed input bytes), not uniform random symbol generation. Rejected on Constitution V grounds.
- `nanoid` with a custom alphabet: perfectly viable and ~identical entropy profile, but adds a dependency whose only use is this single call site. Rejected on the same grounds.
- Modulo-bias approach (`b % 58`) without rejection: produces slight non-uniformity (symbols `0`–`17` have a 5/256 probability vs `18`–`57`'s 4/256). Negligible security impact at 58^8 entropy, but trivially avoidable. Rejected because rejection sampling costs nothing.

---

## R-2. Collision detection and retry

**Decision**: Apply a PostgreSQL `UNIQUE` constraint on `rotations.slug`. On `INSERT`, if a unique-constraint violation is raised (MikroORM `UniqueConstraintViolationException`), regenerate the slug and retry up to **5 attempts** total. After the 5th failure, return HTTP 500 with a logged error (this is effectively impossible given 58^8 space vs realistic load but must be handled deterministically).

**Rationale**:
- DB-level uniqueness is the authoritative check — it is race-free across concurrent `INSERT`s, which an application-level "SELECT then INSERT" check is not.
- 5 retries: at 10,000 existing rotations, collision probability per attempt ≈ 10,000 / 58^8 ≈ 7.8 × 10⁻¹¹. Five retries thus have a failure probability of ~(7.8 × 10⁻¹¹)⁵ ≈ 0 — the cap is purely defensive against unanticipated table growth and avoids an unbounded loop.
- MikroORM 7 surfaces unique-violation errors via typed exceptions; no raw SQLSTATE parsing needed.

**Alternatives considered**:
- Application-level pre-check (`SELECT ... WHERE slug = ?` then `INSERT`): suffers a classic TOCTOU race under concurrent creation. Rejected.
- Single attempt with fail-fast: gives a worse user experience for zero real benefit, since retry cost is negligible.
- Maintain a separate "reserved/deleted slugs" set: PRD's security model does not require non-reuse of deleted slugs, and FR-011 explicitly accepts the negligible collision probability. Rejected as speculative infrastructure (Constitution V).

---

## R-3. Name validation (control chars, Unicode, trimming)

**Decision**:
- Trim leading/trailing whitespace (JavaScript `.trim()`, which removes Unicode whitespace per ECMAScript spec) before any other validation.
- Reject if the trimmed length is 0 or > 100 (UTF-16 code-unit count, matching `String.prototype.length`). This aligns with PRD §5.2 and FR-003.
- Reject any string containing C0 or C1 control characters, tested with the regex `/[\u0000-\u001F\u007F-\u009F]/`. Newlines (`\n`, `\r`) fall into this range and are thus rejected.
- All other printable Unicode (including emoji and non-Latin scripts) is accepted. No normalization (NFC/NFD) is performed at validation time; the input is stored verbatim after trimming.

**Rationale**:
- Using `.trim()` + length on code units is idiomatic and predictable; measuring "grapheme clusters" is overkill for a 100-char display-name cap and introduces a dep (`Intl.Segmenter` is available but inconsistent in test runners).
- Rejecting control characters prevents subtle UI breakage (names splitting across lines in layouts) and simplifies the "single-line display string" contract.
- Skipping Unicode normalization avoids surprising round-trip transformations. Duplicate names are allowed anyway (FR — two rotations may share a name), so canonical equivalence is irrelevant here.

**Alternatives considered**:
- Normalize to NFC on save: silently rewrites user input (e.g., `café` entered as `cafe\u0301` becomes `café\u00e9`). Surprising and unnecessary. Rejected.
- Limit by grapheme cluster count using `Intl.Segmenter`: more "correct" for user perception but complicates server validation and parity with `class-validator`'s `@MaxLength` decorator, which operates on `.length`. Rejected for v1.

---

## R-4. Validation layering — `class-validator` (backend) and shared validators (frontend)

**Decision**:
- Declare the canonical constraint in `packages/shared/src/rotations/index.ts` as a pair of constants (`ROTATION_NAME_MIN_LENGTH = 1`, `ROTATION_NAME_MAX_LENGTH = 100`) and a `validateRotationName(input: string): { ok: true; value: string } | { ok: false; reason: string }` function.
- Backend DTOs use `class-validator` decorators (`@IsString`, `@MinLength(1)`, `@MaxLength(100)`, `@Matches(/^[^\u0000-\u001F\u007F-\u009F]*$/)`) on a `CreateRotationDto` / `RenameRotationDto`. The service additionally runs `validateRotationName` after trimming to guarantee identical semantics with the frontend.
- Frontend forms call `validateRotationName` on input blur / submit to render the same error message the backend would return.

**Rationale**:
- Two layers of validation — `ValidationPipe` at the DTO boundary *and* explicit validation inside the service — defend against DTO-bypass scenarios (tests instantiating the service directly) and keep the service unit-testable without Nest lifecycle.
- Centralising the function in `shared/` satisfies Constitution I and keeps frontend/backend error copy aligned for SC-004.

**Alternatives considered**:
- Backend-only validation: frontend submits, sees error, rerenders. Fine functionally, but doubles the round-trip count for the common case and makes the UX sluggish on slow networks. Rejected.
- Frontend-only validation: trusts client-side checks, an obvious security anti-pattern. Rejected.

---

## R-5. Slug URL encoding and routing

**Decision**:
- The shareable URL is `<origin>/<slug>` (e.g., `https://whosnext.app/2aB9xPqR`). The slug occupies the path segment directly with no prefix.
- Angular Router declares a catch-all `:slug` route that validates the segment against `/^[1-9A-HJ-NP-Za-km-z]{8}$/` in a `canMatch` guard; a non-matching URL falls through to a `'**'` → `NotFoundComponent` route.
- Backend API paths are `/api/rotations` (POST create) and `/api/rotations/:slug` (GET/PATCH/DELETE). The `:slug` param is validated at the DTO layer with the same regex.

**Rationale**:
- Bare-slug URLs are more shareable ("whosnext.app/2aB9xPqR" > "whosnext.app/r/2aB9xPqR") and satisfy "zero onboarding friction".
- A `canMatch` guard performs the regex check before the lazy route loads, meeting FR-014 ("reject malformed slugs as not-found without a data store lookup"). On the backend, a `class-validator` `@Matches` decorator ensures the controller method is never invoked with an invalid slug.

**Alternatives considered**:
- Prefix the URL with `/r/` (e.g., `/r/2aB9xPqR`): reserves the root for future non-rotation pages. Marginal benefit for v1 where the root is the create screen. Rejected for simplicity; can be introduced later without breaking the API contract (only the frontend route pattern changes).

---

## R-6. Last-access timestamp throttle mechanism

**Decision**: Update `last_accessed_at` at most once per rotation per 24-hour window using a conditional SQL `UPDATE`:

```sql
UPDATE rotations
   SET last_accessed_at = NOW()
 WHERE slug = $1
   AND last_accessed_at < NOW() - INTERVAL '24 hours';
```

This is executed as a fire-and-forget side effect after every successful read or write. Failures are logged but do not fail the originating request (FR-026).

**Rationale**:
- Single round-trip, race-free, no cache or scheduler needed. The `WHERE` clause discards the update when the window hasn't elapsed, so the row's `updated_at` column (which tracks mutations, not reads) is not touched.
- Honors Constitution V — no Redis, no in-memory map, no background sweeper.
- The update is idempotent and atomic; concurrent reads triggering simultaneous updates are harmless (worst case: one "wins" the write, others no-op).

**Alternatives considered**:
- In-memory cache of "last written" per slug + periodic flush: fails on restart (same tradeoff as rate limits), but adds a flush scheduler and lifecycle concerns. Rejected.
- Read the row first, then decide to write: two round-trips, TOCTOU window, no benefit. Rejected.
- Skip throttling entirely (every read updates): every GET triggers a write. At expected load (< 50 RPS) this is fine but still unnecessarily chatty and burns WAL. Rejected — the conditional update costs almost nothing.

---

## R-7. Typed-name delete confirmation — UX and accessibility

**Decision**: Implement the delete confirmation as an Angular Material `MatDialog` component containing:
1. A `<h2 mat-dialog-title>` with the text "Delete '<name>' permanently?".
2. A `<mat-dialog-content>` with (a) a warning paragraph ("This action cannot be undone. All data for this rotation will be permanently removed."), and (b) a `<mat-form-field>` wrapping an `<input matInput>` labeled "Type the rotation name to confirm:", with `aria-describedby` pointing to the warning paragraph's `id`.
3. A `<mat-dialog-actions>` with a "Cancel" button (default focus) and a "Delete" button whose `[disabled]` binding is `typedValue.trim() !== rotation.name`.

**Rationale**:
- Material 3 `MatDialog` is the only WCAG 2.2 AA-compliant dialog primitive permitted by Constitution IV / PRD §6.2. It handles focus trap, Escape-to-close, and role=dialog automatically.
- Default-focusing Cancel makes the "oh crap" recovery (Escape or Enter) safe: the primary action is never the destructive one.
- Disabling Delete until the typed value matches prevents "press Enter to confirm" from destroying data — in addition to being a UX safeguard, this matches FR-020(d)'s explicit "no-op if unmatched" requirement.

**Alternatives considered**:
- Inline confirmation (no modal): harder to get focus management and screen-reader announcement right; also fights the established Angular Material pattern for irreversible actions. Rejected.
- `window.confirm()`: bypasses Material 3 entirely, is not themable, and cannot carry a typed-name input. Rejected on design-system grounds.

---

## R-8. Post-deletion toast / ARIA live region

**Decision**: Use Angular Material's `MatSnackBar` with default `politeness: 'polite'` and a 5-second duration. The snackbar uses `role="status"` + `aria-live="polite"` under the hood, which satisfies FR-023a without custom live-region wiring.

**Rationale**: `MatSnackBar` is the M3-conforming transient-notification component; it is already the first-party answer to "accessible toast" in the Angular Material library. Custom DIVs with `aria-live` attributes risk subtle announcer quirks (double-reads, missed reads on focus change).

**Alternatives considered**: Custom live region: more code, same behaviour, more risk. Rejected.

---

## R-9. Share-link banner — first-view detection

**Decision**: On successful creation, the frontend navigates to `/:slug` with `state: { justCreated: true }` via `Router.navigateByUrl`. The `RotationPage` inspects `history.state.justCreated` on mount; if true, it shows the `ShareLinkBanner` component and replaces `history.state` so reloads do not re-trigger it.

**Rationale**:
- Router state is the idiomatic Angular mechanism for one-shot post-navigation signals. It is automatic, avoids a query param (which would survive reloads and is spec-forbidden by the "subsequent visits do not show the banner" clause of FR-006), and requires no backend marker.
- Replacing `history.state` on read ensures a browser refresh drops the flag, matching "not shown on subsequent visits".

**Alternatives considered**:
- Query parameter `?justCreated=1`: survives reloads, must be explicitly stripped, makes the shared URL awkward if a creator copies the URL from the address bar before dismissing the banner. Rejected.
- LocalStorage flag keyed by slug: persists forever unless cleaned up; pointless state. Rejected.

---

## R-10. MikroORM entity definition style and `BaseEntity`

**Decision**: Introduce `apps/backend/src/common/base-entity.ts` using `defineEntity` with:
- `id`: UUID primary key, DB default `gen_random_uuid()`, app-level default `randomUUID()`, hidden from JSON (`hidden: true`) — internal only per FR-025.
- `createdAt`: `timestamptz`, DB default `NOW()`, app callback sets `new Date()` on create.
- `updatedAt`: `timestamptz`, DB default `NOW()`, app callbacks set `new Date()` on create and update.

The `Rotation` entity extends `BaseEntity` and adds `slug` (unique, indexed), `name`, `lastAccessedAt`.

**Rationale**: Matches RA §3.5 and PRD §7.5 verbatim. `gen_random_uuid()` requires the `pgcrypto` extension, which PostgreSQL 16 ships built-in (no `CREATE EXTENSION` needed — it's in the `pg_catalog` path by default on PG 13+).

**Alternatives considered**: Decorator-based entities (`@Entity`): explicitly forbidden by `backend/CLAUDE.md` §19. Rejected.

---

## R-11. Frontend HTTP client pattern — signals vs RxJS

**Decision**: Thin `RotationsApi` service wrapping `HttpClient` with methods returning `Observable<T>`. Components convert to signals via `toSignal()` at the consumption site. No facade, no NgRx store — the feature has no cross-component shared state beyond the currently-loaded rotation, which lives on the `RotationPage` component itself.

**Rationale**:
- `HttpClient` is RxJS-native; returning observables is least-surprise for Angular developers and lets components compose with `takeUntilDestroyed` and `switchMap` cleanly.
- Zoneless + OnPush requires explicit change-detection triggering; signals via `toSignal` provide that automatically.
- No store is warranted for ~4 API calls with no cross-feature sharing (Constitution V).

**Alternatives considered**:
- Return `Promise<T>` directly: works but forecloses RxJS composition for future features that will share the same services (e.g., queue management will need polling/SSE eventually). Rejected.
- NgRx / Signal Store: overkill; zero shared state. Rejected on Constitution V grounds.

---

## R-12. i18n — initial strings

**Decision**: Add a `rotation` namespace to `en.json` and `nl.json` under `apps/frontend/src/app/core/i18n/assets/`. All user-visible copy introduced by this feature goes through `@ngx-translate` — no hardcoded strings in templates or TS, per Constitution "Development & Quality Standards".

**Rationale**: Required by constitution and PRD §6.2. Adding the keys up-front is cheap; retrofitting later is painful.

**Alternatives considered**: None — the constitution mandates this.

---

## R-13. Bruno API collection

**Decision**: Add `apps/backend/bruno/rotations/` with one request per endpoint plus error variants:
- `create.bru` (201 happy path)
- `create-validation-error.bru` (400, empty name)
- `get.bru` (200)
- `get-not-found.bru` (404, random unknown slug)
- `rename.bru` (200)
- `rename-validation-error.bru` (400)
- `delete.bru` (204)

The existing `environments/local.bru` (from the scaffolding) provides `{{baseUrl}}`. No new environment file is needed.

**Rationale**: Matches PRD §7.7 exactly; requires no new infrastructure.

**Alternatives considered**: None.

---

## Summary — unknowns resolved

All Technical Context items in `plan.md` are now concrete (no remaining "NEEDS CLARIFICATION"). Ready to proceed to Phase 1.
