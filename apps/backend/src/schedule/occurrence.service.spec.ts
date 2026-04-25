import { describe, expect, it, vi } from 'vitest';

import { Member } from '../members/member.entity.js';
import { OccurrenceAssignment } from '../members/occurrence-assignment.entity.js';
import { Rotation } from '../rotations/rotation.entity.js';

import { OccurrenceService } from './occurrence.service.js';
import { ScheduleDate } from './schedule-date.entity.js';
import { Schedule } from './schedule.entity.js';

vi.mock('./settle.helper.js', () => ({
  settleRotation: vi.fn().mockResolvedValue(null),
}));

function makeRotation(): Rotation {
  const r = new Rotation();
  r.id = 'rot-1';
  r.slug = 'aBcDeFgH';
  r.name = 'Test';
  r.nextIndex = 0;
  r.lastAccessedAt = new Date('2026-01-01');
  r.createdAt = new Date('2026-01-01');
  r.updatedAt = new Date('2026-01-01');
  return r;
}

function makeSchedule(rotation: Rotation): Schedule {
  const s = new Schedule();
  s.rotation = rotation;
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

function makeMember(name: string, id: string, position: number): Member {
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
  skipType: 'date' | null,
): OccurrenceAssignment {
  const a = new OccurrenceAssignment();
  a.occurrenceDate = date as unknown as string;
  a.member = member;
  a.skipType = skipType;
  a.createdAt = new Date('2026-01-01');
  a.updatedAt = new Date('2026-01-01');
  return a;
}

describe('OccurrenceService.getWindow', () => {
  it('treats a next-occurrence date cancel as transparent for future derivation', async () => {
    const rotation = makeRotation();
    const schedule = makeSchedule(rotation);
    const alice = makeMember('Alice', 'm-alice', 1);
    const bob = makeMember('Bob', 'm-bob', 2);

    // next=2099-06-01 (date cancel: Alice), then future dates are 2099-07-01 and 2099-08-01.
    // Date cancel is transparent, so future should be Alice, then Bob.
    const scheduleDates = ['2099-06-01', '2099-07-01', '2099-08-01'].map(makeScheduleDate);
    const nextCancelledAssignment = makeAssignment('2099-06-01', alice, 'date');

    const em = {
      findOne: vi.fn().mockImplementation((entity: unknown, where: Record<string, unknown>) => {
        if (entity === Rotation) return rotation;
        if (entity === Schedule) return schedule;
        if (entity === OccurrenceAssignment && where['occurrenceDate'] === '2099-06-01') {
          return nextCancelledAssignment;
        }
        return null;
      }),
      find: vi.fn().mockImplementation((entity: unknown, where?: Record<string, unknown>) => {
        if (entity === ScheduleDate) return scheduleDates;
        if (entity === Member) return [alice, bob];
        if (entity === OccurrenceAssignment) {
          if (where?.['occurrenceDate'] && typeof where['occurrenceDate'] === 'object') {
            const dateSelector = where['occurrenceDate'] as { $lt?: string; $in?: string[] };
            if (dateSelector['$lt'] !== undefined) return [];
            if (Array.isArray(dateSelector['$in'])) return [];
          }
          return [];
        }
        return [];
      }),
    };

    const orm = { em: { fork: vi.fn().mockReturnValue(em) } };
    const service = new OccurrenceService(orm as never);

    const window = await service.getWindow('aBcDeFgH');

    expect(window.next?.date).toBe('2099-06-01');
    expect(window.next?.memberId).toBeNull();
    expect(window.next?.cancelledMemberId).toBe('m-alice');
    expect(window.future.map((o) => o.memberId)).toEqual(['m-alice', 'm-bob']);
  });
});
