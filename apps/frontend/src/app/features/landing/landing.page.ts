import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CreateRotationFormComponent } from './create-rotation-form.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, CreateRotationFormComponent],
  template: `
    <div class="page-container">
      <div class="hero">
        <div class="hero__text">
          <h1 class="hero__headline">{{ 'landing.headline' | translate }}</h1>
          <p class="hero__tagline">{{ 'app.tagline' | translate }}</p>
        </div>
        <app-create-rotation-form class="hero__form" (created)="onCreated($event)" />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        flex: 1;
        min-height: calc(100dvh - 64px);
        background: radial-gradient(
          ellipse 70% 60% at 5% 90%,
          color-mix(in srgb, var(--mat-sys-primary) 10%, transparent) 0%,
          transparent 70%
        );
      }

      .page-container {
        padding-top: 0;
        padding-bottom: 0;
      }

      .hero {
        display: flex;
        flex-direction: column;
        gap: 48px;
        max-width: 480px;
      }

      .hero__text {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* M3 display-small: 36sp / 44 lh / –0.0156em */
      .hero__headline {
        margin: 0;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 2.25rem;
        line-height: 2.75rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--mat-sys-on-surface);
      }

      .hero__tagline {
        margin: 0;
        font-size: 1rem;
        line-height: 1.5rem;
        color: var(--mat-sys-on-surface-variant);
      }

      .hero__form {
        display: block;
      }
    `,
  ],
})
export class LandingPage {
  private readonly router = inject(Router);

  onCreated(slug: string): void {
    void this.router.navigateByUrl('/' + slug, { state: { justCreated: true } });
  }
}
