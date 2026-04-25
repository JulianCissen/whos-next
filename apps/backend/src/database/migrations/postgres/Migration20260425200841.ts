import { Migration } from '@mikro-orm/migrations';

export class Migration20260425200841 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "rotations" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "slug" varchar(255) not null, "name" varchar(255) not null, "last_accessed_at" timestamptz not null, "next_index" int not null default 0, primary key ("id"));`,
    );
    this.addSql(`alter table "rotations" add constraint "rotations_slug_unique" unique ("slug");`);

    this.addSql(
      `create table "members" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "rotation_id" uuid not null, "name" varchar(255) not null, "position" int null, "removed_at" timestamptz null, primary key ("id"));`,
    );

    this.addSql(
      `create table "occurrence_assignments" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "rotation_id" uuid not null, "occurrence_date" date not null, "member_id" uuid not null, "skip_type" varchar(255) null, primary key ("id"));`,
    );

    this.addSql(
      `create table "schedules" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "rotation_id" uuid not null, "type" varchar(255) not null, "rrule_type" varchar(255) null, "day_of_week" int null, "interval_n" int null, "monthly_day" int null, "start_date" date null, primary key ("id"));`,
    );

    this.addSql(
      `create table "schedule_dates" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "schedule_id" uuid not null, "date" date not null, primary key ("id"));`,
    );

    this.addSql(
      `alter table "members" add constraint "members_rotation_id_foreign" foreign key ("rotation_id") references "rotations" ("id");`,
    );

    this.addSql(
      `alter table "occurrence_assignments" add constraint "occurrence_assignments_rotation_id_foreign" foreign key ("rotation_id") references "rotations" ("id");`,
    );
    this.addSql(
      `alter table "occurrence_assignments" add constraint "occurrence_assignments_member_id_foreign" foreign key ("member_id") references "members" ("id");`,
    );

    this.addSql(
      `alter table "schedules" add constraint "schedules_rotation_id_foreign" foreign key ("rotation_id") references "rotations" ("id");`,
    );

    this.addSql(
      `alter table "schedule_dates" add constraint "schedule_dates_schedule_id_foreign" foreign key ("schedule_id") references "schedules" ("id");`,
    );
  }
}
