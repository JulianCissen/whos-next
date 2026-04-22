import type { EntityManager } from '@mikro-orm/core';

import { generateSlug } from '../src/common/slug/slug.generator.js';
import { Member } from '../src/members/member.entity.js';
import { Rotation } from '../src/rotations/rotation.entity.js';

interface MemberSeed {
  name: string;
  removedAt?: Date;
}

interface RotationSeed {
  name: string;
  members: MemberSeed[];
}

const ROTATION_SEEDS: RotationSeed[] = [
  {
    name: 'Dish duty',
    members: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
  },
  {
    name: 'Standup host',
    members: [
      { name: 'Dave' },
      { name: 'Eve' },
      { name: 'Frank' },
      { name: 'Grace' },
      { name: 'Hank' },
    ],
  },
  {
    name: 'Birthday cake',
    members: [{ name: 'Iris' }],
  },
  {
    name: 'Fika-waarde',
    members: [{ name: 'Jess' }, { name: 'Karl' }, { name: 'Lena', removedAt: new Date() }],
  },
  {
    name: '金曜ビール',
    members: [{ name: 'Mio' }, { name: 'Naoki' }, { name: 'Oka' }, { name: 'Pita' }],
  },
  {
    name: 'A'.repeat(100),
    members: [],
  },
];

export async function seedMembers(em: EntityManager): Promise<void> {
  for (const seed of ROTATION_SEEDS) {
    const rotation = new Rotation();
    rotation.slug = generateSlug();
    rotation.name = seed.name;
    rotation.lastAccessedAt = new Date();
    em.persist(rotation);

    let positionCounter = 0;
    for (const memberSeed of seed.members) {
      const isActive = memberSeed.removedAt === undefined;
      const member = new Member();
      member.rotation = rotation;
      member.name = memberSeed.name;
      member.removedAt = memberSeed.removedAt ?? null;
      if (isActive) {
        positionCounter += 1;
        member.position = positionCounter;
      } else {
        member.position = null;
      }
      em.persist(member);
    }
  }

  await em.flush();
}
