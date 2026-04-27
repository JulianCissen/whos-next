import type { Member } from '../members/member.entity.js';

/** Format a Date as "YYYY-MM-DD" without time/timezone. */
export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return a Date object representing today at midnight (no time component). */
export function localToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Return a Date object representing yesterday at midnight. */
export function localYesterday(): Date {
  const today = localToday();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
}

/**
 * Returns the rotation member assigned to `targetDate`, treating transparent dates as
 * non-advancing (they do not advance the rotation counter).
 *
 * Transparent dates include any date with a date-cancel assignment ('date').
 * `allFutureDatesFromToday` must be sorted ASC and include every schedule date >= today.
 * `transparentDates` is the set of transparent ones.
 */
export function deriveFutureMember(
  queue: Member[],
  nextIndex: number,
  transparentDates: Set<string>,
  allFutureDatesFromToday: string[],
  targetDate: string,
): Member | null {
  if (queue.length === 0) return null;
  let effectiveOffset = 0;
  for (const d of allFutureDatesFromToday) {
    if (d === targetDate) {
      return queue[(nextIndex + effectiveOffset) % queue.length] ?? null;
    }
    if (!transparentDates.has(d)) effectiveOffset++;
  }
  return null;
}

export interface RetroactiveAssignment {
  date: Date;
  member: Member | null;
}

/**
 * Assign members to unsettled elapsed dates in round-robin order.
 * Returns assignments in chronological order.
 */
export function computeRetroactiveAssignments(
  unsettledDates: Date[],
  queue: Member[],
  startIndex: number,
): RetroactiveAssignment[] {
  const result: RetroactiveAssignment[] = [];
  let nextIndex = startIndex;
  for (const date of unsettledDates) {
    result.push({
      date,
      member: queue.length > 0 ? (queue[nextIndex % queue.length] ?? null) : null,
    });
    if (queue.length > 0) {
      nextIndex = (nextIndex + 1) % queue.length;
    }
  }
  return result;
}
