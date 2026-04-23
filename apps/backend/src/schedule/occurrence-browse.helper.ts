import type { EntityManager } from '@mikro-orm/core';

import type { BrowseOccurrencesResponseDto, OccurrenceDto } from '@whos-next/shared';

import type { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import type { Rotation } from '../rotations/rotation.entity.js';

import { toIsoDate, localYesterday, localToday } from './occurrence.helper.js';
import { getFutureRecurrenceDatesAfter } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import type { Schedule } from './schedule.entity.js';

function derivedMemberForFuture(
  queue: Member[],
  nextIndex: number,
  offset: number,
): { memberId: string | null; memberName: string | null } {
  if (queue.length === 0) return { memberId: null, memberName: null };
  const member = queue[(nextIndex + offset) % queue.length];
  return { memberId: member?.id ?? null, memberName: member?.name ?? null };
}

export async function browseForward(
  em: EntityManager,
  rotation: Rotation,
  schedule: Schedule,
  queue: Member[],
  after: string,
  limit: number,
): Promise<BrowseOccurrencesResponseDto> {
  const anchorDate = new Date(after);
  let futureDates: Date[];

  if (schedule.type === 'recurrence_rule') {
    futureDates = getFutureRecurrenceDatesAfter(schedule, anchorDate, limit + 1);
  } else {
    const rows = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
    futureDates = rows
      .map((r) => new Date(r.date))
      .filter((d) => toIsoDate(d) > after)
      .slice(0, limit + 1);
  }

  const hasMore = futureDates.length > limit;
  const pageDates = futureDates.slice(0, limit);

  const occurrences = pageDates.map((date, i): OccurrenceDto => {
    const { memberId, memberName } = derivedMemberForFuture(queue, rotation.nextIndex, i);
    return { date: toIsoDate(date), memberId, memberName, isPast: false };
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
    { rotation },
    { orderBy: { occurrenceDate: 'DESC' }, limit: limit + 1, populate: ['member'] },
  );
  const pastBefore = assignments.filter((a) => toIsoDate(new Date(a.occurrenceDate)) < before);

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
  const futureBefore = allFutureDates.filter((d) => toIsoDate(d) < before);

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
      return {
        date: c.date,
        memberId: c.a.member?.id ?? null,
        memberName: c.a.member?.name ?? null,
        isPast: true,
      };
    }
    const { memberId, memberName } = derivedMemberForFuture(queue, rotation.nextIndex, c.offset);
    return { date: c.date, memberId, memberName, isPast: false };
  });

  return { occurrences, hasMore };
}
