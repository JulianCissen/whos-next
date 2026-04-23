import { MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type {
  CreateRotationRequestDto,
  MemberDto,
  RenameRotationRequestDto,
  RotationResponseDto,
} from '@whos-next/shared';
import { SLUG_REGEX } from '@whos-next/shared';

import { generateSlug } from '../common/slug/slug.generator.js';
import { Member } from '../members/member.entity.js';
import { ScheduleDate } from '../schedule/schedule-date.entity.js';
import { Schedule } from '../schedule/schedule.entity.js';
import { toScheduleDto } from '../schedule/schedule.service.js';

import { Rotation } from './rotation.entity.js';

const MAX_SLUG_RETRIES = 5;

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class RotationsService {
  private readonly logger = new Logger(RotationsService.name);

  constructor(private readonly orm: MikroORM) {}

  async create(dto: CreateRotationRequestDto): Promise<RotationResponseDto> {
    const scheduleDto = dto.schedule;
    if (!scheduleDto?.type || !['recurrence_rule', 'custom_date_list'].includes(scheduleDto.type)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'INVALID_SCHEDULE_TYPE',
        message: 'schedule.type must be recurrence_rule or custom_date_list',
      });
    }
    if (scheduleDto.type === 'recurrence_rule' && !scheduleDto.recurrenceRule) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'MISSING_RECURRENCE_RULE',
        message: 'recurrenceRule is required when schedule.type is recurrence_rule',
      });
    }

    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      const em = this.orm.em.fork();
      const rotation = new Rotation();
      rotation.slug = generateSlug();
      rotation.name = dto.name;
      rotation.lastAccessedAt = new Date();
      em.persist(rotation);

      const schedule = new Schedule();
      schedule.rotation = rotation;
      schedule.type = scheduleDto.type;
      if (scheduleDto.type === 'recurrence_rule') {
        const rule = scheduleDto.recurrenceRule!;
        schedule.rruleType = rule.type;
        schedule.dayOfWeek = rule.dayOfWeek ?? null;
        schedule.intervalN = rule.intervalN ?? null;
        schedule.monthlyDay = rule.monthlyDay ?? null;
        schedule.startDate = scheduleDto.startDate ?? todayIso();
      } else {
        schedule.rruleType = null;
        schedule.dayOfWeek = null;
        schedule.intervalN = null;
        schedule.monthlyDay = null;
        schedule.startDate = null;
      }
      em.persist(schedule);

      try {
        await em.flush();
        return this.toDto(rotation, [], schedule);
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
    const members = await em.find(
      Member,
      { rotation, removedAt: null },
      { orderBy: { position: 'ASC' } },
    );
    const schedule = await em.findOne(Schedule, { rotation });
    let scheduleDates: ScheduleDate[] | undefined;
    if (schedule?.type === 'custom_date_list') {
      scheduleDates = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
    }
    this.scheduleLastAccessUpdate(slug);
    return this.toDto(rotation, members, schedule ?? null, scheduleDates);
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
    const schedule = await em.findOne(Schedule, { rotation });
    let scheduleDates: ScheduleDate[] | undefined;
    if (schedule?.type === 'custom_date_list') {
      scheduleDates = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
    }
    return this.toDto(rotation, [], schedule ?? null, scheduleDates);
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
    void (async () => {
      const em = this.orm.em.fork();
      const rotation = await em.findOne(Rotation, { slug });
      if (!rotation?.touchAccess()) return;
      rotation.lastAccessedAt = new Date();
      await em.flush();
    })().catch((error: unknown) => {
      this.logger.error(`Failed to update last_accessed_at for slug ${slug}`, error);
    });
  }

  private toDto(
    rotation: Rotation,
    members: Member[] = [],
    schedule: Schedule | null = null,
    scheduleDates?: ScheduleDate[],
  ): RotationResponseDto {
    return {
      slug: rotation.slug,
      name: rotation.name,
      createdAt: rotation.createdAt.toISOString(),
      updatedAt: rotation.updatedAt.toISOString(),
      members: members.map(
        (m): MemberDto => ({
          id: m.id,
          name: m.name,
          position: m.position as number,
        }),
      ),
      schedule: schedule ? toScheduleDto(schedule, scheduleDates) : null,
    };
  }
}
