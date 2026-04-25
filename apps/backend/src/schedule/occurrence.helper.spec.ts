import { describe, expect, it } from 'vitest';

import { Member } from '../members/member.entity.js';

import { deriveFutureMember } from './occurrence.helper.js';

function makeMember(name: string, id: string): Member {
  const m = new Member();
  m.id = id;
  m.name = name;
  m.position = 1;
  m.removedAt = null;
  m.createdAt = new Date('2026-01-01');
  m.updatedAt = new Date('2026-01-01');
  return m;
}

const alice = makeMember('Alice', 'm-alice');
const bob = makeMember('Bob', 'm-bob');
const carol = makeMember('Carol', 'm-carol');

describe('deriveFutureMember', () => {
  it('returns null when queue is empty', () => {
    const result = deriveFutureMember([], 0, new Set(), ['2099-06-01'], '2099-06-01');
    expect(result).toBeNull();
  });

  it('returns null when targetDate is not in allFutureDates', () => {
    const result = deriveFutureMember([alice], 0, new Set(), ['2099-06-01'], '2099-07-01');
    expect(result).toBeNull();
  });

  it('assigns members round-robin without cancellations', () => {
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01', '2099-09-01'];
    const cancelled = new Set<string>();
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-06-01')).toBe(alice);
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-07-01')).toBe(bob);
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-08-01')).toBe(alice);
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-09-01')).toBe(bob);
  });

  it('cancelled date does not advance the rotation counter', () => {
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'];
    const cancelled = new Set(['2099-06-01']); // first date cancelled (Alice's turn)
    // Alice's slot is cancelled; Bob resumes at 2099-07-01 (still offset 0 from nextIndex=0)
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-06-01')).toBe(alice); // would-have-been
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-07-01')).toBe(alice); // resumes with Alice
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-08-01')).toBe(bob);
  });

  it('resumes with cancelled member on the next occurrence (Alice-Bob scenario)', () => {
    // nextIndex=1 (Bob) after settling Alice's past occurrence; occ2=Bob cancelled
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'];
    const cancelled = new Set(['2099-06-01']); // Bob's turn cancelled
    expect(deriveFutureMember([alice, bob], 1, cancelled, dates, '2099-06-01')).toBe(bob);
    expect(deriveFutureMember([alice, bob], 1, cancelled, dates, '2099-07-01')).toBe(bob); // Bob resumes
    expect(deriveFutureMember([alice, bob], 1, cancelled, dates, '2099-08-01')).toBe(alice);
  });

  it('handles multiple consecutive cancellations', () => {
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01', '2099-09-01'];
    const cancelled = new Set(['2099-06-01', '2099-07-01']); // Alice and Bob both cancelled
    // Alice cancelled, Bob cancelled → Carol resumes at 2099-08-01 (offset 0)
    expect(deriveFutureMember([alice, bob, carol], 0, cancelled, dates, '2099-08-01')).toBe(alice);
    expect(deriveFutureMember([alice, bob, carol], 0, cancelled, dates, '2099-09-01')).toBe(bob);
  });

  it('handles cancellation in the middle of the date list', () => {
    const dates = ['2099-06-01', '2099-07-01', '2099-08-01'];
    const cancelled = new Set(['2099-07-01']); // Bob cancelled in the middle
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-06-01')).toBe(alice);
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-07-01')).toBe(bob); // would-have-been Bob
    expect(deriveFutureMember([alice, bob], 0, cancelled, dates, '2099-08-01')).toBe(bob); // Bob resumes
  });

  it('respects nextIndex offset', () => {
    const dates = ['2099-06-01', '2099-07-01'];
    const cancelled = new Set<string>();
    expect(deriveFutureMember([alice, bob, carol], 2, cancelled, dates, '2099-06-01')).toBe(carol);
    expect(deriveFutureMember([alice, bob, carol], 2, cancelled, dates, '2099-07-01')).toBe(alice);
  });
});
