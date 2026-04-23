import { describe, expect, it } from 'vitest';

import { computeRecurrenceDates, type RecurrenceRuleDto } from './index.js';

// Helper to build a date from year/month(1-based)/day without time component
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe('computeRecurrenceDates', () => {
  describe('weekly', () => {
    it('returns weekly Monday series from a Monday start', () => {
      const rule: RecurrenceRuleDto = { type: 'weekly', dayOfWeek: 1 };
      const start = d(2026, 4, 20); // 2026-04-20 is a Monday
      const result = computeRecurrenceDates(rule, start, new Date(0), 4);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(d(2026, 4, 20));
      expect(result[1]).toEqual(d(2026, 4, 27));
      expect(result[2]).toEqual(d(2026, 5, 4));
      expect(result[3]).toEqual(d(2026, 5, 11));
    });

    it('advances to the next matching weekday when start does not match', () => {
      const rule: RecurrenceRuleDto = { type: 'weekly', dayOfWeek: 5 }; // Friday
      const start = d(2026, 4, 20); // Monday
      const result = computeRecurrenceDates(rule, start, new Date(0), 2);
      expect(result[0]).toEqual(d(2026, 4, 24)); // Friday
      expect(result[1]).toEqual(d(2026, 5, 1));
    });

    it('respects the from filter', () => {
      const rule: RecurrenceRuleDto = { type: 'weekly', dayOfWeek: 1 };
      const start = d(2026, 4, 6); // a Monday
      const from = d(2026, 4, 20); // skip first two Mondays
      const result = computeRecurrenceDates(rule, start, from, 2);
      expect(result[0]).toEqual(d(2026, 4, 20));
      expect(result[1]).toEqual(d(2026, 4, 27));
    });

    it('respects the limit cap', () => {
      const rule: RecurrenceRuleDto = { type: 'weekly', dayOfWeek: 3 }; // Wednesday
      const result = computeRecurrenceDates(rule, d(2026, 1, 1), new Date(0), 3);
      expect(result).toHaveLength(3);
    });
  });

  describe('every_n_weeks', () => {
    it('returns bi-weekly Friday series', () => {
      const rule: RecurrenceRuleDto = { type: 'every_n_weeks', dayOfWeek: 5, intervalN: 2 };
      const start = d(2026, 4, 24); // a Friday
      const result = computeRecurrenceDates(rule, start, new Date(0), 3);
      expect(result[0]).toEqual(d(2026, 4, 24));
      expect(result[1]).toEqual(d(2026, 5, 8));
      expect(result[2]).toEqual(d(2026, 5, 22));
    });
  });

  describe('monthly', () => {
    it('returns monthly 15th series', () => {
      const rule: RecurrenceRuleDto = { type: 'monthly', monthlyDay: 15 };
      const start = d(2026, 4, 1);
      const result = computeRecurrenceDates(rule, start, new Date(0), 3);
      expect(result[0]).toEqual(d(2026, 4, 15));
      expect(result[1]).toEqual(d(2026, 5, 15));
      expect(result[2]).toEqual(d(2026, 6, 15));
    });

    it('skips February for monthly 31st and continues to next valid month', () => {
      const rule: RecurrenceRuleDto = { type: 'monthly', monthlyDay: 31 };
      const start = d(2026, 1, 31); // Jan 31
      const result = computeRecurrenceDates(rule, start, new Date(0), 3);
      expect(result[0]).toEqual(d(2026, 1, 31)); // Jan
      expect(result[1]).toEqual(d(2026, 3, 31)); // March (Feb skipped)
      expect(result[2]).toEqual(d(2026, 5, 31)); // May (Apr skipped)
    });

    it('handles start date after the monthly day (advances to next month)', () => {
      const rule: RecurrenceRuleDto = { type: 'monthly', monthlyDay: 5 };
      const start = d(2026, 4, 10); // 10th — after the 5th
      const result = computeRecurrenceDates(rule, start, new Date(0), 2);
      expect(result[0]).toEqual(d(2026, 5, 5));
      expect(result[1]).toEqual(d(2026, 6, 5));
    });

    it('includes start date when it matches monthlyDay exactly', () => {
      const rule: RecurrenceRuleDto = { type: 'monthly', monthlyDay: 20 };
      const start = d(2026, 4, 20);
      const result = computeRecurrenceDates(rule, start, new Date(0), 1);
      expect(result[0]).toEqual(d(2026, 4, 20));
    });
  });

  it('returns empty array when limit is 0', () => {
    const rule: RecurrenceRuleDto = { type: 'weekly', dayOfWeek: 1 };
    expect(computeRecurrenceDates(rule, d(2026, 1, 1), new Date(0), 0)).toHaveLength(0);
  });
});
