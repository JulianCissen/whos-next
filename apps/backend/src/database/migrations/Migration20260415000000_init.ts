import { Migration } from '@mikro-orm/migrations';

/**
 * Initial empty baseline migration.
 *
 * This migration creates no schema — its purpose is to seed the MikroORM
 * migration history table (`mikro_orm_migrations`) so that running
 * `migration:up` on a fresh database succeeds immediately without errors.
 *
 * All feature tables are introduced in subsequent units (Unit 1+).
 */
export class Migration20260415000000Init extends Migration {
  override async up(): Promise<void> {
    // Intentionally empty — no schema yet.
  }

  override async down(): Promise<void> {
    // Nothing to revert.
  }
}
