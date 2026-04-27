import { MikroORM } from '@mikro-orm/core';
import { ConflictException, Injectable } from '@nestjs/common';

import type { CancelOccurrenceResponseDto, UncancelOccurrenceResponseDto } from '@whos-next/shared';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';

import { toIsoDate, localToday, localYesterday, deriveFutureMember } from './occurrence.helper.js';
import { getElapsedRecurrenceDates, getFutureRecurrenceDatesAfter } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import {
  assertIsoDateOrBadRequest,
  getActiveQueue,
  getRotationOrThrow,
  throwOccurrenceNotInSchedule,
} from './schedule-domain.util.js';
import { Schedule } from './schedule.entity.js';
import { settleRotation } from './settle.helper.js';

const MAX_FUTURE_LIMIT = 10_000;

@Injectable()
export class CancelService {
  constructor(private readonly orm: MikroORM) {}

  async cancel(slug: string, date: string): Promise<CancelOccurrenceResponseDto> {
    assertIsoDateOrBadRequest(date, {
      statusCode: 400,
      error: 'INVALID_DATE',
      message: 'Date must be YYYY-MM-DD',
    });

    const em = this.orm.em.fork();
    const rotation = await getRotationOrThrow(em, slug);
    const schedule = await em.findOne(Schedule, { rotation });
    if (!schedule) {
      throwOccurrenceNotInSchedule();
    }

    await settleRotation(rotation, schedule, em);

    const inSchedule = await this.isDateInSchedule(date, schedule, em);
    if (!inSchedule) {
      throwOccurrenceNotInSchedule();
    }

    const existingAssignment = await em.findOne(
      OccurrenceAssignment,
      { rotation, occurrenceDate: date },
      { populate: ['member'] },
    );

    if (existingAssignment?.skipType !== null && existingAssignment?.skipType !== undefined) {
      throw new ConflictException({
        statusCode: 409,
        error: 'OCCURRENCE_ALREADY_SKIPPED',
        message: 'This occurrence has already been skipped',
      });
    }

    const queue = await getActiveQueue(em, rotation);

    let wouldHaveBeen: Member;
    if (existingAssignment) {
      wouldHaveBeen = existingAssignment.member;
    } else {
      const allFutureDates = await this.allFutureDatesFromToday(schedule, em);
      const transparentAssignments = await em.find(OccurrenceAssignment, {
        rotation,
        skipType: 'date',
      });
      const transparentDates = new Set(
        transparentAssignments.map((a) => toIsoDate(new Date(a.occurrenceDate))),
      );
      wouldHaveBeen = deriveFutureMember(
        queue,
        rotation.nextIndex,
        transparentDates,
        allFutureDates,
        date,
      )!;
    }

    if (existingAssignment) {
      existingAssignment.skipType = 'date';
    } else {
      const newAssignment = new OccurrenceAssignment();
      newAssignment.rotation = rotation;
      newAssignment.occurrenceDate = date as unknown as string;
      newAssignment.member = wouldHaveBeen;
      newAssignment.skipType = 'date';
      em.persist(newAssignment);
    }
    await em.flush();

    const isPast = date < toIsoDate(localToday());
    return {
      date,
      memberId: null,
      memberName: null,
      isPast,
      cancelledMemberId: wouldHaveBeen.id,
      cancelledMemberName: wouldHaveBeen.name,
    };
  }

  async uncancel(slug: string, date: string): Promise<UncancelOccurrenceResponseDto> {
    assertIsoDateOrBadRequest(date, {
      statusCode: 400,
      error: 'INVALID_DATE',
      message: 'Date must be YYYY-MM-DD',
    });
    const em = this.orm.em.fork();
    const rotation = await getRotationOrThrow(em, slug);
    const assignment = await em.findOne(
      OccurrenceAssignment,
      { rotation, occurrenceDate: date },
      { populate: ['member'] },
    );
    if (assignment?.skipType !== 'date') {
      throw new ConflictException({
        statusCode: 409,
        error: 'OCCURRENCE_NOT_CANCELLED',
        message: 'This occurrence is not cancelled',
      });
    }
    const { id: memberId, name: memberName } = assignment.member;
    em.remove(assignment);
    await em.flush();
    return {
      date,
      memberId,
      memberName,
      isPast: false,
      cancelledMemberId: null,
      cancelledMemberName: null,
    };
  }

  private async isDateInSchedule(
    date: string,
    schedule: Schedule,
    em: ReturnType<typeof this.orm.em.fork>,
  ): Promise<boolean> {
    if (schedule.type === 'recurrence_rule') {
      if (!schedule.startDate || !schedule.rruleType) return false;
      const startDate = new Date(schedule.startDate);
      const targetDate = new Date(date);
      const all = getFutureRecurrenceDatesAfter(
        schedule,
        new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 1),
        MAX_FUTURE_LIMIT,
      );
      return (
        all.some((d) => toIsoDate(d) === date) ||
        getElapsedRecurrenceDates(
          schedule,
          new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
        ).some((d) => toIsoDate(d) === date)
      );
    }
    const row = await em.findOne(ScheduleDate, { schedule, date: date as unknown as string });
    return row !== null;
  }

  private async allFutureDatesFromToday(
    schedule: Schedule,
    em: ReturnType<typeof this.orm.em.fork>,
  ): Promise<string[]> {
    const todayStr = toIsoDate(localToday());
    if (schedule.type === 'recurrence_rule') {
      return getFutureRecurrenceDatesAfter(schedule, localYesterday(), MAX_FUTURE_LIMIT).map((d) =>
        toIsoDate(d),
      );
    }
    const rows = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
    return rows.map((r) => toIsoDate(new Date(r.date))).filter((d) => d >= todayStr);
  }
}
