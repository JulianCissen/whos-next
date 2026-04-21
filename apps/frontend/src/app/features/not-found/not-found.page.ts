import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, MatButtonModule, RouterLink],
  template: `
    <div class="page-container not-found">
      <h1 class="not-found__title">{{ 'rotation.not_found_heading' | translate }}</h1>
      <p class="not-found__message">{{ 'rotation.not_found_message' | translate }}</p>
      <a mat-flat-button routerLink="/">Back to home</a>
    </div>
  `,
  styles: [
    `
      .not-found {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }

      .not-found__title {
        margin: 0;
        font-size: 2rem;
        line-height: 2.5rem;
        font-weight: 400;
        color: var(--mat-sys-on-surface);
      }

      .not-found__message {
        margin: 0;
        font-size: 1rem;
        color: var(--mat-sys-on-surface-variant);
      }

      a {
        margin-top: 12px;
      }
    `,
  ],
})
export class NotFoundPage {}
