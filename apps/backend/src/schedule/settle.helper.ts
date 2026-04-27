import type { EntityManager } from '@mikro-orm/core';

import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import type { Rotation } from '../rotations/rotation.entity.js';

import { toIsoDate, localYesterday } from './occurrence.helper.js';
import { getElapsedRecurrenceDates } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import { getActiveQueue } from './schedule-domain.util.js';
import type { Schedule } from './schedule.entity.js';

async function getElapsedDates(schedule: Schedule, em: EntityManager): Promise<Date[]> {
  const yesterday = localYesterday();
  if (schedule.type === 'recurrence_rule') {
    return getElapsedRecurrenceDates(
      schedule,
      new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1),
    );
  }

  const rows = await em.find(ScheduleDate, { schedule }, { orderBy: { date: 'ASC' } });
  return rows.map((row) => new Date(row.date)).filter((date) => date <= yesterday);
}

function toSettledDateSet(settled: OccurrenceAssignment[]): Set<string> {
  return new Set(settled.map((assignment) => toIsoDate(new Date(assignment.occurrenceDate))));
}

function getUnsettledDates(elapsedDates: Date[], settledDates: Set<string>): Date[] {
  return elapsedDates.filter((date) => !settledDates.has(toIsoDate(date)));
}

async function persistUnsettledAssignments(
  em: EntityManager,
  rotation: Rotation,
  unsettled: Date[],
): Promise<number> {
  const queue = await getActiveQueue(em, rotation);
  if (queue.length === 0) {
    return rotation.nextIndex;
  }

  let nextIndex = rotation.nextIndex;
  for (const date of unsettled) {
    const assignment = new OccurrenceAssignment();
    assignment.rotation = rotation;
    assignment.occurrenceDate = toIsoDate(date) as unknown as string;
    assignment.member = queue[nextIndex % queue.length]!;
    assignment.skipType = null;
    em.persist(assignment);
    nextIndex = (nextIndex + 1) % queue.length;
  }

  return nextIndex;
}

export async function settleRotation(
  rotation: Rotation,
  schedule: Schedule,
  em: EntityManager,
): Promise<void> {
  const elapsedDates = await getElapsedDates(schedule, em);
  if (elapsedDates.length === 0) return;

  const settled = await em.find(OccurrenceAssignment, { rotation });
  const settledSet = toSettledDateSet(settled);
  const unsettled = getUnsettledDates(elapsedDates, settledSet);
  if (unsettled.length === 0) return;

  rotation.nextIndex = await persistUnsettledAssignments(em, rotation, unsettled);
  await em.flush();
}
