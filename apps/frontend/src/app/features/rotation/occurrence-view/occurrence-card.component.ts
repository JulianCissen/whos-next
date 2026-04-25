import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

import type { OccurrenceDto } from '@whos-next/shared';

@Component({
  selector: 'app-occurrence-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, TranslateModule],
  template: `
    <div
      class="occ-card"
      [class.occ-card--past]="kind === 'past'"
      [class.occ-card--current]="kind === 'current'"
      [class.occ-card--future]="kind === 'future'"
    >
      @if (kind !== 'future') {
        <div class="occ-card__top">
          <span
            class="occ-card__chip"
            [class.occ-card__chip--past]="kind === 'past'"
            [class.occ-card__chip--current]="kind === 'current'"
          >
            {{
              (kind === 'past' ? 'occurrence.label.past' : 'occurrence.label.next_up') | translate
            }}
          </span>
          @if (occurrence && kind === 'current' && canSkip && !occurrence.cancelledMemberId) {
            <button
              mat-button
              type="button"
              class="occ-card__skip-trigger"
              (click)="onCancelDate()"
            >
              {{ 'occurrence.skip.cancelDate' | translate }}
            </button>
          } @else if (occurrence && kind === 'current' && canSkip && occurrence.cancelledMemberId) {
            <button
              mat-button
              type="button"
              class="occ-card__restore-trigger"
              (click)="onUncancelDate()"
            >
              {{ 'occurrence.skip.uncancelDate' | translate }}
            </button>
          }
        </div>
      } @else if (occurrence && canSkip && !occurrence.cancelledMemberId) {
        <div class="occ-card__top occ-card__top--skip-only">
          <button
            mat-button
            type="button"
            class="occ-card__skip-trigger occ-card__skip-trigger--future"
            (click)="onCancelDate()"
          >
            {{ 'occurrence.skip.cancelDate' | translate }}
          </button>
        </div>
      } @else if (occurrence && canSkip && occurrence.cancelledMemberId) {
        <div class="occ-card__top occ-card__top--skip-only">
          <button
            mat-button
            type="button"
            class="occ-card__restore-trigger"
            (click)="onUncancelDate()"
          >
            {{ 'occurrence.skip.uncancelDate' | translate }}
          </button>
        </div>
      }

      @if (occurrence) {
        @if (occurrence.cancelledMemberId) {
          <span class="occ-card__date">{{ formatDate(occurrence.date) }}</span>
          <span class="occ-card__cancelled-label">
            {{ 'occurrence.skip.cancelled' | translate }}
          </span>
          <span class="occ-card__cancelled-member">
            {{
              'occurrence.skip.cancelledWouldHaveBeen'
                | translate: { name: occurrence.cancelledMemberName }
            }}
          </span>
        } @else if (occurrence.memberName) {
          @if (kind === 'past') {
            <div class="occ-card__inline-row">
              <span class="occ-card__date">{{ formatDate(occurrence.date) }}</span>
              <span class="occ-card__separator">·</span>
              <span class="occ-card__member">{{ occurrence.memberName }}</span>
            </div>
          } @else {
            <span class="occ-card__date">{{ formatDate(occurrence.date) }}</span>
            <div class="occ-card__member-row">
              <div class="occ-card__avatar">{{ occurrence.memberName[0]?.toUpperCase() }}</div>
              <span class="occ-card__member">{{ occurrence.memberName }}</span>
            </div>
          }
        } @else {
          @if (kind === 'past') {
            <div class="occ-card__inline-row">
              <span class="occ-card__date">{{ formatDate(occurrence.date) }}</span>
              <span class="occ-card__separator">·</span>
              <span class="occ-card__member occ-card__member--empty">
                {{ 'occurrence.empty_state.no_member' | translate }}
              </span>
            </div>
          } @else {
            <span class="occ-card__date">{{ formatDate(occurrence.date) }}</span>
            <span class="occ-card__member occ-card__member--empty">
              {{ 'occurrence.empty_state.no_member' | translate }}
            </span>
          }
        }

        @if (cancelError()) {
          <span class="occ-card__error" role="alert">
            {{
              (occurrence.cancelledMemberId
                ? 'occurrence.skip.uncancelFailed'
                : 'occurrence.skip.cancelFailed'
              ) | translate
            }}
          </span>
        }
      } @else {
        <span class="occ-card__empty">
          @if (kind === 'past') {
            {{ 'occurrence.empty_state.no_history' | translate }}
          } @else {
            {{ 'occurrence.empty_state.no_upcoming' | translate }}
          }
        </span>
      }
    </div>
  `,
  styleUrl: './occurrence-card.component.scss',
})
export class OccurrenceCardComponent {
  @Input() occurrence: OccurrenceDto | null = null;
  @Input() kind: 'past' | 'current' | 'future' = 'future';
  @Input() canSkip = false;
  @Input() set showCancelError(v: boolean) {
    this.cancelError.set(v);
  }
  @Output() readonly cancelDate = new EventEmitter<void>();
  @Output() readonly uncancelDate = new EventEmitter<void>();

  protected readonly cancelError = signal(false);

  protected onCancelDate(): void {
    this.cancelError.set(false);
    this.cancelDate.emit();
  }

  protected onUncancelDate(): void {
    this.cancelError.set(false);
    this.uncancelDate.emit();
  }

  protected formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}
