import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { OccurrenceDto, OccurrenceWindowDto, ScheduleDto } from '@whos-next/shared';

import { OccurrencesApiService } from '../../../core/api/schedule.api.js';

import { OccurrenceCardComponent } from './occurrence-card.component.js';

interface OccurrenceNode {
  occurrence: OccurrenceDto | null;
  kind: 'past' | 'current' | 'future';
  trackKey: string;
}

@Component({
  selector: 'app-occurrence-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OccurrenceCardComponent, MatProgressSpinnerModule, MatSnackBarModule, TranslateModule],
  styleUrl: './occurrence-view.component.scss',
  template: `
    @if (loading()) {
      <div class="timeline-loading">
        <mat-spinner diameter="40" />
      </div>
    } @else if (error()) {
      <p class="timeline-error">{{ 'occurrence.error.load_failed' | translate }}</p>
    } @else {
      @if (window()?.next?.memberName && schedule()) {
        <div class="hero">
          <div class="hero__avatar">{{ window()!.next!.memberName!.charAt(0).toUpperCase() }}</div>
          <div class="hero__info">
            <span class="hero__label">{{ 'occurrence.hero_label' | translate }}</span>
            <span class="hero__name">{{ window()!.next!.memberName }}</span>
            <span class="hero__context">{{ heroContext() }}</span>
          </div>
        </div>
      }
      <div class="timeline">
        <div class="timeline__track"></div>
        @for (node of allOccurrences(); track node.trackKey) {
          <div class="timeline__node" [class.timeline__node--current]="node.kind === 'current'">
            <app-occurrence-card
              [occurrence]="node.occurrence"
              [kind]="node.kind"
              [canSkip]="canSkip() && node.kind !== 'past'"
              [showCancelError]="!!node.occurrence && cancelErrorDate() === node.occurrence.date"
              (cancelDate)="onCancelDate(node.occurrence?.date ?? '')"
              (uncancelDate)="onUncancelDate(node.occurrence?.date ?? '')"
            />
            <div
              class="timeline__dot"
              [class.timeline__dot--current]="node.kind === 'current'"
            ></div>
          </div>
        }
      </div>
    }
  `,
})
export class OccurrenceViewComponent {
  readonly slug = input.required<string>();
  readonly scheduleVersion = input(0);
  readonly activeMemberCount = input(0);
  readonly schedule = input<ScheduleDto | null>(null);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly window = signal<OccurrenceWindowDto | null>(null);
  protected readonly canSkip = computed(() => this.activeMemberCount() >= 1);
  protected readonly cancelErrorDate = signal<string | null>(null);

  protected readonly allOccurrences = computed<OccurrenceNode[]>(() => {
    const w = this.window();
    if (!w) return [];
    return [
      ...w.past.map((occ) => ({ occurrence: occ, kind: 'past' as const, trackKey: occ.date })),
      { occurrence: w.next, kind: 'current' as const, trackKey: w.next?.date ?? 'no-next' },
      ...w.future.map((occ) => ({
        occurrence: occ,
        kind: 'future' as const,
        trackKey: `f-${occ.date}`,
      })),
    ];
  });

  protected readonly heroContext = computed(() => {
    const next = this.window()?.next;
    const s = this.schedule();
    if (!next || !s) return '';
    const date = this.formatHeroDate(next.date);
    const desc = this.describeSchedule(s);
    return desc ? `${date} · ${desc}` : date;
  });

  private readonly api = inject(OccurrencesApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  constructor() {
    effect(() => {
      const slug = this.slug();
      this.scheduleVersion();
      untracked(() => this.loadWindow(slug));
    });
  }

  protected onCancelDate(date: string): void {
    if (!date) return;
    this.cancelErrorDate.set(null);
    this.api.cancelOccurrence(this.slug(), date).subscribe({
      next: () => this.loadWindow(),
      error: () => {
        this.cancelErrorDate.set(date);
      },
    });
  }

  protected onUncancelDate(date: string): void {
    if (!date) return;
    this.cancelErrorDate.set(null);
    this.api.uncancelOccurrence(this.slug(), date).subscribe({
      next: () => this.loadWindow(),
      error: () => {
        this.cancelErrorDate.set(date);
      },
    });
  }

  private loadWindow(slug: string = this.slug()): void {
    this.loading.set(true);
    this.api.getWindow(slug).subscribe({
      next: (data) => {
        this.window.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private formatHeroDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  private describeSchedule(s: ScheduleDto): string {
    if (s.type === 'custom_date_list') {
      return this.translate.instant('schedule.type.custom_date_list') as string;
    }
    const rule = s.recurrenceRule;
    if (rule) {
      const day =
        rule.dayOfWeek === undefined
          ? ''
          : (this.translate.instant(`schedule.rrule.day_of_week.${rule.dayOfWeek}`) as string);
      if (rule.type === 'weekly') return `Weekly · ${day}`;
      if (rule.type === 'every_n_weeks') return `Every ${rule.intervalN ?? 2} weeks · ${day}`;
      if (rule.type === 'monthly') return `Monthly · day ${rule.monthlyDay ?? '?'}`;
    }
    return '';
  }
}
