export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=Mon … 7=Sun

export type ScheduleType = 'recurrence_rule' | 'custom_date_list';
export type RecurrenceRuleType = 'weekly' | 'every_n_weeks' | 'monthly';

// ---- Rule & schedule shapes ----

export interface RecurrenceRuleDto {
  type: RecurrenceRuleType;
  dayOfWeek?: IsoWeekday; // weekly, every_n_weeks
  intervalN?: number; // every_n_weeks (≥ 2)
  monthlyDay?: number; // monthly (1–31)
}

export interface ScheduleDto {
  type: ScheduleType;
  recurrenceRule?: RecurrenceRuleDto; // present when type = recurrence_rule
  startDate?: string; // ISO date; present when type = recurrence_rule
  dates?: string[]; // sorted ISO dates; present when type = custom_date_list
}

export interface CreateRotationScheduleDto {
  type: ScheduleType;
  recurrenceRule?: RecurrenceRuleDto; // required when type = 'recurrence_rule'
  startDate?: string; // ISO date; defaults to today server-side
}

// ---- Occurrence shapes ----

export interface OccurrenceDto {
  date: string; // ISO date "YYYY-MM-DD"
  memberId: string | null;
  memberName: string | null;
  isPast: boolean;
}

export interface OccurrenceWindowDto {
  previous: OccurrenceDto | null;
  next: OccurrenceDto | null;
}

export interface BrowseOccurrencesResponseDto {
  occurrences: OccurrenceDto[];
  hasMore: boolean;
}

// ---- Request DTOs ----

export interface ConfigureRecurrenceRuleRequestDto {
  rule: RecurrenceRuleDto;
  startDate?: string; // ISO date; defaults to today server-side
}

export interface SwitchScheduleTypeRequestDto {
  type: ScheduleType;
}

export interface AddCustomDateRequestDto {
  date: string; // "YYYY-MM-DD"
}

export interface CustomDateDto {
  date: string;
}

// ---- Pure compute function ----

function isoToJsDay(isoDay: IsoWeekday): number {
  // ISO 7 = Sunday → JS 0; ISO 1 = Monday → JS 1
  return isoDay % 7;
}

function cloneDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function firstOccurrenceWeekly(rule: RecurrenceRuleDto, startDate: Date): Date {
  const target = isoToJsDay(rule.dayOfWeek!);
  let cur = cloneDate(startDate);
  while (cur.getDay() !== target) {
    cur = addDays(cur, 1);
  }
  return cur;
}

function nextMonthlyCandidate(y: number, m: number, day: number): Date | null {
  const candidate = new Date(y, m, day);
  if (candidate.getDate() !== day) return null; // JS overflow → skip
  return candidate;
}

function firstOccurrenceMonthly(rule: RecurrenceRuleDto, startDate: Date): Date {
  const day = rule.monthlyDay!;
  let y = startDate.getFullYear();
  let m = startDate.getMonth();
  const candidate = nextMonthlyCandidate(y, m, day);
  if (candidate !== null && candidate >= startDate) return candidate;
  for (let i = 0; i < 1200; i++) {
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    const next = nextMonthlyCandidate(y, m, day);
    if (next !== null) return next;
  }
  return cloneDate(startDate);
}

function nextOccurrenceFromCurrent(rule: RecurrenceRuleDto, current: Date): Date {
  if (rule.type === 'weekly') {
    return addDays(current, 7);
  }
  if (rule.type === 'every_n_weeks') {
    return addDays(current, 7 * rule.intervalN!);
  }
  // monthly
  const day = rule.monthlyDay!;
  let y = current.getFullYear();
  let m = current.getMonth() + 1;
  if (m > 11) {
    m = 0;
    y++;
  }
  for (let i = 0; i < 1200; i++) {
    const next = nextMonthlyCandidate(y, m, day);
    if (next !== null) return next;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return addDays(current, 30);
}

/**
 * Generate occurrence dates for a recurrence rule.
 *
 * @param rule       - Validated recurrence rule configuration.
 * @param startDate  - Series anchor; first occurrence falls on or after this date.
 * @param from       - Only return dates on or after this date (for browsing).
 * @param limit      - Maximum number of dates to return (prevents infinite loops).
 */
export function computeRecurrenceDates(
  rule: RecurrenceRuleDto,
  startDate: Date,
  from: Date,
  limit: number,
): Date[] {
  const results: Date[] = [];
  let current =
    rule.type === 'monthly'
      ? firstOccurrenceMonthly(rule, startDate)
      : firstOccurrenceWeekly(rule, startDate);

  while (results.length < limit) {
    if (current.getFullYear() >= 9999) break;
    if (current >= from) {
      results.push(cloneDate(current));
    }
    current = nextOccurrenceFromCurrent(rule, current);
  }

  return results;
}
