import { Migration } from '@mikro-orm/migrations';

export class Migration20260425200920 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`rotations\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`slug\` text not null, \`name\` text not null, \`last_accessed_at\` datetime not null, \`next_index\` integer not null default 0);`,
    );
    this.addSql(`create unique index \`rotations_slug_unique\` on \`rotations\` (\`slug\`);`);

    this.addSql(
      `create table \`members\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`rotation_id\` text not null, \`name\` text not null, \`position\` integer null, \`removed_at\` datetime null, constraint \`members_rotation_id_foreign\` foreign key (\`rotation_id\`) references \`rotations\` (\`id\`));`,
    );
    this.addSql(`create index \`members_rotation_id_index\` on \`members\` (\`rotation_id\`);`);

    this.addSql(
      `create table \`occurrence_assignments\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`rotation_id\` text not null, \`occurrence_date\` date not null, \`member_id\` text not null, \`skip_type\` text null, constraint \`occurrence_assignments_rotation_id_foreign\` foreign key (\`rotation_id\`) references \`rotations\` (\`id\`), constraint \`occurrence_assignments_member_id_foreign\` foreign key (\`member_id\`) references \`members\` (\`id\`));`,
    );
    this.addSql(
      `create index \`occurrence_assignments_rotation_id_index\` on \`occurrence_assignments\` (\`rotation_id\`);`,
    );
    this.addSql(
      `create index \`occurrence_assignments_member_id_index\` on \`occurrence_assignments\` (\`member_id\`);`,
    );

    this.addSql(
      `create table \`schedules\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`rotation_id\` text not null, \`type\` text not null, \`rrule_type\` text null, \`day_of_week\` integer null, \`interval_n\` integer null, \`monthly_day\` integer null, \`start_date\` date null, constraint \`schedules_rotation_id_foreign\` foreign key (\`rotation_id\`) references \`rotations\` (\`id\`));`,
    );
    this.addSql(`create index \`schedules_rotation_id_index\` on \`schedules\` (\`rotation_id\`);`);

    this.addSql(
      `create table \`schedule_dates\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`schedule_id\` text not null, \`date\` date not null, constraint \`schedule_dates_schedule_id_foreign\` foreign key (\`schedule_id\`) references \`schedules\` (\`id\`));`,
    );
    this.addSql(
      `create index \`schedule_dates_schedule_id_index\` on \`schedule_dates\` (\`schedule_id\`);`,
    );
  }
}
