import { computeRecurrenceDates } from '@whos-next/shared';

import type { Schedule } from './schedule.entity.js';

const MAX_SETTLE_LIMIT = 10_000;

/**
 * Convert a Schedule entity's rrule fields to the shared RecurrenceRuleDto shape.
 * Assumes the schedule has `type = 'recurrence_rule'` and rrule fields set.
 */
function toRuleDto(schedule: Schedule) {
  return {
    type: schedule.rruleType as 'weekly' | 'every_n_weeks' | 'monthly',
    dayOfWeek: (schedule.dayOfWeek ?? undefined) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined,
    intervalN: schedule.intervalN ?? undefined,
    monthlyDay: schedule.monthlyDay ?? undefined,
  } as const;
}

function isConfiguredRecurrenceSchedule(schedule: Schedule): boolean {
  return (
    schedule.type === 'recurrence_rule' &&
    schedule.startDate !== null &&
    schedule.rruleType !== null
  );
}

function recurrenceStartDate(schedule: Schedule): Date {
  return new Date(schedule.startDate!);
}

/**
 * Return all recurrence dates for a schedule that fall strictly before `before`.
 * Used by the settlement pass to compute elapsed dates.
 */
export function getElapsedRecurrenceDates(schedule: Schedule, before: Date): Date[] {
  if (!isConfiguredRecurrenceSchedule(schedule)) return [];
  const all = computeRecurrenceDates(
    toRuleDto(schedule),
    recurrenceStartDate(schedule),
    new Date(0),
    MAX_SETTLE_LIMIT,
  );
  return all.filter((d) => d < before);
}

/**
 * Return future recurrence dates starting strictly after `after`.
 * Used by the browse endpoint.
 */
export function getFutureRecurrenceDatesAfter(
  schedule: Schedule,
  after: Date,
  limit: number,
): Date[] {
  if (!isConfiguredRecurrenceSchedule(schedule)) return [];
  const afterNext = new Date(after.getFullYear(), after.getMonth(), after.getDate() + 1);
  return computeRecurrenceDates(
    toRuleDto(schedule),
    recurrenceStartDate(schedule),
    afterNext,
    limit,
  );
}
