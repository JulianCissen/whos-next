import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../../core/language.service.js';
import type {
  CadenceDescriptor,
  RecentRotationRecord,
} from '../../../core/recent-rotation-store.service.js';
import { RecentRotationStore } from '../../../core/recent-rotation-store.service.js';

@Component({
  selector: 'app-pick-up-where-you-left-off',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, RouterLink],
  styleUrl: './pick-up-where-you-left-off.component.scss',
  template: `
    @if (recents().length > 0) {
      <section class="pick-up">
        <p class="pick-up__title">{{ 'landing.pick_up_title' | translate }}</p>
        <ul class="pick-up__list">
          @for (item of recents(); track item.slug) {
            <li>
              <a class="pick-up__row" [routerLink]="['/', item.slug]">
                <span class="pick-up__row-body">
                  <span class="pick-up__name">{{ item.name }}</span>
                  @if (item.cadence) {
                    <span class="pick-up__cadence">{{ formatCadence(item.cadence) }}</span>
                  }
                </span>
                <span class="pick-up__arrow" aria-hidden="true">›</span>
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class PickUpWhereYouLeftOffComponent {
  private readonly store = inject(RecentRotationStore);
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  protected recents(): RecentRotationRecord[] {
    return this.store.getAll();
  }

  protected formatCadence(desc: CadenceDescriptor | null): string {
    this.lang.current(); // reactive dependency — re-renders on language change
    if (!desc) return '';
    if (desc.scheduleType === 'custom_date_list') {
      return this.translate.instant('schedule.type.custom_date_list') as string;
    }
    const { ruleType, dayOfWeek, intervalN } = desc;
    let label = '';
    switch (ruleType) {
      case 'weekly': {
        label = this.translate.instant('schedule.rrule.weekly') as string;
        break;
      }
      case 'every_n_weeks': {
        label = this.translate.instant('landing.cadence_chip.every_n_weeks', {
          n: intervalN ?? 2,
        }) as string;
        break;
      }
      case 'monthly': {
        label = this.translate.instant('schedule.rrule.monthly') as string;
        // No default
        break;
      }
    }
    if (dayOfWeek) {
      const day = this.translate.instant(`landing.cadence_chip.day_short.${dayOfWeek}`) as string;
      label += ` · ${day}`;
    }
    return label;
  }
}
