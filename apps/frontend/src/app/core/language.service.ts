import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const STORAGE_KEY = 'whos-next:lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly current = signal<'en' | 'nl'>(this.loadStored());

  constructor() {
    this.translate.use(this.current());
  }

  use(lang: 'en' | 'nl'): void {
    this.translate.use(lang);
    this.current.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  private loadStored(): 'en' | 'nl' {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'nl' ? 'nl' : 'en';
  }
}
