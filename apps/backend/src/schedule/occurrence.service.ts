import { EntityManager, MikroORM } from '@mikro-orm/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type {
  BrowseOccurrencesResponseDto,
  OccurrenceDto,
  OccurrenceWindowDto,
} from '@whos-next/shared';
import { SLUG_REGEX } from '@whos-next/shared';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { browseBackward, browseForward } from './occurrence-browse.helper.js';
import { toIsoDate, localYesterday, localToday } from './occurrence.helper.js';
import { getElapsedRecurrenceDates, getFutureRecurrenceDatesAfter } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import { Schedule } from './schedule.entity.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function activeQueue(rotation: Rotation, em: EntityManager): Promise<Member[]> {
  return em.find(Member, { rotation, removedAt: null }, { orderBy: { position: 'ASC' } });
}

async function requireRotationAndSchedule(
  em: EntityManager,
  slug: string,
): Promise<{ rotation: Rotation; schedule: Schedule | null }> {
  if (!SLUG_REGEX.test(slug)) {
    throw new NotFoundException({
      statusCode: 404,
      error: 'ROTATION_NOT_FOUND',
      message: 'Rotation not found',
    });
  }
  const rotation = await em.findOne(Rotation, { slug });
  if (!rotation) {
    throw new NotFoundException({
      statusCode: 404,
      error: 'ROTATION_NOT_FOUND',
      message: 'Rotation not found',
    });
  }
  const schedule = await em.findOne(Schedule, { rotation });
  return { rotation, schedule };
}

function toOccurrenceDto(
  date: Date | string,
  assignment: OccurrenceAssignment | null,
  queue: Member[],
  nextIndex: number,
  offset: number,
  isPast: boolean,
): OccurrenceDto {
  const dateStr = typeof date === 'string' ? date : toIsoDate(date);
  if (isPast && assignment) {
    return {
      date: dateStr,
      memberId: assignment.member?.id ?? null,
      memberName: assignment.member?.name ?? null,
      isPast: true,
    };
  }
  if (queue.length === 0) return { date: dateStr, memberId: null, memberName: null, isPast };
  const member = queue[(nextIndex + offset) % queue.length];
  return { date: dateStr, memberId: member?.id ?? null, memberName: member?.name ?? null, isPast };
}

@Injectable()
export class OccurrenceService {
  constructor(private readonly orm: MikroORM) {}

  private async settle(rotation: Rotation, schedule: Schedule, em: EntityManager): Promise<void> {
    const yesterday = localYesterday();
    let elapsedDates: Date[];
    if (schedule.type === 'recurrence_rule') {
      elapsedDates = getElapsedRecurrenceDates(
        schedule,
        new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1),
      );
    } else {
      const rows = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
      elapsedDates = rows.map((r) => new Date(r.date)).filter((d) => d <= yesterday);
    }
    if (elapsedDates.length === 0) return;
    const settled = await em.find(OccurrenceAssignment, { rotation });
    const settledSet = new Set(settled.map((a) => toIsoDate(new Date(a.occurrenceDate))));
    const unsettled = elapsedDates.filter((d) => !settledSet.has(toIsoDate(d)));
    if (unsettled.length === 0) return;
    const queue = await activeQueue(rotation, em);
    let idx = rotation.nextIndex;
    for (const date of unsettled) {
      if (queue.length > 0) {
        const assignment = new OccurrenceAssignment();
        assignment.rotation = rotation;
        assignment.occurrenceDate = toIsoDate(date) as unknown as string;
        assignment.member = queue[idx % queue.length]!;
        em.persist(assignment);
        idx = (idx + 1) % queue.length;
      }
    }
    rotation.nextIndex = queue.length > 0 ? idx : rotation.nextIndex;
    await em.flush();
  }

  async getWindow(slug: string): Promise<OccurrenceWindowDto> {
    const em = this.orm.em.fork();
    const { rotation, schedule } = await requireRotationAndSchedule(em, slug);
    if (!schedule) return { previous: null, next: null };

    await this.settle(rotation, schedule, em);

    const pastAssignments = await em.find(
      OccurrenceAssignment,
      { rotation },
      { orderBy: { occurrenceDate: 'DESC' }, limit: 1, populate: ['member'] },
    );
    const pastAssignment = pastAssignments[0] ?? null;
    const previous: OccurrenceDto | null = pastAssignment
      ? {
          date: toIsoDate(new Date(pastAssignment.occurrenceDate)),
          memberId: pastAssignment.member?.id ?? null,
          memberName: pastAssignment.member?.name ?? null,
          isPast: true,
        }
      : null;

    const today = localToday();
    const queue = await activeQueue(rotation, em);
    let nextDate: Date | null = null;

    if (schedule.type === 'recurrence_rule') {
      const future = getFutureRecurrenceDatesAfter(
        schedule,
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
        1,
      );
      nextDate = future[0] ?? null;
    } else {
      const futureDates = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
      const todayStr = toIsoDate(today);
      const upcoming = futureDates.find((sd) => sd.date >= todayStr);
      nextDate = upcoming ? new Date(upcoming.date) : null;
    }

    const next: OccurrenceDto | null = nextDate
      ? toOccurrenceDto(nextDate, null, queue, rotation.nextIndex, 0, false)
      : null;

    return { previous, next };
  }

  async browse(
    slug: string,
    after?: string,
    before?: string,
    limit = 1,
  ): Promise<BrowseOccurrencesResponseDto> {
    if (after !== undefined && before !== undefined) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_PARAMS',
        message: 'Provide exactly one of after or before',
      });
    }
    if (after === undefined && before === undefined) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_PARAMS',
        message: 'Provide exactly one of after or before',
      });
    }
    if (limit < 1 || limit > 10) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_LIMIT',
        message: 'limit must be 1–10',
      });
    }
    const anchor = after ?? before!;
    if (!ISO_DATE_REGEX.test(anchor)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_DATE',
        message: 'Date must be YYYY-MM-DD',
      });
    }

    const em = this.orm.em.fork();
    const { rotation, schedule } = await requireRotationAndSchedule(em, slug);
    if (!schedule) return { occurrences: [], hasMore: false };

    await this.settle(rotation, schedule, em);

    const queue = await activeQueue(rotation, em);

    if (after !== undefined) {
      return browseForward(em, rotation, schedule, queue, after, limit);
    }
    return browseBackward(em, rotation, schedule, queue, before!, limit);
  }
}
