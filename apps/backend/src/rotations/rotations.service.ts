import { MikroORM, UniqueConstraintViolationException, type EntityManager } from '@mikro-orm/core';
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
    this.assertCreateScheduleInput(scheduleDto);

    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      const em = this.orm.em.fork();
      try {
        const { rotation, schedule } = await this.persistNewRotationAndSchedule(
          em,
          dto,
          scheduleDto,
        );
        return this.toDto(rotation, [], schedule);
      } catch (error) {
        if (error instanceof UniqueConstraintViolationException) {
          continue;
        }
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
    const { em, rotation } = await this.getRotationContextOrThrow(slug);
    const members = await this.getActiveMembers(em, rotation);
    const { schedule, scheduleDates } = await this.loadScheduleWithDates(em, rotation);
    this.scheduleLastAccessUpdate(slug);
    return this.toDto(rotation, members, schedule, scheduleDates);
  }

  async rename(slug: string, dto: RenameRotationRequestDto): Promise<RotationResponseDto> {
    const { em, rotation } = await this.getRotationContextOrThrow(slug);
    rotation.rename(dto.name);
    await em.flush();
    const { schedule, scheduleDates } = await this.loadScheduleWithDates(em, rotation);
    return this.toDto(rotation, [], schedule, scheduleDates);
  }

  async delete(slug: string): Promise<void> {
    const { em, rotation } = await this.getRotationContextOrThrow(slug);
    em.remove(rotation);
    await em.flush();
  }

  private async getRotationContextOrThrow(
    slug: string,
  ): Promise<{ em: EntityManager; rotation: Rotation }> {
    this.assertSlugOrThrow(slug);
    const em = this.orm.em.fork();
    const rotation = await this.getRotationOrThrow(em, slug);
    return { em, rotation };
  }

  private assertSlugOrThrow(slug: string): void {
    if (!SLUG_REGEX.test(slug)) {
      this.throwRotationNotFound();
    }
  }

  private async getRotationOrThrow(em: EntityManager, slug: string): Promise<Rotation> {
    const rotation = await em.findOne(Rotation, { slug });
    if (!rotation) {
      this.throwRotationNotFound();
    }
    return rotation;
  }

  private throwRotationNotFound(): never {
    throw new NotFoundException({
      statusCode: 404,
      error: 'ROTATION_NOT_FOUND',
      message: 'Rotation not found',
    });
  }

  private getActiveMembers(em: EntityManager, rotation: Rotation): Promise<Member[]> {
    return em.find(Member, { rotation, removedAt: null }, { orderBy: { position: 'ASC' } });
  }

  private assertCreateScheduleInput(scheduleDto: CreateRotationRequestDto['schedule']): void {
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
  }

  private async persistNewRotationAndSchedule(
    em: EntityManager,
    dto: CreateRotationRequestDto,
    scheduleDto: CreateRotationRequestDto['schedule'],
  ): Promise<{ rotation: Rotation; schedule: Schedule }> {
    const rotation = this.buildRotation(dto.name);
    const schedule = this.buildSchedule(rotation, scheduleDto);
    em.persist(rotation);
    em.persist(schedule);
    await em.flush();
    return { rotation, schedule };
  }

  private buildRotation(name: string): Rotation {
    const rotation = new Rotation();
    rotation.slug = generateSlug();
    rotation.name = name;
    rotation.lastAccessedAt = new Date();
    return rotation;
  }

  private buildSchedule(
    rotation: Rotation,
    scheduleDto: CreateRotationRequestDto['schedule'],
  ): Schedule {
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
      return schedule;
    }

    schedule.rruleType = null;
    schedule.dayOfWeek = null;
    schedule.intervalN = null;
    schedule.monthlyDay = null;
    schedule.startDate = null;
    return schedule;
  }

  private async loadScheduleWithDates(
    em: EntityManager,
    rotation: Rotation,
  ): Promise<{ schedule: Schedule | null; scheduleDates?: ScheduleDate[] }> {
    const schedule = await em.findOne(Schedule, { rotation });
    if (schedule?.type === 'custom_date_list') {
      const scheduleDates = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
      return { schedule, scheduleDates };
    }
    return { schedule: schedule ?? null };
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
