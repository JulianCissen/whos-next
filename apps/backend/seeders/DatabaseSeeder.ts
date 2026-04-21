import type { EntityManager } from '@mikro-orm/core';

import { seedRotations } from './RotationSeeder.js';

export async function seed(em: EntityManager): Promise<void> {
  await seedRotations(em);
}
