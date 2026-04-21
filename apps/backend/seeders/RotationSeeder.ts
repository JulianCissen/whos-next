import type { EntityManager } from '@mikro-orm/core';

import { generateSlug } from '../src/common/slug/slug.generator.js';
import { Rotation } from '../src/rotations/rotation.entity.js';

export async function seedRotations(em: EntityManager): Promise<void> {
  const names = ['Dish duty', 'Standup host', 'Code reviewer', 'Snack buyer'];
  for (const name of names) {
    const rotation = new Rotation();
    rotation.slug = generateSlug();
    rotation.name = name;
    rotation.lastAccessedAt = new Date();
    em.persist(rotation);
  }
  await em.flush();
}
