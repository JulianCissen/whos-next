import { EntityManager, MikroORM } from '@mikro-orm/core';
import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  BrowseOccurrencesResponseDto,
  OccurrenceDto,
  OccurrenceWindowDto,
} from '@whos-next/shared';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { browseBackward, browseForward } from './occurrence-browse.helper.js';
import { toIsoDate, localYesterday, localToday, deriveFutureMember } from './occurrence.helper.js';
import { getFutureRecurrenceDatesAfter } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import {
  assertIsoDateOrBadRequest,
  getActiveQueue,
  getRotationOrThrow,
} from './schedule-domain.util.js';
import { Schedule } from './schedule.entity.js';
import { settleRotation } from './settle.helper.js';

type RotationScheduleContext = { rotation: Rotation; schedule: Schedule | null };

function toOccurrenceDto(
  date: Date | string,
  assignment: OccurrenceAssignment | null,
  queue: Member[],
  nextIndex: number,
  offset: number,
  isPast: boolean,
): OccurrenceDto {
  const dateStr = typeof date === 'string' ? date : toIsoDate(date);
  if (assignment) {
    if (assignment.skipType === 'date') {
      return {
        date: dateStr,
        memberId: null,
        memberName: null,
        isPast,
        cancelledMemberId: assignment.member?.id ?? null,
        cancelledMemberName: assignment.member?.name ?? null,
      };
    }
    return {
      date: dateStr,
      memberId: assignment.member?.id ?? null,
      memberName: assignment.member?.name ?? null,
      isPast,
      cancelledMemberId: null,
      cancelledMemberName: null,
    };
  }
  if (queue.length === 0) {
    return {
      date: dateStr,
      memberId: null,
      memberName: null,
      isPast,
      cancelledMemberId: null,
      cancelledMemberName: null,
    };
  }
  const member = queue[(nextIndex + offset) % queue.length];
  return {
    date: dateStr,
    memberId: member?.id ?? null,
    memberName: member?.name ?? null,
    isPast,
    cancelledMemberId: null,
    cancelledMemberName: null,
  };
}

@Injectable()
export class OccurrenceService {
  constructor(private readonly orm: MikroORM) {}

  async getWindow(slug: string, pastCount = 2, futureCount = 2): Promise<OccurrenceWindowDto> {
    const em = this.orm.em.fork();
    const { rotation, schedule } = await this.getRotationScheduleContext(em, slug);
    if (!schedule) return { past: [], next: null, future: [] };

    await settleRotation(rotation, schedule, em);

    const todayStr = toIsoDate(localToday());
    const pastAssignments = await em.find(
      OccurrenceAssignment,
      { rotation, occurrenceDate: { $lt: todayStr } as unknown as string },
      { orderBy: { occurrenceDate: 'DESC' }, limit: pastCount, populate: ['member'] },
    );
    const past: OccurrenceDto[] = pastAssignments
      .toReversed()
      .map((a) => toOccurrenceDto(new Date(a.occurrenceDate), a, [], 0, 0, true));

    const queue = await getActiveQueue(em, rotation);
    let nextDate: Date | null = null;

    if (schedule.type === 'recurrence_rule') {
      nextDate = getFutureRecurrenceDatesAfter(schedule, localYesterday(), 1)[0] ?? null;
    } else {
      const scheduleDates = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
      const upcoming = scheduleDates.find((sd) => sd.date >= todayStr);
      nextDate = upcoming ? new Date(upcoming.date) : null;
    }

    let nextAssignment: OccurrenceAssignment | null = null;
    let next: OccurrenceDto | null = null;
    if (nextDate) {
      const nextDateStr = toIsoDate(nextDate);
      nextAssignment = await em.findOne(
        OccurrenceAssignment,
        { rotation, occurrenceDate: nextDateStr },
        { populate: ['member'] },
      );
      next = toOccurrenceDto(nextDate, nextAssignment, queue, rotation.nextIndex, 0, false);
    }

    const future: OccurrenceDto[] = [];
    if (next && nextDate) {
      let futureDates: Date[];
      if (schedule.type === 'recurrence_rule') {
        futureDates = getFutureRecurrenceDatesAfter(schedule, nextDate, futureCount);
      } else {
        const scheduleDates = await em.find(
          ScheduleDate,
          { schedule },
          { orderBy: { date: 'ASC' } },
        );
        const nextDateStr = toIsoDate(nextDate);
        futureDates = scheduleDates
          .map((r) => new Date(r.date))
          .filter((d) => toIsoDate(d) > nextDateStr)
          .slice(0, futureCount);
      }
      if (futureDates.length > 0) {
        const futureDateStrs = futureDates.map((d) => toIsoDate(d));
        const futureAssignments = await em.find(
          OccurrenceAssignment,
          { rotation, occurrenceDate: { $in: futureDateStrs } as unknown as string },
          { populate: ['member'] },
        );
        const assignmentMap = new Map(
          futureAssignments.map((a) => [toIsoDate(new Date(a.occurrenceDate)), a]),
        );
        const nextDateStr = toIsoDate(nextDate);
        const allFutureDatesFromToday = [nextDateStr, ...futureDateStrs];
        const nextIsTransparent = nextAssignment?.skipType === 'date';
        const transparentFutureDates = new Set([
          ...(nextIsTransparent ? [nextDateStr] : []),
          ...futureDateStrs.filter((s) => {
            const st = assignmentMap.get(s)?.skipType;
            return st === 'date';
          }),
        ]);
        for (const d of futureDates) {
          const dateStr = toIsoDate(d);
          const assignment = assignmentMap.get(dateStr) ?? null;
          if (assignment) {
            future.push(toOccurrenceDto(d, assignment, queue, rotation.nextIndex, 0, false));
          } else {
            const member = deriveFutureMember(
              queue,
              rotation.nextIndex,
              transparentFutureDates,
              allFutureDatesFromToday,
              dateStr,
            );
            future.push({
              date: dateStr,
              memberId: member?.id ?? null,
              memberName: member?.name ?? null,
              isPast: false,
              cancelledMemberId: null,
              cancelledMemberName: null,
            });
          }
        }
      }
    }

    return { past, next, future };
  }

  async browse(
    slug: string,
    after?: string,
    before?: string,
    limit = 1,
  ): Promise<BrowseOccurrencesResponseDto> {
    this.assertBrowseDirectionOrThrow(after, before);
    this.assertBrowseLimitOrThrow(limit);
    const anchor = after ?? before!;
    assertIsoDateOrBadRequest(anchor, {
      statusCode: 400,
      error: 'INVALID_DATE',
      message: 'Date must be YYYY-MM-DD',
    });

    const em = this.orm.em.fork();
    const { rotation, schedule } = await this.getRotationScheduleContext(em, slug);
    if (!schedule) return { occurrences: [], hasMore: false };

    await settleRotation(rotation, schedule, em);

    const queue = await getActiveQueue(em, rotation);

    if (after !== undefined) {
      return browseForward(em, rotation, schedule, queue, after, limit);
    }
    return browseBackward(em, rotation, schedule, queue, before!, limit);
  }

  private async getRotationScheduleContext(
    em: EntityManager,
    slug: string,
  ): Promise<RotationScheduleContext> {
    const rotation = await getRotationOrThrow(em, slug);
    const schedule = await em.findOne(Schedule, { rotation });
    return { rotation, schedule };
  }

  private assertBrowseDirectionOrThrow(after?: string, before?: string): void {
    if (
      (after !== undefined && before !== undefined) ||
      (after === undefined && before === undefined)
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_PARAMS',
        message: 'Provide exactly one of after or before',
      });
    }
  }

  private assertBrowseLimitOrThrow(limit: number): void {
    if (limit < 1 || limit > 10) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_LIMIT',
        message: 'limit must be 1–10',
      });
    }
  }
}
