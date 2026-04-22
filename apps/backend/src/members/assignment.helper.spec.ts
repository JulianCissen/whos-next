import { describe, expect, it } from 'vitest';

import { adjustNextIndex } from './assignment.helper.js';

describe('adjustNextIndex — ADD', () => {
  it('ADD at position 1 (front) when nextIndex=0 → nextIndex increments', () => {
    expect(adjustNextIndex(0, 3, { type: 'ADD', insertedAt: 1 })).toBe(1);
  });

  it('ADD at position < nextIndex shifts pointer right', () => {
    expect(adjustNextIndex(2, 3, { type: 'ADD', insertedAt: 2 })).toBe(3);
  });

  it('ADD at position == nextIndex (zero-based) shifts pointer right', () => {
    // insertedAt=2 (1-based) → zeroBase=1; nextIndex=1 → 1<=1 → increment
    expect(adjustNextIndex(1, 3, { type: 'ADD', insertedAt: 2 })).toBe(2);
  });

  it('ADD at position > nextIndex leaves pointer unchanged', () => {
    expect(adjustNextIndex(1, 3, { type: 'ADD', insertedAt: 4 })).toBe(1);
  });

  it('ADD to empty queue at front leaves pointer at 0', () => {
    expect(adjustNextIndex(0, 0, { type: 'ADD', insertedAt: 1 })).toBe(0);
  });
});

describe('adjustNextIndex — REMOVE', () => {
  it('REMOVE member before nextIndex decrements pointer', () => {
    expect(adjustNextIndex(2, 4, { type: 'REMOVE', removedAt: 1 })).toBe(1);
  });

  it('REMOVE member at nextIndex (mid-queue) wraps within new length', () => {
    // nextIndex=1, remove pos=2 (1-based → zero=1 == nextIndex=1), newLength=2
    expect(adjustNextIndex(1, 3, { type: 'REMOVE', removedAt: 2 })).toBe(1 % 2);
  });

  it('REMOVE member at nextIndex wraps to 0 on single-element queue', () => {
    expect(adjustNextIndex(0, 1, { type: 'REMOVE', removedAt: 1 })).toBe(0);
  });

  it('REMOVE last remaining member resets pointer to 0', () => {
    // nextIndex=0, remove the only member → newLength=0 → 0 % max(0,1) = 0
    expect(adjustNextIndex(0, 1, { type: 'REMOVE', removedAt: 1 })).toBe(0);
  });

  it('REMOVE member after nextIndex leaves pointer unchanged', () => {
    expect(adjustNextIndex(1, 4, { type: 'REMOVE', removedAt: 4 })).toBe(1);
  });

  it('REMOVE first member when nextIndex=0 and multiple members: wraps', () => {
    // nextIndex=0 (zero-based), remove pos=1 (=nextIndex+1 in 1-based)
    // removedAtZeroBase=0 == nextIndex=0 → 0 % max(2,1) = 0
    expect(adjustNextIndex(0, 3, { type: 'REMOVE', removedAt: 1 })).toBe(0);
  });
});

describe('adjustNextIndex — REORDER', () => {
  it('REORDER uses 1-indexed newPositionOfCurrentNext converted to 0-based', () => {
    expect(adjustNextIndex(0, 3, { type: 'REORDER', newPositionOfCurrentNext: 3 })).toBe(2);
  });

  it('REORDER to first position sets nextIndex to 0', () => {
    expect(adjustNextIndex(2, 3, { type: 'REORDER', newPositionOfCurrentNext: 1 })).toBe(0);
  });

  it('REORDER is a no-op when current-next stays at same position', () => {
    expect(adjustNextIndex(1, 3, { type: 'REORDER', newPositionOfCurrentNext: 2 })).toBe(1);
  });
});
