import { MikroORM } from '@mikro-orm/core';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { RotationResponseDto } from '@whos-next/shared';

import { AppModule } from '../app.module.js';

import { Rotation } from './rotation.entity.js';

let app: INestApplication;
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
  await orm.migrator.up();
});

afterAll(async () => {
  await orm.close();
  await app.close();
});

beforeEach(async () => {
  await orm.em.fork().nativeDelete(Rotation, {});
});

describe('POST /api/rotations', () => {
  it('returns 201 and the created rotation', async () => {
    const res = await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'Dish duty' })
      .expect(201);

    const body = res.body as RotationResponseDto;
    expect(body.name).toBe('Dish duty');
    expect(body.slug).toHaveLength(8);
    expect(res.headers['location']).toContain(body.slug);
  });

  it('returns 400 for empty name', async () => {
    await app.getHttpServer().post('/api/rotations').send({ name: '' }).expect(400);
  });

  it('returns 400 for name exceeding 100 characters', async () => {
    await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'a'.repeat(101) })
      .expect(400);
  });
});

describe('GET /api/rotations/:slug', () => {
  it('returns 200 and the rotation when found', async () => {
    const created = await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'Standup host' })
      .expect(201);

    const { slug } = created.body as RotationResponseDto;

    const res = await app.getHttpServer().get(`/api/rotations/${slug}`).expect(200);

    const body = res.body as RotationResponseDto;
    expect(body.slug).toBe(slug);
    expect(body.name).toBe('Standup host');
  });

  it('returns 404 for unknown slug', async () => {
    await app.getHttpServer().get('/api/rotations/aBcDeFgH').expect(404);
  });

  it('returns 404 without DB hit for malformed slug', async () => {
    await app.getHttpServer().get('/api/rotations/BAD').expect(404);
  });
});

describe('PATCH /api/rotations/:slug', () => {
  it('returns 200 with updated name', async () => {
    const created = await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'Old name' })
      .expect(201);

    const { slug } = created.body as RotationResponseDto;

    const res = await app
      .getHttpServer()
      .patch(`/api/rotations/${slug}`)
      .send({ name: 'New name' })
      .expect(200);

    expect((res.body as RotationResponseDto).name).toBe('New name');
  });

  it('returns 400 for invalid name', async () => {
    const created = await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'Valid' })
      .expect(201);

    const { slug } = created.body as RotationResponseDto;

    await app.getHttpServer().patch(`/api/rotations/${slug}`).send({ name: '' }).expect(400);
  });

  it('returns 404 for unknown slug', async () => {
    await app.getHttpServer().patch('/api/rotations/aBcDeFgH').send({ name: 'X' }).expect(404);
  });
});

describe('DELETE /api/rotations/:slug', () => {
  it('returns 204 on successful deletion', async () => {
    const created = await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'To delete' })
      .expect(201);

    const { slug } = created.body as RotationResponseDto;

    await app.getHttpServer().delete(`/api/rotations/${slug}`).expect(204);
  });

  it('returns 404 after deletion (GET returns 404)', async () => {
    const created = await app
      .getHttpServer()
      .post('/api/rotations')
      .send({ name: 'To delete' })
      .expect(201);

    const { slug } = created.body as RotationResponseDto;
    await app.getHttpServer().delete(`/api/rotations/${slug}`).expect(204);
    await app.getHttpServer().get(`/api/rotations/${slug}`).expect(404);
  });

  it('returns 404 for unknown slug', async () => {
    await app.getHttpServer().delete('/api/rotations/aBcDeFgH').expect(404);
  });
});
