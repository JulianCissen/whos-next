import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

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
  imports: [OccurrenceCardComponent, MatProgressSpinnerModule, TranslateModule],
  styleUrl: './occurrence-view.component.scss',
  template: `
    @if (loading()) {
      <div class="timeline-loading">
        <mat-spinner diameter="32" />
      </div>
    } @else if (error()) {
      <p class="timeline-error">{{ 'occurrence.error.load_failed' | translate }}</p>
    } @else {
      <div class="timeline">
        @for (node of visibleOccurrences(); track node.trackKey) {
          <div class="timeline__row" [class.timeline__row--current]="node.kind === 'current'">
            <div class="timeline__rail">
              <div
                class="timeline__dot"
                [class.timeline__dot--current]="node.kind === 'current'"
              ></div>
            </div>
            <app-occurrence-card
              class="timeline__content"
              [occurrence]="node.occurrence"
              [kind]="node.kind"
              [canSkip]="canSkip() && node.kind !== 'past'"
              [showCancelError]="!!node.occurrence && cancelErrorDate() === node.occurrence.date"
              (cancelDate)="onCancelDate(node.occurrence?.date ?? '')"
              (uncancelDate)="onUncancelDate(node.occurrence?.date ?? '')"
            />
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

  readonly windowLoaded = output<OccurrenceWindowDto>();

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly window = signal<OccurrenceWindowDto | null>(null);
  protected readonly canSkip = computed(() => this.activeMemberCount() >= 1);
  protected readonly cancelErrorDate = signal<string | null>(null);

  protected readonly visibleOccurrences = computed<OccurrenceNode[]>(() => {
    const w = this.window();
    if (!w) return [];
    const nodes: OccurrenceNode[] = [];
    if (w.next) {
      nodes.push({ occurrence: w.next, kind: 'current', trackKey: w.next.date });
    }
    for (const occ of w.future) {
      nodes.push({ occurrence: occ, kind: 'future', trackKey: `f-${occ.date}` });
    }
    return nodes;
  });

  private readonly api = inject(OccurrencesApiService);

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
      error: () => this.cancelErrorDate.set(date),
    });
  }

  protected onUncancelDate(date: string): void {
    if (!date) return;
    this.cancelErrorDate.set(null);
    this.api.uncancelOccurrence(this.slug(), date).subscribe({
      next: () => this.loadWindow(),
      error: () => this.cancelErrorDate.set(date),
    });
  }

  private loadWindow(slug: string = this.slug()): void {
    this.loading.set(true);
    this.api.getWindow(slug, { past: 1, future: 8 }).subscribe({
      next: (data) => {
        this.window.set(data);
        this.loading.set(false);
        this.windowLoaded.emit(data);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
