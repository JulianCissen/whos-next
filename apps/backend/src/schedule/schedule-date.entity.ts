import { defineEntity, p } from '@mikro-orm/core';

import { BaseEntity } from '../common/base-entity.js';

import { Schedule } from './schedule.entity.js';

export const ScheduleDateSchema = defineEntity({
  name: 'ScheduleDate',
  tableName: 'schedule_dates',
  extends: BaseEntity,
  properties: {
    schedule: p.manyToOne(Schedule).joinColumn('schedule_id'),
    date: p.date(),
  },
});

export class ScheduleDate extends BaseEntity {
  declare schedule: Schedule;
  declare date: string;
}

ScheduleDateSchema.setClass(ScheduleDate);

export { BaseEntity, BaseEntitySchema } from '../common/base-entity.js';
