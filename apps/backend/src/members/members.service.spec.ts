import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Rotation } from '../rotations/rotation.entity.js';

import { Member } from './member.entity.js';
import { MembersService } from './members.service.js';

function makeOrmMock(
  overrides: {
    rotation?: Rotation | null;
    activeMembers?: Member[];
    flush?: () => Promise<void>;
  } = {},
) {
  const rotation = overrides.rotation === undefined ? makeRotation() : overrides.rotation;
  const activeMembers = overrides.activeMembers ?? [];
  const em = {
    findOne: vi.fn().mockImplementation((_entity: unknown, _where: unknown) => {
      return Promise.resolve(rotation);
    }),
    find: vi.fn().mockResolvedValue(activeMembers),
    persist: vi.fn(),
    flush: vi.fn().mockImplementation(overrides.flush ?? (() => Promise.resolve())),
  };
  return {
    em: { fork: vi.fn().mockReturnValue(em) },
    _em: em,
  };
}

function makeRotation(overrides: Partial<Rotation> = {}): Rotation {
  const r = new Rotation();
  r.slug = overrides.slug ?? 'aBcDeFgH';
  r.name = overrides.name ?? 'Dish duty';
  r.nextIndex = overrides.nextIndex ?? 0;
  r.lastAccessedAt = overrides.lastAccessedAt ?? new Date('2026-01-01T00:00:00Z');
  r.createdAt = overrides.createdAt ?? new Date('2026-01-01T00:00:00Z');
  r.updatedAt = overrides.updatedAt ?? new Date('2026-01-01T00:00:00Z');
  return r;
}

function makeMember(position: number, overrides: Partial<Member> = {}): Member {
  const m = new Member();
  m.name = `Member ${position}`;
  m.position = position;
  m.removedAt = null;
  m.createdAt = new Date('2026-01-01T00:00:00Z');
  m.updatedAt = new Date('2026-01-01T00:00:00Z');
  Object.assign(m, overrides);
  return m;
}

describe('MembersService.add()', () => {
  it('adds a member to an empty queue at the back (position 1)', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const orm = makeOrmMock({ rotation, activeMembers: [] });
    const service = new MembersService(orm as never);

    const result = await service.add('aBcDeFgH', { name: 'Alice', placement: 'back' });

    expect(result.name).toBe('Alice');
    expect(result.position).toBe(1);
    expect(orm._em.persist).toHaveBeenCalledOnce();
    expect(orm._em.flush).toHaveBeenCalledOnce();
    // Empty queue: adjustNextIndex(0, 0, ADD at 1) → queueLengthBefore=0 guard → returns 0
    expect(rotation.nextIndex).toBe(0);
  });

  it('adds a member to the back of a non-empty queue', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const existing = [makeMember(1, { name: 'Alice' }), makeMember(2, { name: 'Bob' })];
    const orm = makeOrmMock({ rotation, activeMembers: existing });
    const service = new MembersService(orm as never);

    const result = await service.add('aBcDeFgH', { name: 'Carol', placement: 'back' });

    expect(result.name).toBe('Carol');
    expect(result.position).toBe(3);
    // ADD at position 3, zeroBased=2, currentNextIndex=0 → 2 > 0 → unchanged
    expect(rotation.nextIndex).toBe(0);
  });

  it('adds a member to the front, shifting existing members in-memory', async () => {
    const rotation = makeRotation({ nextIndex: 1 });
    const alice = makeMember(1, { name: 'Alice' });
    const bob = makeMember(2, { name: 'Bob' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob] });
    const service = new MembersService(orm as never);

    const result = await service.add('aBcDeFgH', { name: 'Zara', placement: 'front' });

    expect(result.position).toBe(1);
    // Existing members shifted in-memory — no raw SQL needed without the unique constraint
    expect(alice.position).toBe(2);
    expect(bob.position).toBe(3);
    expect(orm._em.persist).toHaveBeenCalledOnce();
    expect(orm._em.flush).toHaveBeenCalledOnce();
    // ADD at position 1, zeroBased=0, currentNextIndex=1 → 0<=1 → nextIndex becomes 2
    expect(rotation.nextIndex).toBe(2);
  });

  it('throws ConflictException when queue is at capacity (100 members)', async () => {
    const rotation = makeRotation();
    const fullQueue = Array.from({ length: 100 }, (_, i) => makeMember(i + 1));
    const orm = makeOrmMock({ rotation, activeMembers: fullQueue });
    const service = new MembersService(orm as never);

    await expect(
      service.add('aBcDeFgH', { name: 'Extra', placement: 'back' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orm._em.flush).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown slug', async () => {
    const orm = makeOrmMock({ rotation: null });
    const service = new MembersService(orm as never);

    await expect(
      service.add('aBcDeFgH', { name: 'Alice', placement: 'back' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for a malformed slug without DB hit', async () => {
    const orm = makeOrmMock();
    const service = new MembersService(orm as never);

    await expect(service.add('BAD', { name: 'Alice', placement: 'back' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orm._em.findOne).not.toHaveBeenCalled();
  });
});

describe('MembersService.remove()', () => {
  it('soft-deletes a member and re-indexes remaining', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const alice = makeMember(1, { name: 'Alice', id: 'id-alice' });
    const bob = makeMember(2, { name: 'Bob', id: 'id-bob' });
    const carol = makeMember(3, { name: 'Carol', id: 'id-carol' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob, carol] });
    const service = new MembersService(orm as never);

    await service.remove('aBcDeFgH', 'id-bob');

    expect(bob.removedAt).not.toBeNull();
    expect(bob.position).toBeNull();
    expect(alice.position).toBe(1);
    expect(carol.position).toBe(2);
    expect(orm._em.flush).toHaveBeenCalledOnce();
  });

  it('wraps nextIndex when the "next" member is removed (sole member)', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const alice = makeMember(1, { name: 'Alice', id: 'id-alice' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice] });
    const service = new MembersService(orm as never);

    await service.remove('aBcDeFgH', 'id-alice');

    // REMOVE at position 1 of 1: zeroBased=0 === nextIndex=0 → 0 % max(0,1) = 0
    expect(rotation.nextIndex).toBe(0);
    expect(alice.removedAt).not.toBeNull();
  });

  it('decrements nextIndex when member before pointer is removed', async () => {
    const rotation = makeRotation({ nextIndex: 2 });
    const alice = makeMember(1, { name: 'Alice', id: 'id-alice' });
    const bob = makeMember(2, { name: 'Bob', id: 'id-bob' });
    const carol = makeMember(3, { name: 'Carol', id: 'id-carol' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob, carol] });
    const service = new MembersService(orm as never);

    // Remove Alice (position 1 = zeroBased 0, nextIndex=2 → 0 < 2 → nextIndex-1 = 1)
    await service.remove('aBcDeFgH', 'id-alice');

    expect(rotation.nextIndex).toBe(1);
  });

  it('throws NotFoundException for unknown member ID', async () => {
    const rotation = makeRotation();
    const alice = makeMember(1, { name: 'Alice', id: 'id-alice' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice] });
    const service = new MembersService(orm as never);

    await expect(service.remove('aBcDeFgH', 'unknown-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orm._em.flush).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for unknown rotation slug', async () => {
    const orm = makeOrmMock({ rotation: null });
    const service = new MembersService(orm as never);

    await expect(service.remove('aBcDeFgH', 'any-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MembersService.reorder()', () => {
  it('reassigns positions per provided order', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const alice = makeMember(1, { id: 'id-alice', name: 'Alice' });
    const bob = makeMember(2, { id: 'id-bob', name: 'Bob' });
    const carol = makeMember(3, { id: 'id-carol', name: 'Carol' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob, carol] });
    const service = new MembersService(orm as never);

    const result = await service.reorder('aBcDeFgH', {
      memberIds: ['id-bob', 'id-carol', 'id-alice'],
    });

    expect(bob.position).toBe(1);
    expect(carol.position).toBe(2);
    expect(alice.position).toBe(3);
    expect(result.members.map((m) => m.id)).toEqual(['id-bob', 'id-carol', 'id-alice']);
    expect(orm._em.flush).toHaveBeenCalledOnce();
  });

  it('throws BadRequestException when memberIds length does not match active count', async () => {
    const rotation = makeRotation();
    const alice = makeMember(1, { id: 'id-alice' });
    const bob = makeMember(2, { id: 'id-bob' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob] });
    const service = new MembersService(orm as never);

    await expect(service.reorder('aBcDeFgH', { memberIds: ['id-alice'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws BadRequestException for an unknown member ID', async () => {
    const rotation = makeRotation();
    const alice = makeMember(1, { id: 'id-alice' });
    const bob = makeMember(2, { id: 'id-bob' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob] });
    const service = new MembersService(orm as never);

    await expect(
      service.reorder('aBcDeFgH', { memberIds: ['id-alice', 'id-unknown'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException for duplicate member IDs', async () => {
    const rotation = makeRotation();
    const alice = makeMember(1, { id: 'id-alice' });
    const bob = makeMember(2, { id: 'id-bob' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob] });
    const service = new MembersService(orm as never);

    await expect(
      service.reorder('aBcDeFgH', { memberIds: ['id-alice', 'id-alice'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no-op reorder with same order does not throw', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const alice = makeMember(1, { id: 'id-alice' });
    const bob = makeMember(2, { id: 'id-bob' });
    const orm = makeOrmMock({ rotation, activeMembers: [alice, bob] });
    const service = new MembersService(orm as never);

    await expect(
      service.reorder('aBcDeFgH', { memberIds: ['id-alice', 'id-bob'] }),
    ).resolves.toBeDefined();
  });
});
