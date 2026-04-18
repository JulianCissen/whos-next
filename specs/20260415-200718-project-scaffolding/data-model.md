# Data Model: Project Scaffolding (Unit 0)

*Phase 1 output. Unit 0 introduces zero feature entities. This document captures the DTO boundary established in `shared` and the MikroORM baseline migration state.*

---

## Scope

Unit 0 contains no application data entities. The database exists as an empty, migrated PostgreSQL 16 instance. The `shared` package establishes the DTO pattern that all future units will follow.

---

## Shared Package — Established DTOs

### `HealthResponseDto`

The only DTO in this unit. Represents the backend's health check response shape.

```typescript
// shared/src/health/health-response.dto.ts

export interface HealthResponseDto {
  /** Always "ok" when the response is 200. */
  status: 'ok';
  /** Confirms the PostgreSQL connection is alive. */
  database: 'connected';
}
```

**Re-exported from** `shared/src/index.ts`:
```typescript
export * from './health/health-response.dto';
```

**Consumed by**:
- `backend`: `HealthController` return type annotation
- `frontend`: Not consumed in Unit 0 (health check is backend-only for now)

---

## Migration State

### Migration `Migration20260415000000_init`

**File**: `backend/src/database/migrations/Migration20260415000000_init.ts`

**Type**: Empty baseline — no DDL statements. Its purpose is to seed the MikroORM migration history table (`mikro_orm_migrations`) so that `migration:up` succeeds on a fresh database.

```typescript
import { Migration } from '@mikro-orm/migrations';

export class Migration20260415000000_init extends Migration {
  async up(): Promise<void> {
    // Initial baseline — no schema yet. Feature tables are added in subsequent units.
  }

  async down(): Promise<void> {
    // Nothing to revert.
  }
}
```

**Post-migration DB state**:
```
public schema (empty — no feature tables)
mikro_orm_migrations (1 row: Migration20260415000000_init)
```

---

## Translation Key Schema

Translation JSON files in `frontend/src/assets/i18n/` define the i18n surface. All keys used in templates must exist in both files.

### `en.json`
```json
{
  "app": {
    "title": "Who's Next",
    "tagline": "Track who's up next in your rotation."
  },
  "nav": {
    "home": "Home"
  },
  "language": {
    "switch_to_dutch": "Nederlands",
    "switch_to_english": "English"
  }
}
```

### `nl.json`
```json
{
  "app": {
    "title": "Wie is er aan de beurt?",
    "tagline": "Bijhouden wie er volgende is in jouw rotatie."
  },
  "nav": {
    "home": "Home"
  },
  "language": {
    "switch_to_dutch": "Nederlands",
    "switch_to_english": "English"
  }
}
```

**Rule**: Adding a new UI string always requires entries in both `en.json` and `nl.json`. No template may use a string literal directly (FR-006, FR-007).

---

## Entity Inventory (Future Units)

| Unit | Entity | Package |
|------|--------|---------|
| 1 | `Rotation` | backend / shared |
| 1 | `Member` | backend / shared |
| 1 | `Schedule` | backend / shared |
| 2 | `Occurrence` | backend / shared |
| 2 | `Assignment` | backend / shared |
| 3 | `Skip` | backend / shared |

*These are tracked here for planning visibility. None exist in Unit 0.*
