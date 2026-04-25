import { defineEntity, p } from '@mikro-orm/core';

import { validateRotationName } from '@whos-next/shared';

import { BaseEntity } from '../common/base-entity.js';

// Re-export so MikroORM entity discovery picks up BaseEntitySchema when scanning this file

export const RotationSchema = defineEntity({
  name: 'Rotation',
  tableName: 'rotations',
  extends: BaseEntity,
  properties: {
    slug: p.string().unique(),
    name: p.string(),
    lastAccessedAt: p.datetime().onCreate(() => new Date()),
    nextIndex: p.integer().default(0),
  },
});

export class Rotation extends BaseEntity {
  declare slug: string;
  declare name: string;
  declare lastAccessedAt: Date;
  declare nextIndex: number;

  rename(newName: string): void {
    const result = validateRotationName(newName);
    if (!result.ok) {
      throw new Error(result.reason);
    }
    this.name = result.value;
  }

  touchAccess(): boolean {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.lastAccessedAt < threshold;
  }
}

RotationSchema.setClass(Rotation);

export { BaseEntitySchema, BaseEntity } from '../common/base-entity.js';
