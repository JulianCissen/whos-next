# Quickstart — Rotation Lifecycle

This quickstart walks a developer through exercising the rotation lifecycle feature end-to-end, once implemented.

## Prerequisites

- Docker Desktop / Docker Engine running.
- Repository cloned and `pnpm install` completed at the monorepo root.
- `.env` present (copy from `.env.example` if not).

## 1. Bring up the dev stack

```sh
./dev.sh fresh
```

This rebuilds containers, starts PostgreSQL 16, and launches the backend (port 3000) and frontend (port 4200) in watch mode. The `packages-watcher` service keeps `packages/shared/dist/` in sync.

Once healthy:

```sh
curl http://localhost:3000/health
# -> {"status":"ok","database":"connected"}
```

The backend's `start:docker` script runs `mikro-orm migration:up` on boot, so the `rotations` table is created automatically.

## 2. Seed sample rotations (optional)

```sh
pnpm --filter @whos-next/backend exec mikro-orm seeder:run
```

Creates six rotations covering the name-variety test matrix (emoji, non-Latin, max-length, etc. — see `data-model.md §Seed data`).

## 3. Exercise via the UI

Open `http://localhost:4200/`. You should see the landing page with a single form field ("Rotation name") and a "Create" button.

**3a. Create** — Enter `Dish duty` and click Create. The app navigates to `http://localhost:4200/<slug>` (e.g., `/2aB9xPqR`). A banner at the top of the page shows the full URL and a copy-to-clipboard button.

**3b. Reload the rotation** — Refresh the page. The rotation still loads, but the share banner is no longer shown (FR-006).

**3c. Rename** — Click the rotation name. An inline text field appears; change the name to `Dish rota` and press Enter. The heading updates immediately.

**3d. Delete** — Click the overflow menu in the top right, select Delete. A dialog opens asking you to type the rotation's current name (`Dish rota`) to confirm. The Delete button stays disabled until the typed value matches exactly.

After confirming, the app navigates back to the landing page and a toast at the bottom announces "Rotation 'Dish rota' was deleted."

**3e. Not found** — Paste the deleted rotation's URL into the address bar. You see the "Rotation not found" page. The same page is shown for a made-up slug like `/ZZZZZZZZ` and for a malformed slug like `/hello`.

## 4. Exercise via the API

```sh
# Create
curl -X POST http://localhost:3000/api/rotations \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dish duty"}'
# -> 201 {"slug":"2aB9xPqR","name":"Dish duty","createdAt":"...","updatedAt":"..."}

SLUG=2aB9xPqR   # replace with the slug you got

# Get
curl http://localhost:3000/api/rotations/$SLUG
# -> 200 {...}

# Rename
curl -X PATCH http://localhost:3000/api/rotations/$SLUG \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dish rota"}'
# -> 200 {"name":"Dish rota", ...}

# Delete
curl -X DELETE http://localhost:3000/api/rotations/$SLUG
# -> 204

# Subsequent GET
curl -i http://localhost:3000/api/rotations/$SLUG
# -> 404 {"statusCode":404,"error":"ROTATION_NOT_FOUND","message":"..."}
```

The full Bruno collection lives at `apps/backend/bruno/rotations/` and can be opened in the Bruno desktop app for an interactive view of each request and its expected response shape.

## 5. Run the test suites

```sh
# Backend unit + integration (Vitest + Testcontainers)
pnpm --filter @whos-next/backend run test

# Frontend unit + component
pnpm --filter @whos-next/frontend run test

# E2E + accessibility (Playwright + axe-core)
pnpm --filter @whos-next/e2e run test
```

Sign-off checklist before merging (per root `CLAUDE.md`):

1. Zero TypeScript errors across all affected packages.
2. Zero ESLint errors and warnings across all affected files.
3. Zero axe-core violations reported by `a11y.spec.ts`.

## 6. Verify the acceptance criteria

Map the four user stories in `spec.md` to the Playwright specs:

| User Story | E2E file |
|---|---|
| US1 — Create and share | `rotation-create.spec.ts` |
| US2 — Access via link (incl. not-found) | `rotation-view.spec.ts` |
| US3 — Rename | `rotation-rename.spec.ts` |
| US4 — Delete | `rotation-delete.spec.ts` |

Each spec asserts its story's acceptance scenarios literally. A green run of `pnpm --filter @whos-next/e2e run test` is sufficient acceptance evidence for this feature.
