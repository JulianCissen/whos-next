import { MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type {
  AddCustomDateRequestDto,
  ConfigureRecurrenceRuleRequestDto,
  CustomDateDto,
  RecurrenceRuleDto,
  ScheduleDto,
  SwitchScheduleTypeRequestDto,
} from '@whos-next/shared';

import { ScheduleDate } from './schedule-date.entity.js';
import {
  assertIsoDateOrUnprocessable,
  getRotationOrThrow,
  getScheduleOrThrow,
} from './schedule-domain.util.js';
import { Schedule } from './schedule.entity.js';

const MAX_CUSTOM_DATES = 500;

export function toScheduleDto(schedule: Schedule, dates?: ScheduleDate[]): ScheduleDto {
  if (schedule.type === 'custom_date_list') {
    const sorted = (dates ?? []).map((sd) => sd.date).toSorted();
    return { type: 'custom_date_list', dates: sorted };
  }
  const dto: ScheduleDto = { type: 'recurrence_rule' };
  if (schedule.rruleType) {
    const rule: RecurrenceRuleDto = {
      type: schedule.rruleType as RecurrenceRuleDto['type'],
    };
    if (schedule.dayOfWeek !== null)
      rule.dayOfWeek = schedule.dayOfWeek as RecurrenceRuleDto['dayOfWeek'];
    if (schedule.intervalN !== null) rule.intervalN = schedule.intervalN;
    if (schedule.monthlyDay !== null) rule.monthlyDay = schedule.monthlyDay;
    dto.recurrenceRule = rule;
  }
  if (schedule.startDate) dto.startDate = schedule.startDate;
  return dto;
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function validateRule(rule: RecurrenceRuleDto): void {
  if (!rule.type || !['weekly', 'every_n_weeks', 'monthly'].includes(rule.type)) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'INVALID_RULE_TYPE',
      message: 'rule.type must be weekly, every_n_weeks, or monthly',
    });
  }
  if (
    (rule.type === 'weekly' || rule.type === 'every_n_weeks') &&
    (rule.dayOfWeek === undefined || rule.dayOfWeek < 1 || rule.dayOfWeek > 7)
  ) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'INVALID_DAY_OF_WEEK',
      message: 'rule.dayOfWeek must be 1–7 for weekly / every_n_weeks',
    });
  }
  if (rule.type === 'every_n_weeks' && (rule.intervalN === undefined || rule.intervalN < 2)) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'INVALID_INTERVAL',
      message: 'rule.intervalN must be ≥ 2 for every_n_weeks',
    });
  }
  if (
    rule.type === 'monthly' &&
    (rule.monthlyDay === undefined || rule.monthlyDay < 1 || rule.monthlyDay > 31)
  ) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'INVALID_MONTHLY_DAY',
      message: 'rule.monthlyDay must be 1–31 for monthly',
    });
  }
}

@Injectable()
export class ScheduleService {
  constructor(private readonly orm: MikroORM) {}

  async configureRecurrenceRule(
    slug: string,
    dto: ConfigureRecurrenceRuleRequestDto,
  ): Promise<ScheduleDto> {
    validateRule(dto.rule);
    const em = this.orm.em.fork();
    const rotation = await getRotationOrThrow(em, slug);
    let schedule = await em.findOne(Schedule, { rotation });
    if (!schedule) {
      schedule = new Schedule();
      schedule.rotation = rotation;
      schedule.type = 'recurrence_rule';
      em.persist(schedule);
    }
    if (schedule.type === 'custom_date_list') {
      throw new ConflictException({
        statusCode: 409,
        error: 'WRONG_SCHEDULE_TYPE',
        message: 'Switch schedule type to recurrence_rule first',
      });
    }
    schedule.rruleType = dto.rule.type;
    schedule.dayOfWeek = dto.rule.dayOfWeek ?? null;
    schedule.intervalN = dto.rule.intervalN ?? null;
    schedule.monthlyDay = dto.rule.monthlyDay ?? null;
    schedule.startDate = dto.startDate ?? todayIso();
    await em.flush();
    return toScheduleDto(schedule);
  }

  async addDate(slug: string, dto: AddCustomDateRequestDto): Promise<CustomDateDto> {
    assertIsoDateOrUnprocessable(dto.date, {
      statusCode: 422,
      error: 'INVALID_DATE',
      message: 'date must be a valid ISO date (YYYY-MM-DD)',
    });
    const em = this.orm.em.fork();
    const rotation = await getRotationOrThrow(em, slug);
    const schedule = await getScheduleOrThrow(em, rotation);
    if (schedule.type !== 'custom_date_list') {
      throw new ConflictException({
        statusCode: 409,
        error: 'WRONG_SCHEDULE_TYPE',
        message: 'Schedule type is recurrence_rule',
      });
    }
    const count = await em.count(ScheduleDate, { schedule });
    if (count >= MAX_CUSTOM_DATES) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'DATE_CAP_EXCEEDED',
        message: `Maximum ${MAX_CUSTOM_DATES} custom dates allowed`,
      });
    }
    const scheduleDate = new ScheduleDate();
    scheduleDate.schedule = schedule;
    scheduleDate.date = dto.date;
    em.persist(scheduleDate);
    try {
      await em.flush();
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException({
          statusCode: 409,
          error: 'DUPLICATE_DATE',
          message: 'Date already exists in the list',
        });
      }
      throw error;
    }
    return { date: scheduleDate.date };
  }

  async removeDate(slug: string, dateStr: string): Promise<void> {
    const em = this.orm.em.fork();
    const rotation = await getRotationOrThrow(em, slug);
    const schedule = await getScheduleOrThrow(em, rotation);
    if (schedule.type !== 'custom_date_list') {
      throw new ConflictException({
        statusCode: 409,
        error: 'WRONG_SCHEDULE_TYPE',
        message: 'Schedule type is recurrence_rule',
      });
    }
    const scheduleDate = await em.findOne(ScheduleDate, { schedule, date: dateStr });
    if (!scheduleDate) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'DATE_NOT_FOUND',
        message: 'Date not in the list',
      });
    }
    em.remove(scheduleDate);
    await em.flush();
  }

  async switchType(slug: string, dto: SwitchScheduleTypeRequestDto): Promise<ScheduleDto> {
    if (!['recurrence_rule', 'custom_date_list'].includes(dto.type)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'INVALID_TYPE',
        message: 'type must be recurrence_rule or custom_date_list',
      });
    }
    const em = this.orm.em.fork();
    const rotation = await getRotationOrThrow(em, slug);
    let schedule = await em.findOne(Schedule, { rotation });
    if (!schedule) {
      schedule = new Schedule();
      schedule.rotation = rotation;
      schedule.type = dto.type;
      em.persist(schedule);
    }
    schedule.type = dto.type;
    if (dto.type === 'custom_date_list') {
      schedule.rruleType = null;
      schedule.dayOfWeek = null;
      schedule.intervalN = null;
      schedule.monthlyDay = null;
      schedule.startDate = null;
    } else {
      const dates = await em.find(ScheduleDate, { schedule });
      for (const sd of dates) {
        em.remove(sd);
      }
      schedule.rruleType = null;
      schedule.dayOfWeek = null;
      schedule.intervalN = null;
      schedule.monthlyDay = null;
      schedule.startDate = todayIso();
    }
    await em.flush();
    const dates =
      dto.type === 'custom_date_list' ? await em.find(ScheduleDate, { schedule }) : undefined;
    return toScheduleDto(schedule, dates);
  }
}
