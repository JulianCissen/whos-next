import { Migration } from '@mikro-orm/migrations';

export class Migration20260418000001Rotations extends Migration {
  override up(): void {
    this.addSql(`
      CREATE TABLE "rotations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT NOW(),
        "updated_at" timestamptz NOT NULL DEFAULT NOW(),
        "last_accessed_at" timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT "rotations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "rotations_name_length_chk" CHECK (char_length("name") BETWEEN 1 AND 100),
        CONSTRAINT "rotations_slug_length_chk" CHECK (char_length("slug") = 8)
      );
    `);
    this.addSql(`CREATE UNIQUE INDEX "rotations_slug_uniq" ON "rotations" ("slug");`);
  }

  override down(): void {
    this.addSql(`DROP TABLE "rotations";`);
  }
}
