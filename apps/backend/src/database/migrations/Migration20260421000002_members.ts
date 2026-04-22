import { Migration } from '@mikro-orm/migrations';

export class Migration20260421000002Members extends Migration {
  override up(): void {
    this.addSql(`ALTER TABLE "rotations" ADD COLUMN "next_index" integer NOT NULL DEFAULT 0;`);

    this.addSql(`
      CREATE TABLE "members" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "rotation_id" uuid        NOT NULL REFERENCES "rotations"("id") ON DELETE CASCADE,
        "name"        text        NOT NULL,
        "position"    integer,
        "removed_at"  timestamptz,
        "created_at"  timestamptz NOT NULL DEFAULT NOW(),
        "updated_at"  timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "members_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "members_name_length_chk" CHECK (char_length("name") BETWEEN 1 AND 100),
        CONSTRAINT "members_position_positive_chk" CHECK ("position" IS NULL OR "position" >= 1)
      );
    `);
    this.addSql(`
      CREATE UNIQUE INDEX "members_rotation_position_uniq"
        ON "members" ("rotation_id", "position")
        WHERE "removed_at" IS NULL;
    `);
    this.addSql(`CREATE INDEX "members_rotation_id_idx" ON "members" ("rotation_id");`);

    this.addSql(`
      CREATE TABLE "occurrence_assignments" (
        "id"              uuid        NOT NULL DEFAULT gen_random_uuid(),
        "rotation_id"     uuid        NOT NULL REFERENCES "rotations"("id") ON DELETE CASCADE,
        "occurrence_date" date        NOT NULL,
        "member_id"       uuid        NOT NULL REFERENCES "members"("id"),
        "created_at"      timestamptz NOT NULL DEFAULT NOW(),
        "updated_at"      timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "occurrence_assignments_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "occurrence_assignments_rotation_date_uniq" UNIQUE ("rotation_id", "occurrence_date")
      );
    `);
    this.addSql(`
      CREATE INDEX "occurrence_assignments_rotation_id_idx"
        ON "occurrence_assignments" ("rotation_id");
    `);
  }

  override down(): void {
    this.addSql(`DROP TABLE IF EXISTS "occurrence_assignments";`);
    this.addSql(`DROP TABLE IF EXISTS "members";`);
    this.addSql(`ALTER TABLE "rotations" DROP COLUMN IF EXISTS "next_index";`);
  }
}
