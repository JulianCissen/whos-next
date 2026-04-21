import { randomUUID } from 'node:crypto';

import { defineEntity, p } from '@mikro-orm/core';

export const BaseEntitySchema = defineEntity({
  name: 'BaseEntity',
  abstract: true,
  properties: {
    id: p
      .uuid()
      .primary()
      .hidden()
      .defaultRaw('gen_random_uuid()')
      .onCreate(() => randomUUID()),
    createdAt: p
      .datetime()
      .defaultRaw('NOW()')
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .defaultRaw('NOW()')
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export class BaseEntity extends BaseEntitySchema.class {
  declare id: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

BaseEntitySchema.setClass(BaseEntity);
