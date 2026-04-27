import type { EntityManager } from '@mikro-orm/core';

import type { BrowseOccurrencesResponseDto, OccurrenceDto } from '@whos-next/shared';

import type { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import type { Rotation } from '../rotations/rotation.entity.js';

import { toIsoDate, localYesterday, localToday, deriveFutureMember } from './occurrence.helper.js';
import { getFutureRecurrenceDatesAfter } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import type { Schedule } from './schedule.entity.js';

const MAX_FUTURE_LOOKUP = 10_000;

function toDateStrings(dates: Date[]): string[] {
  return dates.map((date) => toIsoDate(date));
}

function assignmentByDate(assignments: OccurrenceAssignment[]): Map<string, OccurrenceAssignment> {
  return new Map(
    assignments.map((assignment) => [toIsoDate(new Date(assignment.occurrenceDate)), assignment]),
  );
}

function toCancelledFutureDateSet(assignments: OccurrenceAssignment[]): Set<string> {
  return new Set(assignments.map((assignment) => toIsoDate(new Date(assignment.occurrenceDate))));
}

function toCancelledOccurrence(dateStr: string, assignment: OccurrenceAssignment): OccurrenceDto {
  return {
    date: dateStr,
    memberId: null,
    memberName: null,
    isPast: false,
    cancelledMemberId: assignment.member?.id ?? null,
    cancelledMemberName: assignment.member?.name ?? null,
  };
}

function toAssignedOccurrence(dateStr: string, assignment: OccurrenceAssignment): OccurrenceDto {
  return {
    date: dateStr,
    memberId: assignment.member?.id ?? null,
    memberName: assignment.member?.name ?? null,
    isPast: false,
    cancelledMemberId: null,
    cancelledMemberName: null,
  };
}

export async function browseForward(
  em: EntityManager,
  rotation: Rotation,
  schedule: Schedule,
  queue: Member[],
  after: string,
  limit: number,
): Promise<BrowseOccurrencesResponseDto> {
  const todayStr = toIsoDate(localToday());

  let pageDates: Date[];
  let allFutureDatesInRange: string[];

  if (schedule.type === 'recurrence_rule') {
    const fromYesterday = getFutureRecurrenceDatesAfter(
      schedule,
      localYesterday(),
      MAX_FUTURE_LOOKUP,
    );
    pageDates = fromYesterday.filter((d) => toIsoDate(d) > after).slice(0, limit + 1);
    const lastPageDateStr = pageDates.slice(0, limit).map(toIsoDate).at(-1) ?? '';
    allFutureDatesInRange = fromYesterday
      .map(toIsoDate)
      .filter((d) => d >= todayStr && d <= lastPageDateStr);
  } else {
    const rows = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
    pageDates = rows
      .map((r) => new Date(r.date))
      .filter((d) => toIsoDate(d) > after)
      .slice(0, limit + 1);
    const lastPageDateStr = pageDates.slice(0, limit).map(toIsoDate).at(-1) ?? '';
    allFutureDatesInRange = rows
      .map((r) => toIsoDate(new Date(r.date)))
      .filter((d) => d >= todayStr && d <= lastPageDateStr);
  }

  const hasMore = pageDates.length > limit;
  pageDates = pageDates.slice(0, limit);
  const pageDateStrs = toDateStrings(pageDates);

  const assignments = await em.find(
    OccurrenceAssignment,
    { rotation, occurrenceDate: { $in: pageDateStrs } as unknown as string },
    { populate: ['member'] },
  );
  const assignmentMap = assignmentByDate(assignments);

  const transparentInRange = await em.find(OccurrenceAssignment, {
    rotation,
    skipType: 'date',
    occurrenceDate: { $in: allFutureDatesInRange } as unknown as string,
  });
  const cancelledFutureDates = toCancelledFutureDateSet(transparentInRange);

  const occurrences = pageDates.map((date): OccurrenceDto => {
    const dateStr = toIsoDate(date);
    const assignment = assignmentMap.get(dateStr) ?? null;
    if (assignment) {
      if (assignment.skipType === 'date') {
        return toCancelledOccurrence(dateStr, assignment);
      }
      return toAssignedOccurrence(dateStr, assignment);
    }
    const member = deriveFutureMember(
      queue,
      rotation.nextIndex,
      cancelledFutureDates,
      allFutureDatesInRange,
      dateStr,
    );
    return {
      date: dateStr,
      memberId: member?.id ?? null,
      memberName: member?.name ?? null,
      isPast: false,
      cancelledMemberId: null,
      cancelledMemberName: null,
    };
  });

  // For recurrence-rule, always report hasMore: true (unbounded series)
  const effectiveHasMore = schedule.type === 'recurrence_rule' ? true : hasMore;
  return { occurrences, hasMore: effectiveHasMore };
}

export async function browseBackward(
  em: EntityManager,
  rotation: Rotation,
  schedule: Schedule,
  queue: Member[],
  before: string,
  limit: number,
): Promise<BrowseOccurrencesResponseDto> {
  // Settled past occurrences before the anchor
  const assignments = await em.find(
    OccurrenceAssignment,
    { rotation, occurrenceDate: { $lt: before } as unknown as string },
    {
      orderBy: { occurrenceDate: 'DESC' },
      limit: limit + 1,
      populate: ['member'],
    },
  );
  const pastBefore = assignments;

  // Unsettled future occurrences before the anchor
  const yesterday = localYesterday();
  let allFutureDates: Date[] = [];
  if (schedule.type === 'recurrence_rule') {
    allFutureDates = getFutureRecurrenceDatesAfter(schedule, yesterday, 1000);
  } else {
    const rows = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
    const todayStr = toIsoDate(localToday());
    allFutureDates = rows.map((r) => new Date(r.date)).filter((d) => toIsoDate(d) >= todayStr);
  }
  const settledDateStrs = toCancelledFutureDateSet(assignments);
  const futureBefore = allFutureDates
    .filter((d) => toIsoDate(d) < before)
    .filter((d) => !settledDateStrs.has(toIsoDate(d)));

  // Merge and sort descending
  type Candidate =
    | { kind: 'future'; date: string; offset: number }
    | { kind: 'past'; date: string; a: OccurrenceAssignment };

  const candidates: Candidate[] = [
    ...futureBefore.map((d, i) => ({ kind: 'future' as const, date: toIsoDate(d), offset: i })),
    ...pastBefore.map((a) => ({
      kind: 'past' as const,
      date: toIsoDate(new Date(a.occurrenceDate)),
      a,
    })),
  ];

  candidates.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));

  const hasMore = candidates.length > limit;
  const page = candidates.slice(0, limit);

  const occurrences: OccurrenceDto[] = page.map((c) => {
    if (c.kind === 'past') {
      if (c.a.skipType === 'date') {
        return {
          date: c.date,
          memberId: null,
          memberName: null,
          isPast: true,
          cancelledMemberId: c.a.member?.id ?? null,
          cancelledMemberName: c.a.member?.name ?? null,
        };
      }
      return {
        date: c.date,
        memberId: c.a.member?.id ?? null,
        memberName: c.a.member?.name ?? null,
        isPast: true,
        cancelledMemberId: null,
        cancelledMemberName: null,
      };
    }
    const futureMember =
      queue.length > 0 ? (queue[(rotation.nextIndex + c.offset) % queue.length] ?? null) : null;
    return {
      date: c.date,
      memberId: futureMember?.id ?? null,
      memberName: futureMember?.name ?? null,
      isPast: false,
      cancelledMemberId: null,
      cancelledMemberName: null,
    };
  });

  return { occurrences, hasMore };
}
