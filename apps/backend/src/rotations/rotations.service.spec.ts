import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Rotation } from './rotation.entity.js';
import { RotationsService } from './rotations.service.js';

// Minimal MikroORM mock factory
function makeOrmMock(
  overrides: {
    findOne?: (entity: unknown, where: unknown) => Promise<unknown>;
    flush?: () => Promise<void>;
    execute?: () => Promise<unknown[]>;
  } = {},
) {
  const connection = {
    execute: vi.fn().mockResolvedValue([]),
    ...(overrides.execute ? { execute: vi.fn().mockImplementation(overrides.execute) } : {}),
  };
  const em = {
    findOne: vi.fn().mockImplementation(overrides.findOne ?? (() => Promise.resolve(null))),
    persist: vi.fn(),
    remove: vi.fn(),
    flush: vi.fn().mockImplementation(overrides.flush ?? (() => Promise.resolve())),
    getConnection: vi.fn().mockReturnValue(connection),
  };
  return {
    em: { fork: vi.fn().mockReturnValue(em) },
    _em: em,
    _connection: connection,
  };
}

function makeRotation(overrides: Partial<Rotation> = {}): Rotation {
  const r = new Rotation();
  r.slug = overrides.slug ?? 'aBcDeFgH';
  r.name = overrides.name ?? 'Dish duty';
  r.lastAccessedAt = overrides.lastAccessedAt ?? new Date('2026-01-01T00:00:00Z');
  r.createdAt = overrides.createdAt ?? new Date('2026-01-01T00:00:00Z');
  r.updatedAt = overrides.updatedAt ?? new Date('2026-01-01T00:00:00Z');
  return r;
}

describe('RotationsService', () => {
  describe('create()', () => {
    it('persists a new rotation and returns a DTO', async () => {
      const orm = makeOrmMock();
      const service = new RotationsService(orm as never);
      const result = await service.create({ name: 'Dish duty' });

      expect(orm._em.persist).toHaveBeenCalledOnce();
      expect(orm._em.flush).toHaveBeenCalledOnce();
      expect(result.name).toBe('Dish duty');
      expect(result.slug).toHaveLength(8);
      expect(result.createdAt).toBeTypeOf('string');
    });

    it('retries on unique constraint violation and succeeds on second attempt', async () => {
      let callCount = 0;
      const orm = makeOrmMock({
        flush: () => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new UniqueConstraintViolationException(new Error('unique')));
          }
          return Promise.resolve();
        },
      });
      const service = new RotationsService(orm as never);
      const result = await service.create({ name: 'Standup host' });

      expect(callCount).toBe(2);
      expect(result.name).toBe('Standup host');
    });

    it('throws InternalServerErrorException after 5 failed slug attempts', async () => {
      const orm = makeOrmMock({
        flush: () => Promise.reject(new UniqueConstraintViolationException(new Error('unique'))),
      });
      const service = new RotationsService(orm as never);

      await expect(service.create({ name: 'Test' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findBySlug()', () => {
    it('returns DTO when rotation exists', async () => {
      const rotation = makeRotation();
      const orm = makeOrmMock({ findOne: () => Promise.resolve(rotation) });
      const service = new RotationsService(orm as never);

      const result = await service.findBySlug('aBcDeFgH');

      expect(result.slug).toBe('aBcDeFgH');
      expect(result.name).toBe('Dish duty');
    });

    it('throws NotFoundException for unknown slug', async () => {
      const orm = makeOrmMock({ findOne: () => Promise.resolve(null) });
      const service = new RotationsService(orm as never);

      await expect(service.findBySlug('aBcDeFgH')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException without DB hit for malformed slug', async () => {
      const orm = makeOrmMock();
      const service = new RotationsService(orm as never);

      await expect(service.findBySlug('BAD')).rejects.toBeInstanceOf(NotFoundException);
      expect(orm._em.findOne).not.toHaveBeenCalled();
    });

    it('schedules last-access update after successful find', async () => {
      const rotation = makeRotation({
        lastAccessedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });
      const orm = makeOrmMock({ findOne: () => Promise.resolve(rotation) });
      const service = new RotationsService(orm as never);

      await service.findBySlug('aBcDeFgH');

      // Fire-and-forget — connection.execute is called but not awaited
      expect(orm._connection.execute).toHaveBeenCalled();
    });
  });

  describe('rename()', () => {
    it('updates the rotation name and returns updated DTO', async () => {
      const rotation = makeRotation();
      const orm = makeOrmMock({ findOne: () => Promise.resolve(rotation) });
      const service = new RotationsService(orm as never);

      const result = await service.rename('aBcDeFgH', { name: 'New name' });

      expect(result.name).toBe('New name');
      expect(orm._em.flush).toHaveBeenCalledOnce();
    });

    it('throws NotFoundException when rotation does not exist', async () => {
      const orm = makeOrmMock({ findOne: () => Promise.resolve(null) });
      const service = new RotationsService(orm as never);

      await expect(service.rename('aBcDeFgH', { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException for malformed slug without DB hit', async () => {
      const orm = makeOrmMock();
      const service = new RotationsService(orm as never);

      await expect(service.rename('BAD', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
      expect(orm._em.findOne).not.toHaveBeenCalled();
    });
  });

  describe('delete()', () => {
    it('removes the rotation', async () => {
      const rotation = makeRotation();
      const orm = makeOrmMock({ findOne: () => Promise.resolve(rotation) });
      const service = new RotationsService(orm as never);

      await service.delete('aBcDeFgH');

      expect(orm._em.remove).toHaveBeenCalledWith(rotation);
      expect(orm._em.flush).toHaveBeenCalledOnce();
    });

    it('throws NotFoundException when rotation does not exist', async () => {
      const orm = makeOrmMock({ findOne: () => Promise.resolve(null) });
      const service = new RotationsService(orm as never);

      await expect(service.delete('aBcDeFgH')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException for malformed slug without DB hit', async () => {
      const orm = makeOrmMock();
      const service = new RotationsService(orm as never);

      await expect(service.delete('BAD')).rejects.toBeInstanceOf(NotFoundException);
      expect(orm._em.findOne).not.toHaveBeenCalled();
    });
  });
});
