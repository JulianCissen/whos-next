import { defineEntity, p } from '@mikro-orm/core';

import { BaseEntity } from '../common/base-entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

export const ScheduleSchema = defineEntity({
  name: 'Schedule',
  tableName: 'schedules',
  extends: BaseEntity,
  properties: {
    rotation: p.manyToOne(Rotation).joinColumn('rotation_id'),
    type: p.string(),
    rruleType: p.string().nullable(),
    dayOfWeek: p.integer().nullable(),
    intervalN: p.integer().nullable(),
    monthlyDay: p.integer().nullable(),
    startDate: p.date().nullable(),
  },
});

export class Schedule extends BaseEntity {
  declare rotation: Rotation;
  declare type: string;
  declare rruleType: string | null;
  declare dayOfWeek: number | null;
  declare intervalN: number | null;
  declare monthlyDay: number | null;
  declare startDate: string | null;
}

ScheduleSchema.setClass(Schedule);

export { BaseEntity, BaseEntitySchema } from '../common/base-entity.js';
