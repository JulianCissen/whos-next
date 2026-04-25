import type { EntityManager } from '@mikro-orm/core';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import type { Rotation } from '../rotations/rotation.entity.js';

import { toIsoDate, localYesterday } from './occurrence.helper.js';
import { getElapsedRecurrenceDates } from './recurrence.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import type { Schedule } from './schedule.entity.js';

export async function settleRotation(
  rotation: Rotation,
  schedule: Schedule,
  em: EntityManager,
): Promise<void> {
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

  const queue = await em.find(
    Member,
    { rotation, removedAt: null },
    { orderBy: { position: 'ASC' } },
  );
  let idx = rotation.nextIndex;
  for (const d of unsettled) {
    if (queue.length > 0) {
      const a = new OccurrenceAssignment();
      a.rotation = rotation;
      a.occurrenceDate = toIsoDate(d) as unknown as string;
      a.member = queue[idx % queue.length]!;
      a.skipType = null;
      em.persist(a);
      idx = (idx + 1) % queue.length;
    }
  }
  rotation.nextIndex = queue.length > 0 ? idx : rotation.nextIndex;
  await em.flush();
}
