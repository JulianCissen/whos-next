import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';

import type { OccurrenceDto } from '@whos-next/shared';

@Component({
  selector: 'app-occurrence-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, TranslateModule],
  template: `
    <mat-card
      appearance="outlined"
      class="occurrence-card"
      [class.occurrence-card--next]="!isPreviousLabel"
    >
      <mat-card-header>
        <mat-card-subtitle>{{ label }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (occurrence) {
          <p class="occurrence-card__date">{{ occurrence.date }}</p>
          @if (occurrence.memberName) {
            <p class="occurrence-card__member">{{ occurrence.memberName }}</p>
            <p class="occurrence-card__assigned-label">
              {{ 'occurrence.assigned_to' | translate }}
            </p>
          } @else {
            <p class="occurrence-card__member occurrence-card__member--empty">
              {{ 'occurrence.empty_state.no_member' | translate }}
            </p>
          }
        } @else {
          <p class="occurrence-card__empty">
            @if (isPreviousLabel) {
              {{ 'occurrence.empty_state.no_history' | translate }}
            } @else {
              {{ 'occurrence.empty_state.no_upcoming' | translate }}
            }
          </p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .occurrence-card {
        min-width: 200px;
        flex: 1;
        transition: background-color 200ms ease;

        &--next {
          background-color: var(--mat-sys-primary-container);
          border-color: var(--mat-sys-primary-container);
        }
      }
      .occurrence-card--next .occurrence-card__date {
        color: var(--mat-sys-on-primary-container);
      }
      .occurrence-card--next .occurrence-card__member {
        color: var(--mat-sys-on-primary-container);
      }
      .occurrence-card__date {
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        margin: 0 0 4px;
        color: var(--mat-sys-on-surface-variant);
      }
      .occurrence-card__member {
        margin: 0;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 1.25rem;
        font-weight: 600;
        line-height: 1.4;
        color: var(--mat-sys-on-surface);
      }
      .occurrence-card__assigned-label {
        margin: 2px 0 0;
        font-size: 0.75rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .occurrence-card__empty {
        color: var(--mat-sys-on-surface-variant);
        font-style: italic;
        margin: 0;
      }
    `,
  ],
})
export class OccurrenceCardComponent {
  @Input() occurrence: OccurrenceDto | null = null;
  @Input() label = '';
  @Input() isPreviousLabel = false;
}
