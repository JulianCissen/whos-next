import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';

import type { OccurrenceDto } from '@whos-next/shared';

import { LanguageService } from '../../../core/language.service.js';

@Component({
  selector: 'app-occurrence-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatMenuModule, TranslateModule],
  template: `
    @if (occurrence) {
      <span class="occ-row__date" [class.occ-row__date--current]="kind === 'current'">{{
        formatDate(occurrence.date, currentLang())
      }}</span>
      <div
        class="occ-row__avatar"
        [class.occ-row__avatar--cancelled]="!!occurrence.cancelledMemberId"
        [style.background]="occurrence.cancelledMemberId ? null : nameToColor(displayName())"
      >
        {{ displayName()[0]?.toUpperCase() }}
      </div>
      <div class="occ-row__info">
        <span
          class="occ-row__name"
          [class.occ-row__name--cancelled]="!!occurrence.cancelledMemberId"
          >{{ displayName() }}</span
        >
        @if (kind === 'current' && !occurrence.cancelledMemberId) {
          <span class="occ-row__sublabel">{{ 'occurrence.label.next_up' | translate }}</span>
        }
        @if (occurrence.cancelledMemberId) {
          <span class="occ-row__sublabel occ-row__sublabel--cancelled">
            {{ 'occurrence.skip.cancelled' | translate }}
          </span>
        }
      </div>
      @if (canSkip) {
        <button class="occ-row__menu-btn" type="button" [matMenuTriggerFor]="rowMenu">
          <mat-icon>more_horiz</mat-icon>
        </button>
        <mat-menu #rowMenu>
          @if (!occurrence.cancelledMemberId) {
            <button mat-menu-item (click)="onCancelDate()">
              {{ 'occurrence.skip.cancelDate' | translate }}
            </button>
          } @else {
            <button mat-menu-item (click)="onUncancelDate()">
              {{ 'occurrence.skip.uncancelDate' | translate }}
            </button>
          }
        </mat-menu>
      }
      @if (cancelError()) {
        <span class="occ-row__error" role="alert">
          {{
            (occurrence.cancelledMemberId
              ? 'occurrence.skip.uncancelFailed'
              : 'occurrence.skip.cancelFailed'
            ) | translate
          }}
        </span>
      }
    }
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

  private readonly lang = inject(LanguageService);

  protected readonly cancelError = signal(false);
  protected readonly currentLang = computed(() => this.lang.current());

  protected readonly displayName = computed(() => {
    const occ = this.occurrence;
    if (!occ) return '';
    return occ.cancelledMemberId ? (occ.cancelledMemberName ?? '') : (occ.memberName ?? '');
  });

  protected onCancelDate(): void {
    this.cancelError.set(false);
    this.cancelDate.emit();
  }

  protected onUncancelDate(): void {
    this.cancelError.set(false);
    this.uncancelDate.emit();
  }

  protected formatDate(iso: string, locale: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  }

  protected nameToColor(name: string): string {
    const hues = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330, 150, 90];
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) & 0xff_ff;
    return `hsl(${hues[hash % hues.length]}, 65%, 42%)`;
  }
}
