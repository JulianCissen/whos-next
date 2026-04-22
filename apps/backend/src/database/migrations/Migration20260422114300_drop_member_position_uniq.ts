import { Migration } from '@mikro-orm/migrations';

export class Migration20260422114300_drop_member_position_uniq extends Migration {
  override up(): void {
    this.addSql(`DROP INDEX IF EXISTS "members_rotation_position_uniq";`);
  }

  override down(): void {
    this.addSql(`
      CREATE UNIQUE INDEX "members_rotation_position_uniq"
        ON "members" ("rotation_id", "position")
        WHERE "removed_at" IS NULL;
    `);
  }
}
