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
  let idx = startIndex;
  for (const date of unsettledDates) {
    result.push({
      date,
      member: queue.length > 0 ? (queue[idx % queue.length] ?? null) : null,
    });
    if (queue.length > 0) {
      idx = (idx + 1) % queue.length;
    }
  }
  return result;
}
