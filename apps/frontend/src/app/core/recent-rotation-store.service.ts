import { Injectable } from '@angular/core';

export interface CadenceDescriptor {
  scheduleType: 'recurrence_rule' | 'custom_date_list';
  ruleType?: 'weekly' | 'every_n_weeks' | 'monthly';
  dayOfWeek?: number;
  intervalN?: number;
}

export interface RecentRotationRecord {
  slug: string;
  name: string;
  cadence: CadenceDescriptor | null;
  nextMember: string;
  nextDate: string;
}

const STORAGE_KEY = 'whos-next:recent-rotations';
const MAX_ENTRIES = 3;

@Injectable({ providedIn: 'root' })
export class RecentRotationStore {
  getAll(): RecentRotationRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return (parsed as RecentRotationRecord[]).map((r) => ({
        ...r,
        // Migrate legacy string cadence to null
        cadence: typeof r.cadence === 'string' ? null : (r.cadence ?? null),
      }));
    } catch {
      return [];
    }
  }

  add(record: RecentRotationRecord): void {
    try {
      const existing = this.getAll().filter((r) => r.slug !== record.slug);
      const updated = [record, ...existing].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }
}
