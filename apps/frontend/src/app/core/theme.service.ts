import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'whos-next:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly current = signal<ThemeMode>(this.loadStored());

  constructor() {
    this.apply(this.current());
  }

  cycle(): void {
    const next: ThemeMode = this.current() === 'light' ? 'dark' : 'light';
    this.current.set(next);
    localStorage.setItem(STORAGE_KEY, next);
    this.apply(next);
  }

  private apply(mode: ThemeMode): void {
    const el = document.documentElement;
    el.classList.remove('theme-light', 'theme-dark');
    if (mode === 'dark') el.classList.add('theme-dark');
    else el.classList.add('theme-light');
  }

  private loadStored(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // 'system' or missing → default to light
    return 'light';
  }
}
