import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { RecentRotationStore } from '../../core/recent-rotation-store.service.js';
import { PillAppBarComponent } from '../../shared/pill-app-bar/pill-app-bar.component.js';

import { CreateRotationFormComponent } from './create-rotation-form.component.js';
import { PickUpWhereYouLeftOffComponent } from './pick-up-where-you-left-off/pick-up-where-you-left-off.component.js';
import { TipsCardComponent } from './tips-card/tips-card.component.js';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    CreateRotationFormComponent,
    PillAppBarComponent,
    TipsCardComponent,
    PickUpWhereYouLeftOffComponent,
  ],
  styleUrl: './landing.page.scss',
  template: `
    <div class="landing page-container">
      <app-pill-app-bar>
        <div slot="left" class="landing__brand">
          <div class="landing__avatar" aria-hidden="true">W</div>
          <span class="landing__logo">{{ 'app.title' | translate }}</span>
          @if (recentCount() > 0) {
            <span class="landing__brand-sep" aria-hidden="true"></span>
            <span class="landing__count"
              >{{ recentCount() }} {{ 'landing.rotations_label' | translate }}</span
            >
          }
        </div>
      </app-pill-app-bar>

      <div class="landing__grid">
        <app-create-rotation-form class="landing__form" (created)="onCreated($event)" />
        <app-pick-up-where-you-left-off class="landing__pickup" />
        <app-tips-card class="landing__tips" />
      </div>
    </div>
  `,
})
export class LandingPage {
  private readonly router = inject(Router);
  private readonly recentStore = inject(RecentRotationStore);

  protected readonly recentCount = signal(this.recentStore.getAll().length);

  protected onCreated(slug: string): void {
    this.recentCount.set(this.recentStore.getAll().length);
    void this.router.navigateByUrl('/' + slug, { state: { justCreated: true } });
  }
}
