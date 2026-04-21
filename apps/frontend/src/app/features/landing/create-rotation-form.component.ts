import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';

import { RotationsApiService } from '../../core/api/rotations.api';

function noControlCharsValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';

  return /[\u0000-\u001F\u007F]/.test(value) ? { controlChars: true } : null;
}

@Component({
  selector: 'app-create-rotation-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
      <mat-form-field appearance="outline" class="form__field">
        <mat-label>{{ 'landing.name_label' | translate }}</mat-label>
        <input
          matInput
          formControlName="name"
          [placeholder]="'landing.name_placeholder' | translate"
          [attr.aria-label]="'landing.name_label' | translate"
        />
        @if (form.controls.name.hasError('required') || form.controls.name.hasError('whitespace')) {
          <mat-error>{{ 'landing.name_required' | translate }}</mat-error>
        } @else if (form.controls.name.hasError('maxlength')) {
          <mat-error>{{ 'landing.name_max_length' | translate }}</mat-error>
        }
      </mat-form-field>

      @if (submitError()) {
        <p class="form__error" role="alert">{{ 'landing.create_error' | translate }}</p>
      }

      <button mat-flat-button type="submit" [disabled]="submitting()">
        {{ 'landing.create_button' | translate }}
      </button>
    </form>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form__field {
        width: 100%;
      }

      .form__error {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.25rem;
        color: var(--mat-sys-error);
      }

      button[type='submit'] {
        align-self: flex-start;
      }
    `,
  ],
})
export class CreateRotationFormComponent {
  readonly created = output<string>();

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

  readonly submitting = signal(false);
  readonly submitError = signal(false);

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;

    const name = this.form.controls.name.value?.trim() ?? '';
    if (!name) {
      this.form.controls.name.setErrors({ whitespace: true });
      return;
    }

    this.submitting.set(true);
    this.submitError.set(false);
    this.api.create({ name }).subscribe({
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
