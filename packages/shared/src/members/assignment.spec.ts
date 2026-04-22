import { describe, expect, it } from 'vitest';

import { assignMembers } from './index.js';
import type { ActiveQueueEntry } from './index.js';

const DATES = [
  new Date('2026-01-01'),
  new Date('2026-01-02'),
  new Date('2026-01-03'),
  new Date('2026-01-04'),
  new Date('2026-01-05'),
];

const alice: ActiveQueueEntry = { memberId: 'a1', memberName: 'Alice' };
const bob: ActiveQueueEntry = { memberId: 'b2', memberName: 'Bob' };
const carol: ActiveQueueEntry = { memberId: 'c3', memberName: 'Carol' };

describe('assignMembers()', () => {
  it('returns all-null entries for an empty queue', () => {
    const result = assignMembers([], 0, DATES.slice(0, 3));
    expect(result).toEqual([
      { date: DATES[0], memberId: null, memberName: null },
      { date: DATES[1], memberId: null, memberName: null },
      { date: DATES[2], memberId: null, memberName: null },
    ]);
  });

  it('returns empty array when no dates provided', () => {
    expect(assignMembers([alice], 0, [])).toEqual([]);
  });

  it('assigns the single member to every date', () => {
    const result = assignMembers([alice], 0, DATES.slice(0, 3));
    for (const entry of result) {
      expect(entry.memberId).toBe('a1');
      expect(entry.memberName).toBe('Alice');
    }
  });

  it('cycles through multi-member queue starting at nextIndex=0', () => {
    const result = assignMembers([alice, bob, carol], 0, DATES.slice(0, 5));
    expect(result.map((e) => e.memberId)).toEqual(['a1', 'b2', 'c3', 'a1', 'b2']);
  });

  it('respects an arbitrary nextIndex offset', () => {
    // nextIndex=1 → Bob is first
    const result = assignMembers([alice, bob, carol], 1, DATES.slice(0, 3));
    expect(result.map((e) => e.memberId)).toEqual(['b2', 'c3', 'a1']);
  });

  it('wraps correctly when dates are exactly divisible by queue length', () => {
    const result = assignMembers([alice, bob], 0, DATES.slice(0, 4));
    expect(result.map((e) => e.memberId)).toEqual(['a1', 'b2', 'a1', 'b2']);
  });

  it('handles nextIndex equal to queue length by wrapping (mod)', () => {
    // nextIndex=3 for a 3-element queue → maps to index 0
    const result = assignMembers([alice, bob, carol], 3, DATES.slice(0, 2));
    expect(result.map((e) => e.memberId)).toEqual(['a1', 'b2']);
  });
});
