import { MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreateRotationRequestDto,
  RenameRotationRequestDto,
  RotationResponseDto,
} from '@whos-next/shared';
import { SLUG_REGEX } from '@whos-next/shared';

import { generateSlug } from '../common/slug/slug.generator.js';

import { Rotation } from './rotation.entity.js';

const MAX_SLUG_RETRIES = 5;

@Injectable()
export class RotationsService {
  private readonly logger = new Logger(RotationsService.name);

  constructor(private readonly orm: MikroORM) {}

  async create(dto: CreateRotationRequestDto): Promise<RotationResponseDto> {
    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      const em = this.orm.em.fork();
      const rotation = new Rotation();
      rotation.slug = generateSlug();
      rotation.name = dto.name;
      rotation.lastAccessedAt = new Date();
      em.persist(rotation);
      try {
        await em.flush();
        return this.toDto(rotation);
      } catch (error) {
        if (error instanceof UniqueConstraintViolationException) continue;
        throw error;
      }
    }
    throw new InternalServerErrorException({
      statusCode: 500,
      error: 'SLUG_GENERATION_FAILED',
      message: 'Failed to generate a unique rotation slug after multiple attempts',
    });
  }

  async findBySlug(slug: string): Promise<RotationResponseDto> {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    const em = this.orm.em.fork();
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    this.scheduleLastAccessUpdate(slug);
    return this.toDto(rotation);
  }

  async rename(slug: string, dto: RenameRotationRequestDto): Promise<RotationResponseDto> {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    const em = this.orm.em.fork();
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    rotation.rename(dto.name);
    await em.flush();
    return this.toDto(rotation);
  }

  async delete(slug: string): Promise<void> {
    if (!SLUG_REGEX.test(slug)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    const em = this.orm.em.fork();
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'ROTATION_NOT_FOUND',
        message: 'Rotation not found',
      });
    }
    em.remove(rotation);
    await em.flush();
  }

  private scheduleLastAccessUpdate(slug: string): void {
    const em = this.orm.em.fork();
    const sql = `UPDATE rotations SET last_accessed_at = NOW() WHERE slug = $1 AND last_accessed_at < NOW() - INTERVAL '24 hours'`;
    void em
      .getConnection()
      .execute(sql, [slug])
      .catch((error: unknown) => {
        this.logger.error(`Failed to update last_accessed_at for slug ${slug}`, error);
      });
  }

  private toDto(rotation: Rotation): RotationResponseDto {
    return {
      slug: rotation.slug,
      name: rotation.name,
      createdAt: rotation.createdAt.toISOString(),
      updatedAt: rotation.updatedAt.toISOString(),
    };
  }
}
