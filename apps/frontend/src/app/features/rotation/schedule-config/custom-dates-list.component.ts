import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { TranslateModule } from '@ngx-translate/core';

import { ScheduleApiService } from '../../../core/api/schedule.api.js';

@Component({
  selector: 'app-custom-dates-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    TranslateModule,
  ],
  template: `
    <div class="custom-dates">
      <div class="custom-dates__add">
        <mat-form-field appearance="outline" class="custom-dates__input">
          <mat-label>{{ 'schedule.custom_date.date_input_label' | translate }}</mat-label>
          <input matInput type="date" [formControl]="dateControl" />
        </mat-form-field>
        <button mat-flat-button (click)="addDate()" [disabled]="adding()">
          {{ 'schedule.custom_date.add_label' | translate }}
        </button>
      </div>

      @if (addError()) {
        <p class="custom-dates__error" role="alert">{{ addError()! | translate }}</p>
      }

      @if (sortedDates().length === 0) {
        <p class="custom-dates__empty">{{ 'schedule.custom_date.empty_state' | translate }}</p>
      } @else {
        <mat-list>
          @for (date of sortedDates(); track date) {
            <mat-list-item>
              <span matListItemTitle>{{ date }}</span>
              <button
                mat-icon-button
                matListItemMeta
                (click)="removeDate(date)"
                [attr.aria-label]="'schedule.custom_date.remove_label' | translate"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </mat-list-item>
          }
        </mat-list>
      }
    </div>
  `,
  styles: [
    `
      .custom-dates__add {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .custom-dates__input {
        flex: 1;
        min-width: 180px;
      }
      .custom-dates__error {
        color: var(--mat-sys-error);
        font-size: 0.875rem;
        margin: 0;
      }
      .custom-dates__empty {
        font-style: italic;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class CustomDatesListComponent {
  readonly slug = input.required<string>();
  readonly dates = input<string[]>([]);
  readonly datesChanged = output<string[]>();

  protected readonly dateControl = new FormControl('');
  protected readonly addError = signal<string | null>(null);
  protected readonly adding = signal(false);

  private readonly api = inject(ScheduleApiService);

  protected sortedDates(): string[] {
    return this.dates().toSorted();
  }

  protected addDate(): void {
    const date = this.dateControl.value?.trim() ?? '';
    if (!date) return;
    this.adding.set(true);
    this.addError.set(null);
    this.api.addDate(this.slug(), { date }).subscribe({
      next: () => {
        this.adding.set(false);
        this.dateControl.setValue('');
        this.datesChanged.emit([...this.dates(), date]);
      },
      error: (err: { status?: number }) => {
        this.adding.set(false);
        if (err.status === 409) {
          this.addError.set('schedule.error.duplicate_date');
        } else if (err.status === 422) {
          this.addError.set('schedule.error.date_cap_exceeded');
        } else {
          this.addError.set('schedule.error.save_failed');
        }
      },
    });
  }

  protected removeDate(date: string): void {
    this.api.removeDate(this.slug(), date).subscribe({
      next: () => {
        this.datesChanged.emit(this.dates().filter((d) => d !== date));
      },
    });
  }
}
