import { MikroORM } from '@mikro-orm/postgresql';
import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type {
  AddMemberResponseDto,
  ReorderMembersResponseDto,
  RotationResponseDto,
} from '@whos-next/shared';

import { AppModule } from '../app.module.js';

let app: NestFastifyApplication;
let orm: MikroORM;

beforeAll(async () => {
  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  orm = module.get(MikroORM);
  await orm.getMigrator().up();
});

afterAll(async () => {
  await orm.close();
  await app.close();
});

beforeEach(async () => {
  await orm.em.fork().execute(`DELETE FROM rotations`);
});

async function createRotation(name: string): Promise<RotationResponseDto> {
  const res = await app.getHttpServer().post('/api/rotations').send({ name }).expect(201);
  return res.body as RotationResponseDto;
}

async function addMember(
  slug: string,
  memberName: string,
  placement: 'front' | 'back' = 'back',
): Promise<AddMemberResponseDto> {
  const res = await app
    .getHttpServer()
    .post(`/api/rotations/${slug}/members`)
    .send({ name: memberName, placement })
    .expect(201);
  return res.body as AddMemberResponseDto;
}

describe('GET /api/rotations/:slug — members field', () => {
  it('includes an empty members array when no members added', async () => {
    const rotation = await createRotation('Empty rotation');
    const res = await app.getHttpServer().get(`/api/rotations/${rotation.slug}`).expect(200);
    const body = res.body as RotationResponseDto;
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.members).toHaveLength(0);
  });

  it('returns members ordered by position ascending', async () => {
    const rotation = await createRotation('Ordered rotation');
    await addMember(rotation.slug, 'Alice');
    await addMember(rotation.slug, 'Bob');
    await addMember(rotation.slug, 'Carol');

    const res = await app.getHttpServer().get(`/api/rotations/${rotation.slug}`).expect(200);
    const body = res.body as RotationResponseDto;

    expect(body.members).toHaveLength(3);
    expect(body.members[0].name).toBe('Alice');
    expect(body.members[0].position).toBe(1);
    expect(body.members[1].name).toBe('Bob');
    expect(body.members[1].position).toBe(2);
    expect(body.members[2].name).toBe('Carol');
    expect(body.members[2].position).toBe(3);
  });

  it('excludes soft-deleted members from the members array', async () => {
    const rotation = await createRotation('Soft-delete rotation');
    await addMember(rotation.slug, 'Alice');
    const bob = await addMember(rotation.slug, 'Bob');

    await app
      .getHttpServer()
      .delete(`/api/rotations/${rotation.slug}/members/${bob.id}`)
      .expect(204);

    const res = await app.getHttpServer().get(`/api/rotations/${rotation.slug}`).expect(200);
    const body = res.body as RotationResponseDto;

    expect(body.members).toHaveLength(1);
    expect(body.members[0].name).toBe('Alice');
  });
});

describe('DELETE /api/rotations/:slug/members/:memberId', () => {
  it('returns 204 on successful deletion', async () => {
    const rotation = await createRotation('Remove test');
    const alice = await addMember(rotation.slug, 'Alice');

    await app
      .getHttpServer()
      .delete(`/api/rotations/${rotation.slug}/members/${alice.id}`)
      .expect(204);
  });

  it('returns 404 when deleting an already-removed member', async () => {
    const rotation = await createRotation('Double-remove test');
    const alice = await addMember(rotation.slug, 'Alice');

    await app
      .getHttpServer()
      .delete(`/api/rotations/${rotation.slug}/members/${alice.id}`)
      .expect(204);

    await app
      .getHttpServer()
      .delete(`/api/rotations/${rotation.slug}/members/${alice.id}`)
      .expect(404);
  });

  it('GET after delete excludes the removed member', async () => {
    const rotation = await createRotation('Delete and get');
    await addMember(rotation.slug, 'Alice');
    const bob = await addMember(rotation.slug, 'Bob');

    await app
      .getHttpServer()
      .delete(`/api/rotations/${rotation.slug}/members/${bob.id}`)
      .expect(204);

    const res = await app.getHttpServer().get(`/api/rotations/${rotation.slug}`).expect(200);
    const body = res.body as RotationResponseDto;

    expect(body.members).toHaveLength(1);
    expect(body.members[0].name).toBe('Alice');
    expect(body.members[0].position).toBe(1);
  });
});

describe('POST /api/rotations/:slug/members', () => {
  it('adds a member to the front of a non-empty queue and returns 201', async () => {
    const rotation = await createRotation('Front add test');
    await addMember(rotation.slug, 'Alice', 'back');

    const bob = await addMember(rotation.slug, 'Bob', 'front');

    expect(bob.name).toBe('Bob');
    expect(bob.position).toBe(1);
  });

  it('GET after front-add returns members in correct order', async () => {
    const rotation = await createRotation('Front order test');
    await addMember(rotation.slug, 'Alice', 'back');
    await addMember(rotation.slug, 'Bob', 'back');
    await addMember(rotation.slug, 'Zara', 'front');

    const res = await app.getHttpServer().get(`/api/rotations/${rotation.slug}`).expect(200);
    const body = res.body as RotationResponseDto;

    expect(body.members).toHaveLength(3);
    expect(body.members[0].name).toBe('Zara');
    expect(body.members[0].position).toBe(1);
    expect(body.members[1].name).toBe('Alice');
    expect(body.members[1].position).toBe(2);
    expect(body.members[2].name).toBe('Bob');
    expect(body.members[2].position).toBe(3);
  });
});

describe('PUT /api/rotations/:slug/members/order', () => {
  it('returns 200 with reordered members', async () => {
    const rotation = await createRotation('Reorder test');
    const alice = await addMember(rotation.slug, 'Alice');
    const bob = await addMember(rotation.slug, 'Bob');
    const carol = await addMember(rotation.slug, 'Carol');

    const res = await app
      .getHttpServer()
      .put(`/api/rotations/${rotation.slug}/members/order`)
      .send({ memberIds: [bob.id, carol.id, alice.id] })
      .expect(200);

    const body = res.body as ReorderMembersResponseDto;
    expect(body.members).toHaveLength(3);
    expect(body.members[0].name).toBe('Bob');
    expect(body.members[0].position).toBe(1);
    expect(body.members[1].name).toBe('Carol');
    expect(body.members[1].position).toBe(2);
    expect(body.members[2].name).toBe('Alice');
    expect(body.members[2].position).toBe(3);
  });

  it('returns 400 REORDER_INVALID when a member ID is missing', async () => {
    const rotation = await createRotation('Reorder missing');
    const alice = await addMember(rotation.slug, 'Alice');
    await addMember(rotation.slug, 'Bob');

    const res = await app
      .getHttpServer()
      .put(`/api/rotations/${rotation.slug}/members/order`)
      .send({ memberIds: [alice.id] })
      .expect(400);

    expect((res.body as { error: string }).error).toBe('REORDER_INVALID');
  });

  it('returns 400 REORDER_INVALID when an extra member ID is sent', async () => {
    const rotation = await createRotation('Reorder extra');
    const alice = await addMember(rotation.slug, 'Alice');
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await app
      .getHttpServer()
      .put(`/api/rotations/${rotation.slug}/members/order`)
      .send({ memberIds: [alice.id, fakeId] })
      .expect(400);
  });

  it('GET after reorder reflects new order', async () => {
    const rotation = await createRotation('Reorder GET test');
    const alice = await addMember(rotation.slug, 'Alice');
    const bob = await addMember(rotation.slug, 'Bob');

    await app
      .getHttpServer()
      .put(`/api/rotations/${rotation.slug}/members/order`)
      .send({ memberIds: [bob.id, alice.id] })
      .expect(200);

    const res = await app.getHttpServer().get(`/api/rotations/${rotation.slug}`).expect(200);
    const body = res.body as RotationResponseDto;

    expect(body.members[0].name).toBe('Bob');
    expect(body.members[0].position).toBe(1);
    expect(body.members[1].name).toBe('Alice');
    expect(body.members[1].position).toBe(2);
  });
});
