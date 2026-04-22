import { defineEntity, p } from '@mikro-orm/core';

import { BaseEntity } from '../common/base-entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { Member } from './member.entity.js';

export const OccurrenceAssignmentSchema = defineEntity({
  name: 'OccurrenceAssignment',
  tableName: 'occurrence_assignments',
  extends: BaseEntity,
  properties: {
    rotation: p.manyToOne(Rotation).joinColumn('rotation_id'),
    occurrenceDate: p.date(),
    member: p.manyToOne(Member).joinColumn('member_id'),
  },
});

export class OccurrenceAssignment extends BaseEntity {
  declare rotation: Rotation;
  declare occurrenceDate: string;
  declare member: Member;
}

OccurrenceAssignmentSchema.setClass(OccurrenceAssignment);

// Re-export so MikroORM entity discovery picks up BaseEntitySchema when scanning this file
export { BaseEntity, BaseEntitySchema } from '../common/base-entity.js';
