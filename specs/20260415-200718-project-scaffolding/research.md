# Research: Project Scaffolding (Unit 0)

*Phase 0 output — all NEEDS CLARIFICATION resolved before Phase 1 design.*

---

## R-01: Vitest for Angular 21

**Decision**: Use Angular CLI's native Vitest integration introduced in Angular 17–18 and fully mature by Angular 21. No third-party adapter (Analog plugin, NX executor) required for a standalone Angular app.

**How to apply**: `ng generate @angular/core:vitest` (or configure manually via `vite.config.ts` referenced in `angular.json` under `test.builder`). Angular 21 ships with Vitest support as the default new-project test runner.

**Rationale**: Simplest path — no extra packages, no framework overhead. Vitest is now part of the Angular toolchain proper.

**Alternatives considered**:
- `@analogjs/vite-plugin-angular`: Only needed if using the Analog meta-framework. Adds unnecessary coupling.
- NX + Vitest executor: Overkill for a non-NX monorepo.
- Jest (`@angular-builders/jest`): Constitution explicitly mandates Vitest.

---

## R-02: Angular i18n — Runtime Language Switching Without Reload

**Decision**: `@ngx-translate/core` v14+ with `@ngx-translate/http-loader` v7+.

**How to apply**: Register `TranslateModule.forRoot(...)` in `app.config.ts` using `HttpLoader` pointing to `/assets/i18n/{{lang}}.json`. Language switching: `translateService.use('nl')` — no reload. Translation JSON files at `src/assets/i18n/en.json` and `nl.json`. Use `{{ 'KEY' | translate }}` pipe in all templates (never hardcoded strings).

**Rationale**: Purpose-built for runtime switching with zero-reload language changes. Simpler setup than `@angular/localize` (which requires separate compile-time builds per locale and cannot switch without reload). Strong Angular Material compatibility.

**Alternatives considered**:
- `@angular/localize` (built-in): Compile-time only → requires separate builds per locale → violates the no-reload requirement.
- `@jsverse/transloco`: More powerful (lazy-loading, scoped translations, type-safe keys) but heavier setup. Upgrade path if >2 languages are added later.

---

## R-03: pnpm Workspace Hoisting Disable

**Decision**: Set `shamefully-hoist=false` in `.npmrc` at the repo root (this is pnpm's default, but made explicit). No `node-linker=isolated` needed — it introduces unnecessary performance cost and Docker compatibility issues.

**How to apply**:
```
# .npmrc
shamefully-hoist=false
```

Also set `public-hoist-pattern[]=''` in `.npmrc` to prevent *any* packages from being hoisted to the root `node_modules`, which ensures cross-package import boundaries are enforced at the Node resolution level.

**Rationale**: `shamefully-hoist=false` is sufficient to enforce explicit dependency declarations per package. Each package's own `node_modules` only contains what it declares. If `frontend` does not list `backend` as a dependency, Node resolution fails to resolve any `@whos-next/backend` import — this is the build-time boundary FR-002 requires.

**Alternatives considered**:
- `node-linker=isolated` (pnpm's strictest mode): Stronger isolation but causes issues with some Angular build tooling. Overkill given that dependency declarations already enforce the boundary.
- ESLint `no-restricted-imports`: Useful belt-and-suspenders addition in a future unit; not required for the build-time gate.

---

## R-04: Angular `ng serve` Hot Reload with Polling in Docker

**Decision**: Configure `"poll": 2000` in `angular.json` under the `serve` options for the development configuration.

**How to apply**:
```json
// angular.json — serve target
"serve": {
  "options": {
    "poll": 2000,
    "proxyConfig": "proxy.conf.json"
  }
}
```

**Rationale**: Angular's dev server uses chokidar for file watching, which defaults to native filesystem events. These events do not cross the Docker volume boundary on Windows and macOS hosts. A 2000 ms polling interval balances responsiveness against CPU overhead in a containerised dev setup.

**Alternatives considered**:
- `--poll=2000` CLI flag: Works but must be repeated in every start command. `angular.json` config is reproducible.
- Docker `delegated` volumes on macOS: Reduces the problem but does not eliminate it; polling is the reliable solution.

---

## R-05: NestJS Hot Reload with Polling in Docker

**Decision**: Set `CHOKIDAR_USEPOLLING=1` as an environment variable on the backend service in `docker-compose.yml`, alongside `nest start --watch`.

**How to apply**:
```yaml
# docker-compose.yml — backend service
environment:
  - CHOKIDAR_USEPOLLING=1
  - CHOKIDAR_INTERVAL=2000
command: ["nest", "start", "--watch"]
```

**Rationale**: NestJS's `--watch` mode uses chokidar internally. The `CHOKIDAR_USEPOLLING` env variable enables polling without modifying any config files. Works across Docker on all host OSes. No additional packages required.

**Alternatives considered**:
- `ts-node-dev --poll`: Requires replacing the NestJS CLI with a different runner; changes the DX.
- `nodemon --legacy-watch`: Additional package; less standard than leveraging NestJS's own watch mode.
- Webpack watch config in `nest-cli.json` (`poll: 1000`): Heavier build pipeline than SWC/tsc; increases rebuild latency.

---

## R-06: MikroORM 7 + NestJS 11 — Initial Empty Baseline Migration

**Decision**: Use `@mikro-orm/nestjs`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, and `@mikro-orm/cli`. Create the initial blank migration with `pnpm mikro-orm migration:create --blank`.

**Required packages** (backend):
```
@mikro-orm/core@7
@mikro-orm/nestjs@6
@mikro-orm/postgresql@7
@mikro-orm/migrations@7
@mikro-orm/cli@7
```

**Minimal `mikro-orm.config.ts`**:
```typescript
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  host: process.env.DB_HOST ?? 'localhost',
  port: 5432,
  dbName: process.env.DB_NAME ?? 'whosnext',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  extensions: [Migrator],
  migrations: {
    path: 'src/database/migrations',
    pathTs: 'src/database/migrations',
  },
});
```

**Generating the baseline migration**: Run `pnpm mikro-orm migration:create --blank` — this creates an empty up/down migration that can be committed and run via `pnpm mikro-orm migration:up` on a fresh database.

**Rationale**: MikroORM 7 is specified in PRD §7.1. Blank migration establishes the migration history from day one so `migration:up` is idempotent on any fresh DB.

**Alternatives considered**:
- TypeORM: Not specified in PRD/constitution.
- Running raw SQL schema: No migration history, violates the requirement that `migrate:up` works from day one.

---

## R-07: Playwright + axe-core Accessibility Testing

**Decision**: Use `@axe-core/playwright` (the official Playwright integration maintained by Deque).

**Required packages** (e2e):
```
@playwright/test
@axe-core/playwright
axe-core
```

**Minimal accessibility test**:
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('placeholder page has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

**Rationale**: `@axe-core/playwright` is the Deque-maintained official integration. `axe-playwright` (third-party) is an older alternative. `@axe-core/playwright` is more actively maintained and has Playwright-native types.

**Alternatives considered**:
- `axe-playwright` (npm): Less actively maintained; older API surface.
- Manual axe injection via `page.evaluate()`: Verbose; loses Playwright type integration.

---

## R-08: Docker Multi-Stage Base Image Strategy

**Decision**: Single `Dockerfile` at the repo root with a shared `base` stage (Node.js LTS + pnpm), then per-component stages (`frontend-dev`, `backend-dev`). `docker-compose.yml` targets the appropriate stage per service.

**Base stage**:
```dockerfile
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
```

**Dev stage pattern** (backend as example):
```dockerfile
FROM base AS backend-dev
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
RUN pnpm install --frozen-lockfile
COPY . .
```

**Rationale**: Shared base image means Node.js version and pnpm version updates propagate to all components in one change. Multi-stage keeps dev and prod images distinct. FR-004 explicitly requires this pattern.

---

## R-09: Cross-Package Import Boundary Enforcement

**Decision**: Rely on pnpm workspace dependency declarations as the primary enforcement mechanism. `frontend` and `backend` declare `@whos-next/shared` as a workspace dependency; neither declares the other. Node resolution cannot resolve imports from an undeclared package → build fails.

**How to apply**: In `frontend/package.json`:
```json
{
  "dependencies": {
    "@whos-next/shared": "workspace:*"
  }
}
```
`backend/package.json` mirrors this. `frontend` has no `@whos-next/backend` dependency → any attempt to `import from '@whos-next/backend'` fails at compile time (TypeScript cannot find the module).

**Rationale**: No configuration overhead; boundary is intrinsic to the dependency graph. No ESLint rule maintenance needed.

**Alternatives considered**:
- ESLint `no-restricted-imports`: Belt-and-suspenders; can be added in a future unit for explicit error messages.
- TypeScript `paths` with explicit denials: TypeScript has no native "deny" path alias; only additive mappings are possible.
