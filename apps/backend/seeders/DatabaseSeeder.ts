import type { EntityManager } from '@mikro-orm/core';

import { seedMembers } from './MemberSeeder.js';
import { seedRotations } from './RotationSeeder.js';

export async function seed(em: EntityManager): Promise<void> {
  await seedRotations(em);
  await seedMembers(em);
}
