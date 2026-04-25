import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { CancelService } from './cancel.service.js';
import { ScheduleDate } from './schedule-date.entity.js';
import { Schedule } from './schedule.entity.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRotation(overrides: Partial<Rotation> = {}): Rotation {
  const r = new Rotation();
  r.id = overrides.id ?? 'rot-1';
  r.slug = overrides.slug ?? 'aBcDeFgH';
  r.name = overrides.name ?? 'Test Rotation';
  r.nextIndex = overrides.nextIndex ?? 0;
  r.lastAccessedAt = new Date('2026-01-01');
  r.createdAt = new Date('2026-01-01');
  r.updatedAt = new Date('2026-01-01');
  return r;
}

function makeSchedule(type: 'custom_date_list' | 'recurrence_rule' = 'custom_date_list'): Schedule {
  const s = new Schedule();
  s.type = type;
  s.rruleType = null;
  s.dayOfWeek = null;
  s.intervalN = null;
  s.monthlyDay = null;
  s.startDate = null;
  s.createdAt = new Date('2026-01-01');
  s.updatedAt = new Date('2026-01-01');
  return s;
}

function makeScheduleDate(date: string): ScheduleDate {
  const sd = new ScheduleDate();
  sd.date = date as unknown as string;
  sd.createdAt = new Date('2026-01-01');
  sd.updatedAt = new Date('2026-01-01');
  return sd;
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
 * Build a minimal ORM double for CancelService tests.
 *
 * Uses `custom_date_list` semantics:
 *  - settle() will be a no-op because `scheduleDates` only contains future dates
 *    (all >= today, so `elapsedDates` will be empty after the <= yesterday filter).
 *  - isDateInSchedule() calls em.findOne(ScheduleDate, ...) → `scheduleDate`
 *  - computeFutureAssignedMember() calls em.find(ScheduleDate, ...) → `scheduleDates`
 */
function makeOrmMock({
  rotation,
  schedule,
  existingAssignment = null,
  members = [],
  scheduleDates = [],
  scheduleDate,
}: {
  rotation: Rotation | null;
  schedule: Schedule | null;
  existingAssignment?: OccurrenceAssignment | null;
  members?: Member[];
  scheduleDates?: ScheduleDate[];
  scheduleDate?: ScheduleDate | null;
}) {
  const em = {
    findOne: vi.fn().mockImplementation((entity: unknown) => {
      if (entity === Rotation) return rotation;
      if (entity === Schedule) return schedule;
      if (entity === OccurrenceAssignment) return existingAssignment;
      if (entity === ScheduleDate) return scheduleDate ?? null;
      return null;
    }),
    find: vi.fn().mockImplementation((entity: unknown) => {
      if (entity === OccurrenceAssignment) return [];
      if (entity === Member) return members;
      if (entity === ScheduleDate) return scheduleDates;
      return [];
    }),
    persist: vi.fn(),
    flush: vi.fn().mockResolvedValue(null),
  };
  return {
    em: { fork: vi.fn().mockReturnValue(em) },
    _em: em,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const FUTURE_DATE = '2099-06-01';

describe('CancelService.cancel()', () => {
  it('throws BadRequestException for an invalid date format', async () => {
    const orm = makeOrmMock({ rotation: null, schedule: null });
    const service = new CancelService(orm as never);

    await expect(service.cancel('aBcDeFgH', 'not-a-date')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(orm._em.findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a malformed slug without DB hit', async () => {
    const orm = makeOrmMock({ rotation: null, schedule: null });
    const service = new CancelService(orm as never);

    await expect(service.cancel('BAD', FUTURE_DATE)).rejects.toBeInstanceOf(NotFoundException);
    expect(orm._em.findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when rotation does not exist', async () => {
    const orm = makeOrmMock({ rotation: null, schedule: null });
    const service = new CancelService(orm as never);

    await expect(service.cancel('aBcDeFgH', FUTURE_DATE)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when rotation has no schedule', async () => {
    const rotation = makeRotation();
    const orm = makeOrmMock({ rotation, schedule: null });
    const service = new CancelService(orm as never);

    await expect(service.cancel('aBcDeFgH', FUTURE_DATE)).rejects.toMatchObject({
      response: { error: 'OCCURRENCE_NOT_IN_SCHEDULE' },
    });
  });

  it('throws BadRequestException when date is not in schedule', async () => {
    const rotation = makeRotation();
    const schedule = makeSchedule();
    // scheduleDate = null → isDateInSchedule returns false
    const orm = makeOrmMock({ rotation, schedule, scheduleDate: null, scheduleDates: [] });
    const service = new CancelService(orm as never);

    await expect(service.cancel('aBcDeFgH', FUTURE_DATE)).rejects.toMatchObject({
      response: { error: 'OCCURRENCE_NOT_IN_SCHEDULE' },
    });
  });

  it('throws ConflictException when occurrence is already date-cancelled', async () => {
    const rotation = makeRotation();
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice');
    const sd = makeScheduleDate(FUTURE_DATE);
    const existing = makeAssignment(FUTURE_DATE, alice, 'date');

    const orm = makeOrmMock({
      rotation,
      schedule,
      existingAssignment: existing,
      scheduleDate: sd,
      scheduleDates: [sd],
      members: [alice],
    });
    const service = new CancelService(orm as never);

    await expect(service.cancel('aBcDeFgH', FUTURE_DATE)).rejects.toBeInstanceOf(ConflictException);
    expect(orm._em.flush).not.toHaveBeenCalled();
  });

  it('creates a new date-cancel assignment for an unassigned future occurrence', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);
    const sd = makeScheduleDate(FUTURE_DATE);

    const orm = makeOrmMock({
      rotation,
      schedule,
      existingAssignment: null,
      scheduleDate: sd,
      scheduleDates: [sd],
      members: [alice, bob],
    });
    const service = new CancelService(orm as never);

    const result = await service.cancel('aBcDeFgH', FUTURE_DATE);

    expect(orm._em.persist).toHaveBeenCalledOnce();
    expect(orm._em.flush).toHaveBeenCalledOnce();
    // nextIndex=0 in a 1-element future list → Alice would have been assigned
    expect(result.cancelledMemberId).toBe('m-alice');
    expect(result.cancelledMemberName).toBe('Alice');
    expect(result.memberId).toBeNull();
    expect(result.memberName).toBeNull();
    expect(result.date).toBe(FUTURE_DATE);
    expect(result.isPast).toBe(false);
  });

  it('marks an existing settled (normal) assignment as date-cancelled', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const sd = makeScheduleDate(FUTURE_DATE);
    const existing = makeAssignment(FUTURE_DATE, alice, null);

    const orm = makeOrmMock({
      rotation,
      schedule,
      existingAssignment: existing,
      scheduleDate: sd,
      scheduleDates: [sd],
      members: [alice],
    });
    const service = new CancelService(orm as never);

    const result = await service.cancel('aBcDeFgH', FUTURE_DATE);

    // Must update existing, not persist a new one
    expect(existing.skipType).toBe('date');
    expect(orm._em.persist).not.toHaveBeenCalled();
    expect(orm._em.flush).toHaveBeenCalledOnce();
    expect(result.cancelledMemberId).toBe('m-alice');
    expect(result.cancelledMemberName).toBe('Alice');
  });

  it('records the correct cancelled member when a prior occurrence is already cancelled', async () => {
    // Scenario: Alice=0, Bob=1, nextIndex=1 (Alice's occurrence was settled in the past).
    // occ2 (2099-06-01) was Bob's turn and is already cancelled.
    // Cancelling occ3 (2099-07-01) should record Bob (not Alice) as the would-have-been member.
    const rotation = makeRotation({ nextIndex: 1 });
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);
    const sd2 = makeScheduleDate('2099-06-01');
    const sd3 = makeScheduleDate('2099-07-01');
    const occ2Cancel = makeAssignment('2099-06-01', bob, 'date');

    const orm = makeOrmMock({
      rotation,
      schedule,
      existingAssignment: null,
      scheduleDate: sd3, // isDateInSchedule check for occ3
      scheduleDates: [sd2, sd3],
      members: [alice, bob],
    });
    // Override find so OccurrenceAssignment queries return the occ2 cancel record
    orm._em.find.mockImplementation((entity: unknown) => {
      if (entity === OccurrenceAssignment) return [occ2Cancel];
      if (entity === Member) return [alice, bob];
      if (entity === ScheduleDate) return [sd2, sd3];
      return [];
    });
    const service = new CancelService(orm as never);

    const result = await service.cancel('aBcDeFgH', '2099-07-01');

    expect(result.cancelledMemberId).toBe('m-bob');
    expect(result.cancelledMemberName).toBe('Bob');
    expect(orm._em.persist).toHaveBeenCalledOnce();
  });

  it('works when only one member is in the queue (member-skip would be blocked)', async () => {
    const rotation = makeRotation({ nextIndex: 0 });
    const schedule = makeSchedule();
    const alice = makeMember('Alice', 'm-alice', 1);
    const sd = makeScheduleDate(FUTURE_DATE);

    const orm = makeOrmMock({
      rotation,
      schedule,
      existingAssignment: null,
      scheduleDate: sd,
      scheduleDates: [sd],
      members: [alice],
    });
    const service = new CancelService(orm as never);

    const result = await service.cancel('aBcDeFgH', FUTURE_DATE);

    expect(result.cancelledMemberId).toBe('m-alice');
    expect(orm._em.persist).toHaveBeenCalledOnce();
  });
});
