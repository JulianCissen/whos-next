import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { OccurrenceDto } from '@whos-next/shared';

import { LanguageService } from '../../../core/language.service.js';

@Component({
  selector: 'app-up-next-hero-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslateModule],
  styleUrl: './up-next-hero-card.component.scss',
  template: `
    @if (occurrence()) {
      <div class="hero-card">
        <div class="hero-card__body">
          <p class="hero-card__eyebrow">{{ topLabel() }}</p>
          <p class="hero-card__name">{{ occurrence()!.memberName }}</p>
          <p class="hero-card__subtitle">{{ subtitle() }}</p>
        </div>

        @if (canSkip()) {
          <div class="hero-card__actions">
            <button class="hero-card__skip" type="button" (click)="skip.emit(occurrence()!.date)">
              <mat-icon>skip_next</mat-icon>
              {{ 'occurrence.skip.label' | translate }}
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class UpNextHeroCardComponent {
  readonly occurrence = input<OccurrenceDto | null>(null);
  readonly afterNext = input<OccurrenceDto | null>(null);
  readonly canSkip = input(false);

  readonly skip = output<string>();

  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  protected readonly daysUntil = computed(() => {
    const occ = this.occurrence();
    if (!occ) return 0;
    const [y, m, d] = occ.date.split('-').map(Number);
    const occDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((occDate.getTime() - today.getTime()) / 86_400_000);
  });

  protected readonly topLabel = computed(() => {
    this.lang.current();
    const days = this.daysUntil();
    const prefix = this.translate.instant('occurrence.hero.up_next_label') as string;
    if (days === 0)
      return `${prefix} · ${this.translate.instant('occurrence.hero.up_next_today') as string}`;
    if (days === 1)
      return `${prefix} · ${this.translate.instant('occurrence.hero.in_1_day') as string}`;
    return `${prefix} · ${this.translate.instant('occurrence.hero.in_n_days', { n: days }) as string}`;
  });

  protected readonly subtitle = computed(() => {
    this.lang.current();
    const locale = this.lang.current();
    const occ = this.occurrence();
    if (!occ) return '';
    const [y, m, d] = occ.date.split('-').map(Number);
    const datePart = new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const an = this.afterNext();
    if (!an?.memberName || !an.date) return datePart;
    const [ay, am, ad] = an.date.split('-').map(Number);
    const afterDateStr = new Date(ay, am - 1, ad).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    });
    const thenPart = this.translate.instant('occurrence.hero.then_name_on_date', {
      name: an.memberName,
      date: afterDateStr,
    }) as string;
    return `${datePart} · ${thenPart}`;
  });
}
