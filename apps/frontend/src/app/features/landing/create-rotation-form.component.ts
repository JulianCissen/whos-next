import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';
import type { CreateRotationScheduleDto } from '@whos-next/shared';

import { RotationsApiService } from '../../core/api/rotations.api.js';
import { noControlCharsValidator } from '../../shared/validators.js';
import { ScheduleConfigCompactComponent } from '../rotation/schedule-config/schedule-config-compact.component.js';

@Component({
  selector: 'app-create-rotation-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule, ScheduleConfigCompactComponent],
  styleUrl: './create-rotation-form.component.scss',
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="create-form">
      <div class="create-form__corner" aria-hidden="true"></div>

      <div class="create-form__body">
        <div class="create-form__chip">
          <span class="create-form__chip-icon">✦</span>
          {{ 'landing.new_rotation_chip' | translate }}
        </div>
        <h1 class="create-form__headline">{{ 'landing.headline' | translate }}</h1>
        <p class="create-form__subheading">{{ 'landing.subheading' | translate }}</p>

        <div
          class="create-form__name-container"
          [class.create-form__name-container--error]="nameHasError()"
        >
          <svg
            class="create-form__name-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <input
            class="create-form__name-input"
            formControlName="name"
            [placeholder]="'landing.name_placeholder' | translate"
            [attr.aria-label]="'landing.name_label' | translate"
            autocomplete="off"
            type="text"
          />
        </div>
        @if (nameHasError()) {
          <p class="create-form__field-error" role="alert">
            @if (form.controls.name.hasError('maxlength')) {
              {{ 'landing.name_max_length' | translate }}
            } @else {
              {{ 'landing.name_required' | translate }}
            }
          </p>
        }

        <app-schedule-config-compact (scheduleChange)="onScheduleChange($event)" />

        @if (showStartDateCtrl.value) {
          <input type="date" class="create-form__date-input" [formControl]="startDateCtrl" />
        }

        <div class="create-form__footer">
          <label class="create-form__start-check">
            <input type="checkbox" [formControl]="showStartDateCtrl" />
            {{ 'schedule.start_date.toggle_compact' | translate }}
          </label>
          @if (submitError()) {
            <p class="create-form__error" role="alert">{{ 'landing.create_error' | translate }}</p>
          }
          <button class="create-form__submit" type="submit" [disabled]="submitting()">
            {{ 'landing.create_button' | translate }}
            <span class="create-form__submit-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </form>
  `,
})
export class CreateRotationFormComponent {
  readonly created = output<string>();
  readonly currentSchedule = signal<CreateRotationScheduleDto>({ type: 'custom_date_list' });
  readonly submitting = signal(false);
  readonly submitError = signal(false);
  readonly showStartDateCtrl = new FormControl(false, { nonNullable: true });
  readonly startDateCtrl = new FormControl('', { nonNullable: true });

  private readonly api = inject(RotationsApiService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(ROTATION_NAME_MAX_LENGTH),
        noControlCharsValidator,
      ],
    ],
  });

  protected nameHasError(): boolean {
    const ctrl = this.form.controls.name;
    return ctrl.invalid && ctrl.touched;
  }

  protected onScheduleChange(schedule: CreateRotationScheduleDto): void {
    this.currentSchedule.set(schedule);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const name = this.form.controls.name.value?.trim() ?? '';
    if (!name) {
      this.form.controls.name.setErrors({ whitespace: true });
      return;
    }

    const schedule: CreateRotationScheduleDto = { ...this.currentSchedule() };
    if (this.showStartDateCtrl.value && this.startDateCtrl.value) {
      schedule.startDate = this.startDateCtrl.value;
    }

    this.submitting.set(true);
    this.submitError.set(false);
    this.api.create({ name, schedule }).subscribe({
      next: (rotation) => {
        this.submitting.set(false);
        this.created.emit(rotation.slug);
      },
      error: () => {
        this.submitting.set(false);
        this.submitError.set(true);
      },
    });
  }
}
