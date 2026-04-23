import { Migration } from '@mikro-orm/migrations';

export class Migration20260422000003Schedule extends Migration {
  override up(): void {
    this.addSql(`
      CREATE TABLE "schedules" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "rotation_id" UUID        NOT NULL REFERENCES "rotations"("id") ON DELETE CASCADE,
        "type"        TEXT        NOT NULL CHECK ("type" IN ('recurrence_rule', 'custom_date_list')),
        "rrule_type"  TEXT                 CHECK ("rrule_type" IN ('weekly', 'every_n_weeks', 'monthly')),
        "day_of_week" SMALLINT             CHECK ("day_of_week" BETWEEN 1 AND 7),
        "interval_n"  SMALLINT             CHECK ("interval_n" >= 2),
        "monthly_day" SMALLINT             CHECK ("monthly_day" BETWEEN 1 AND 31),
        "start_date"  DATE,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "schedules_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "schedules_rotation_id_unique" UNIQUE ("rotation_id")
      );
    `);

    this.addSql(`
      CREATE TABLE "schedule_dates" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "schedule_id" UUID        NOT NULL REFERENCES "schedules"("id") ON DELETE CASCADE,
        "date"        DATE        NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "schedule_dates_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "schedule_dates_schedule_date_unique" UNIQUE ("schedule_id", "date")
      );
    `);

    this.addSql(
      `CREATE INDEX "schedule_dates_schedule_id_idx" ON "schedule_dates" ("schedule_id");`,
    );
  }

  override down(): void {
    this.addSql(`DROP TABLE IF EXISTS "schedule_dates";`);
    this.addSql(`DROP TABLE IF EXISTS "schedules";`);
  }
}
