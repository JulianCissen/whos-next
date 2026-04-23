import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import type { OccurrenceDto, OccurrenceWindowDto } from '@whos-next/shared';

import { OccurrencesApiService } from '../../../core/api/schedule.api.js';

import { OccurrenceCardComponent } from './occurrence-card.component.js';

@Component({
  selector: 'app-occurrence-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OccurrenceCardComponent, MatButtonModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    @if (loading()) {
      <div class="occurrence-view__loading">
        <mat-spinner diameter="40" />
      </div>
    } @else if (error()) {
      <p class="occurrence-view__error">{{ 'occurrence.error.load_failed' | translate }}</p>
    } @else if (browsedOccurrence()) {
      <div class="occurrence-view__browse">
        <div class="occurrence-view__nav">
          <button
            mat-stroked-button
            [disabled]="!browseHasMoreBackward() || browsing()"
            (click)="browsePrevious()"
          >
            {{ 'occurrence.navigate.backward' | translate }}
          </button>
          <button mat-stroked-button [disabled]="browsing()" (click)="resetToWindow()">
            {{ 'occurrence.navigate.back_to_today' | translate }}
          </button>
          <button
            mat-stroked-button
            [disabled]="!browseHasMoreForward() || browsing()"
            (click)="browseNext()"
          >
            {{ 'occurrence.navigate.forward' | translate }}
          </button>
        </div>
        <app-occurrence-card
          [occurrence]="browsedOccurrence()"
          [label]="''"
          [isPreviousLabel]="false"
        />
      </div>
    } @else {
      <div class="occurrence-view__cards">
        <app-occurrence-card
          [occurrence]="window()?.previous ?? null"
          [label]="'occurrence.previous' | translate"
          [isPreviousLabel]="true"
        />
        <app-occurrence-card
          [occurrence]="window()?.next ?? null"
          [label]="'occurrence.next' | translate"
          [isPreviousLabel]="false"
        />
      </div>
      @if (window()) {
        <div class="occurrence-view__nav occurrence-view__nav--window">
          <button
            mat-stroked-button
            [disabled]="!window()?.previous || browsing()"
            (click)="browsePrevious()"
          >
            {{ 'occurrence.navigate.backward' | translate }}
          </button>
          <button
            mat-stroked-button
            [disabled]="!window()?.next || browsing()"
            (click)="browseNext()"
          >
            {{ 'occurrence.navigate.forward' | translate }}
          </button>
        </div>
      }
    }
  `,
  styles: [
    `
      .occurrence-view__loading {
        display: flex;
        justify-content: center;
        padding: 32px;
      }
      .occurrence-view__error {
        color: var(--mat-sys-error);
        text-align: center;
      }
      .occurrence-view__cards {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
      .occurrence-view__nav {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
        &--window {
          margin-top: 16px;
        }
      }
    `,
  ],
})
export class OccurrenceViewComponent {
  readonly slug = input.required<string>();
  readonly scheduleVersion = input(0);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly window = signal<OccurrenceWindowDto | null>(null);
  protected readonly browsedOccurrence = signal<OccurrenceDto | null>(null);
  protected readonly browseHasMoreForward = signal(false);
  protected readonly browseHasMoreBackward = signal(false);
  protected readonly browsing = signal(false);

  private readonly api = inject(OccurrencesApiService);

  constructor() {
    effect(() => {
      const slug = this.slug();
      this.scheduleVersion();
      untracked(() => this.loadWindow(slug));
    });
  }

  protected browseNext(): void {
    const anchor = this.browsedOccurrence()?.date ?? this.window()?.next?.date;
    if (!anchor) return;
    this.browsing.set(true);
    this.api.browse(this.slug(), { after: anchor, limit: 1 }).subscribe({
      next: (result) => {
        const occ = result.occurrences[0];
        if (occ) {
          this.browsedOccurrence.set(occ);
          this.browseHasMoreForward.set(result.hasMore);
          this.browseHasMoreBackward.set(true);
        }
        this.browsing.set(false);
      },
      error: () => {
        this.browsing.set(false);
      },
    });
  }

  protected browsePrevious(): void {
    const anchor = this.browsedOccurrence()?.date ?? this.window()?.previous?.date;
    if (!anchor) return;
    this.browsing.set(true);
    this.api.browse(this.slug(), { before: anchor, limit: 1 }).subscribe({
      next: (result) => {
        const occ = result.occurrences[0];
        if (occ) {
          this.browsedOccurrence.set(occ);
          this.browseHasMoreBackward.set(result.hasMore);
          this.browseHasMoreForward.set(true);
        }
        this.browsing.set(false);
      },
      error: () => {
        this.browsing.set(false);
      },
    });
  }

  protected resetToWindow(): void {
    this.browsedOccurrence.set(null);
    this.loadWindow();
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
}
