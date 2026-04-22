import { defineEntity, p } from '@mikro-orm/core';

import { BaseEntity } from '../common/base-entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

export const MemberSchema = defineEntity({
  name: 'Member',
  tableName: 'members',
  extends: BaseEntity,
  properties: {
    rotation: p.manyToOne(Rotation).joinColumn('rotation_id'),
    name: p.string(),
    position: p.integer().nullable(),
    removedAt: p.datetime().nullable(),
  },
});

export class Member extends BaseEntity {
  declare rotation: Rotation;
  declare name: string;
  declare position: number | null;
  declare removedAt: Date | null;

  get isActive(): boolean {
    return this.removedAt === null;
  }
}

MemberSchema.setClass(Member);

// Re-export so MikroORM entity discovery picks up BaseEntitySchema when scanning this file
export { BaseEntity, BaseEntitySchema } from '../common/base-entity.js';
