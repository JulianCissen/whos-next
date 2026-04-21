import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-share-link-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <aside role="status" aria-live="polite" class="banner">
      <div class="banner__inner page-container">
        <div class="banner__body">
          <p class="banner__message">{{ 'rotation.share_banner' | translate }}</p>
          <div class="banner__link-row">
            <code class="banner__url">{{ url() }}</code>
            <button
              mat-icon-button
              class="banner__copy-btn"
              (click)="copyLink()"
              aria-label="Copy link"
            >
              <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
            </button>
          </div>
        </div>
        <button
          mat-icon-button
          class="banner__dismiss-btn"
          (click)="dismissed.emit()"
          [attr.aria-label]="'rotation.share_banner_dismiss' | translate"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </aside>
  `,
  styles: [
    `
      .banner {
        background-color: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        padding: 12px 0;
      }

      .banner__inner {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding-top: 0;
        padding-bottom: 0;
      }

      .banner__body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .banner__message {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .banner__link-row {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .banner__url {
        font-family: 'Roboto Mono', monospace;
        font-size: 0.8125rem;
        background: transparent;
        border: none;
        padding: 0;
        color: var(--mat-sys-on-primary-container);
        opacity: 0.8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 400px;
      }

      .banner__copy-btn,
      .banner__dismiss-btn {
        --mdc-icon-button-icon-color: var(--mat-sys-on-primary-container);
        flex-shrink: 0;
      }
    `,
  ],
})
export class ShareLinkBannerComponent {
  readonly url = input.required<string>();
  readonly dismissed = output<void>();

  readonly copied = signal(false);

  copyLink(): void {
    void navigator.clipboard.writeText(this.url()).then(() => {
      this.copied.set(true);
      setTimeout(() => {
        this.copied.set(false);
      }, 2000);
    });
  }
}
