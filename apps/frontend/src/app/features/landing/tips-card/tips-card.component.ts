import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tips-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  styleUrl: './tips-card.component.scss',
  template: `
    <div class="tips-card">
      <p class="tips-card__title">{{ 'landing.tips_title' | translate }}</p>
      <ol class="tips-card__list">
        <li class="tips-card__item">
          <span class="tips-card__num">01</span>
          <span class="tips-card__text">{{ 'landing.tips_tip1' | translate }}</span>
        </li>
        <li class="tips-card__item">
          <span class="tips-card__num">02</span>
          <span class="tips-card__text">{{ 'landing.tips_tip2' | translate }}</span>
        </li>
        <li class="tips-card__item">
          <span class="tips-card__num">03</span>
          <span class="tips-card__text">{{ 'landing.tips_tip3' | translate }}</span>
        </li>
      </ol>
    </div>
  `,
})
export class TipsCardComponent {}
