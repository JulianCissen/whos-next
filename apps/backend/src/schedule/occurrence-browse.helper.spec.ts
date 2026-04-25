import { describe, expect, it, vi } from 'vitest';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { browseBackward, browseForward } from './occurrence-browse.helper.js';
import { ScheduleDate } from './schedule-date.entity.js';
import { Schedule } from './schedule.entity.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRotation(nextIndex = 0): Rotation {
  const r = new Rotation();
  r.id = 'rot-1';
  r.slug = 'aBcDeFgH';
  r.name = 'Test';
  r.nextIndex = nextIndex;
  r.lastAccessedAt = new Date('2026-01-01');
  r.createdAt = new Date('2026-01-01');
  r.updatedAt = new Date('2026-01-01');
  return r;
}

function makeSchedule(): Schedule {
  const s = new Schedule();
  s.type = 'custom_date_list';
  s.rruleType = null;
  s.dayOfWeek = null;
  s.intervalN = null;
  s.monthlyDay = null;
  s.startDate = null;
  s.createdAt = new Date('2026-01-01');
  s.updatedAt = new Date('2026-01-01');
  return s;
}

function makeMember(name: string, id: string, position = 1): Member {
  const m = new Member();
  m.id = id;
  m.name = name;
  m.position = position;
  m.removedAt = null;
  m.createdAt = new Date('2026-01-01');
  m.updatedAt = new Date('2026-01-01');
  return m;
}

function makeScheduleDate(date: string): ScheduleDate {
  const sd = new ScheduleDate();
  sd.date = date as unknown as string;
  sd.createdAt = new Date('2026-01-01');
  sd.updatedAt = new Date('2026-01-01');
  return sd;
}

function makeAssignment(
  date: string,
  member: Member,
  skipType: 'date' | null = null,
): OccurrenceAssignment {
  const a = new OccurrenceAssignment();
  a.occurrenceDate = date as unknown as string;
  a.member = member;
  a.skipType = skipType;
  a.createdAt = new Date('2026-01-01');
  a.updatedAt = new Date('2026-01-01');
  return a;
}

/**
 * Build an em mock that discriminates by entity class.
 * `assignmentsForBrowse` is returned for OccurrenceAssignment (browse query).
 * `scheduleDates` is returned for ScheduleDate.
 */
function makeEmMock({
  scheduleDates = [],
  assignmentsForBrowse = [],
}: {
  scheduleDates?: ScheduleDate[];
  assignmentsForBrowse?: OccurrenceAssignment[];
}) {
  return {
    find: vi.fn().mockImplementation((entity: unknown) => {
      if (entity === OccurrenceAssignment) return assignmentsForBrowse;
      if (entity === ScheduleDate) return scheduleDates;
      return [];
    }),
  } as never;
}

// ---------------------------------------------------------------------------
// browseForward
// ---------------------------------------------------------------------------

describe('browseForward — queue-based derivation (no assignments)', () => {
  it('returns occurrences with members derived from the queue offset', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'].map(makeScheduleDate);
    const em = makeEmMock({ scheduleDates: dates });

    const result = await browseForward(em, rotation, schedule, [alice, bob], '2099-05-01', 3);

    expect(result.occurrences).toHaveLength(3);
    expect(result.occurrences[0]?.memberId).toBe('m-alice'); // offset 0
    expect(result.occurrences[1]?.memberId).toBe('m-bob'); // offset 1
    expect(result.occurrences[2]?.memberId).toBe('m-alice'); // offset 2 % 2 = 0
    expect(result.occurrences.every((o) => o.cancelledMemberId === null)).toBe(true);
  });

  it('hasMore is false when fewer dates remain than limit+1', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const dates = ['2099-06-01'].map(makeScheduleDate);
    const em = makeEmMock({ scheduleDates: dates });

    const result = await browseForward(em, rotation, schedule, [alice], '2099-05-01', 5);

    expect(result.hasMore).toBe(false);
    expect(result.occurrences).toHaveLength(1);
  });

  it('hasMore is true when more dates exist beyond the page', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'].map(makeScheduleDate);
    const em = makeEmMock({ scheduleDates: dates });

    const result = await browseForward(em, rotation, schedule, [alice], '2099-05-01', 2);

    expect(result.hasMore).toBe(true);
    expect(result.occurrences).toHaveLength(2);
  });
});

describe('browseForward — date-cancel offset drift fix', () => {
  it('does NOT advance the queue offset for a date-cancelled occurrence', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);
    const carol = makeMember('Carol', 'm-carol', 3);

    // Three future dates; first one is date-cancelled (Alice would have been assigned)
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'].map(makeScheduleDate);
    const cancelAssignment = makeAssignment('2099-06-01', alice, 'date');
    const em = makeEmMock({ scheduleDates: dates, assignmentsForBrowse: [cancelAssignment] });

    const result = await browseForward(
      em,
      rotation,
      schedule,
      [alice, bob, carol],
      '2099-05-01',
      3,
    );

    const [first, second, third] = result.occurrences;

    // First entry: cancelled, shows Alice as the would-have-been member
    expect(first?.memberId).toBeNull();
    expect(first?.cancelledMemberId).toBe('m-alice');
    expect(first?.cancelledMemberName).toBe('Alice');
    expect(first?.isPast).toBe(false);

    // Second entry: offset = i(1) - dateSkipsBefore(1) = 0 → Alice (not Bob)
    // Without the fix this would be Bob (offset=1)
    expect(second?.memberId).toBe('m-alice');
    expect(second?.cancelledMemberId).toBeNull();

    // Third entry: offset = i(2) - dateSkipsBefore(1) = 1 → Bob
    expect(third?.memberId).toBe('m-bob');
  });

  it('correctly adjusts offset when date-cancel is in the middle of the page', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);

    // First: Alice (normal), second: Bob (cancelled), third: Bob (same as second without drift)
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'].map(makeScheduleDate);
    const cancelAssignment = makeAssignment('2099-07-01', bob, 'date');
    const em = makeEmMock({ scheduleDates: dates, assignmentsForBrowse: [cancelAssignment] });

    const result = await browseForward(em, rotation, schedule, [alice, bob], '2099-05-01', 3);

    const [first, second, third] = result.occurrences;

    // First: no assignment, offset = 0 - 0 = 0 → Alice
    expect(first?.memberId).toBe('m-alice');

    // Second: date-cancel for Bob
    expect(second?.memberId).toBeNull();
    expect(second?.cancelledMemberId).toBe('m-bob');

    // Third: offset = 2 - 1 (one skip before) = 1 → Bob
    // Without the fix this would be Alice (offset 2 % 2 = 0)
    expect(third?.memberId).toBe('m-bob');
  });
});

describe('browseForward — pre-page cancellation offset fix', () => {
  it('accounts for a date-cancel that falls before the page start', async () => {
    // nextIndex=1 (Bob's turn). '2099-06-01' is Bob's occurrence and was cancelled.
    // Paging forward with after='2099-06-01' → page = ['2099-07-01', '2099-08-01'].
    // Without the fix the offset resets to 0 and gives queue[1]=Bob for both;
    // with the fix '2099-07-01' → Bob (resumes) and '2099-08-01' → Alice (correct sequence).
    const rotation = makeRotation(1);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);

    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'].map(makeScheduleDate);
    const cancelAssignment = makeAssignment('2099-06-01', bob, 'date');
    const em = makeEmMock({ scheduleDates: dates, assignmentsForBrowse: [cancelAssignment] });

    const result = await browseForward(em, rotation, schedule, [alice, bob], '2099-06-01', 2);

    expect(result.occurrences).toHaveLength(2);
    expect(result.occurrences[0]?.memberId).toBe('m-bob'); // Bob resumes
    expect(result.occurrences[0]?.cancelledMemberId).toBeNull();
    expect(result.occurrences[1]?.memberId).toBe('m-alice'); // Alice follows
  });
});

// ---------------------------------------------------------------------------
// browseBackward
// ---------------------------------------------------------------------------

describe('browseBackward — settled past occurrences', () => {
  it('returns normal settled occurrences in descending order', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);

    const a1 = makeAssignment('2099-05-01', alice);
    const a2 = makeAssignment('2099-04-01', bob);

    // No future schedule dates → futureBefore will be empty
    const em = makeEmMock({ scheduleDates: [], assignmentsForBrowse: [a1, a2] });

    const result = await browseBackward(em, rotation, schedule, [alice, bob], '2099-06-01', 5);

    expect(result.occurrences).toHaveLength(2);
    // browseBackward returns page in descending order (sorted that way)
    expect(result.occurrences[0]?.date).toBe('2099-05-01');
    expect(result.occurrences[0]?.memberId).toBe('m-alice');
    expect(result.occurrences[1]?.date).toBe('2099-04-01');
    expect(result.occurrences[1]?.memberId).toBe('m-bob');
  });

  it('returns a date-cancel occurrence with cancelledMemberId set', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);

    const cancelAssignment = makeAssignment('2099-05-01', alice, 'date');
    const em = makeEmMock({ scheduleDates: [], assignmentsForBrowse: [cancelAssignment] });

    const result = await browseBackward(em, rotation, schedule, [alice], '2099-06-01', 5);

    expect(result.occurrences[0]?.memberId).toBeNull();
    expect(result.occurrences[0]?.cancelledMemberId).toBe('m-alice');
    expect(result.occurrences[0]?.cancelledMemberName).toBe('Alice');
  });
});

describe('browseBackward — dedup fix for date-cancelled future occurrences', () => {
  it('excludes future dates with existing assignments from futureBefore candidates', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);

    // A future date that has been date-cancelled (it is "settled" even though future)
    const cancelAssignment = makeAssignment('2099-06-01', alice, 'date');

    // The schedule has that same date as a future date
    const dates = [makeScheduleDate('2099-06-01')];

    const em = makeEmMock({ scheduleDates: dates, assignmentsForBrowse: [cancelAssignment] });

    // browsing backward from 2099-07-01 → '2099-06-01' is before anchor
    const result = await browseBackward(em, rotation, schedule, [alice], '2099-07-01', 5);

    // Should appear exactly ONCE (from pastBefore, not additionally from futureBefore)
    const dateEntries = result.occurrences.filter((o) => o.date === '2099-06-01');
    expect(dateEntries).toHaveLength(1);
    expect(dateEntries[0]?.cancelledMemberId).toBe('m-alice');
  });

  it('includes unsettled future dates before the anchor', async () => {
    const rotation = makeRotation(0);
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);

    // Two future schedule dates before anchor; neither is settled
    const dates = ['2099-05-01', '2099-06-01'].map(makeScheduleDate);
    const em = makeEmMock({ scheduleDates: dates, assignmentsForBrowse: [] });

    const result = await browseBackward(em, rotation, schedule, [alice, bob], '2099-07-01', 5);

    expect(result.occurrences).toHaveLength(2);
    // Unsettled futures get queue-based member derivation
    expect(result.occurrences.every((o) => o.cancelledMemberId === null)).toBe(true);
  });
});
