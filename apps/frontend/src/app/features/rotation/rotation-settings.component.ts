import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';
import type { RotationResponseDto, ScheduleDto } from '@whos-next/shared';

import { RotationsApiService } from '../../core/api/rotations.api';
import { noControlCharsValidator } from '../../shared/validators';

import { DeleteRotationDialogComponent } from './delete-rotation-dialog.component';
import { ScheduleConfigComponent } from './schedule-config/schedule-config.component';

@Component({
  selector: 'app-rotation-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    TranslateModule,
    ScheduleConfigComponent,
  ],
  template: `
    <div class="settings-section">
      <app-schedule-config
        [slug]="slug()"
        [schedule]="schedule()"
        (scheduleUpdated)="scheduleUpdated.emit($event)"
      />
    </div>

    <mat-divider class="settings-divider" />

    <div class="settings-section">
      <h3 class="settings-section__title">{{ 'rotation.rename_label' | translate }}</h3>
      <form [formGroup]="renameForm" (ngSubmit)="onRename()" class="rename-form">
        <div class="ctrl-wrap">
          <span class="ctrl-label">{{ 'rotation.rename_label' | translate }}</span>
          <input class="ctrl-input" type="text" formControlName="name" />
          @if (renameForm.controls.name.hasError('required')) {
            <span class="ctrl-error">{{ 'landing.name_required' | translate }}</span>
          } @else if (renameForm.controls.name.hasError('maxlength')) {
            <span class="ctrl-error">{{ 'landing.name_max_length' | translate }}</span>
          }
        </div>
        @if (renameError()) {
          <p class="rename-form__error" role="alert">{{ 'rotation.rename_error' | translate }}</p>
        }
        <button mat-stroked-button type="submit" [disabled]="renaming()">
          {{ 'rotation.rename_button' | translate }}
        </button>
      </form>
    </div>

    <mat-divider class="settings-divider" />

    <div class="settings-section settings-section--danger">
      <div class="danger-zone">
        <p class="danger-zone__description">{{ 'rotation.delete_warning' | translate }}</p>
        <button mat-stroked-button class="delete-btn" (click)="openDeleteDialog()">
          <mat-icon>delete_forever</mat-icon>
          {{ 'rotation.delete_button' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .settings-section {
        padding: 20px 0;
        &__title {
          margin: 0 0 14px;
          font-family: 'Inter Tight', sans-serif;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--mat-sys-on-surface);
        }
      }
      .settings-divider {
        margin: 0;
      }
      .rename-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .ctrl-wrap {
        position: relative;
      }
      .ctrl-label {
        position: absolute;
        top: 9px;
        left: 18px;
        font-family: 'Inter Tight', sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--mat-sys-on-surface-variant);
        pointer-events: none;
        z-index: 1;
      }
      .ctrl-input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        background: var(--mat-sys-surface-container-low);
        border: 1.5px solid var(--mat-sys-outline-variant);
        border-radius: 16px;
        padding: 26px 18px 11px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
        appearance: none;
        transition: border-color 160ms ease;
        &:focus {
          outline: none;
          border-color: var(--mat-sys-primary);
        }
      }
      .ctrl-error {
        display: block;
        margin-top: 6px;
        padding-left: 18px;
        font-size: 12px;
        color: var(--mat-sys-error);
      }
      .rename-form__error {
        margin: 0;
        font-size: 0.875rem;
        color: var(--mat-sys-error);
      }
      .rename-form button[type='submit'] {
        align-self: flex-start;
      }
      .danger-zone {
        background: color-mix(in srgb, var(--mat-sys-error-container) 40%, transparent);
        border-radius: 8px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }
      .danger-zone__description {
        margin: 0;
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
      }
      .delete-btn {
        --mat-button-outlined-label-text-color: var(--mat-sys-error);
        --mat-button-outlined-outline-color: var(--mat-sys-error);
      }
    `,
  ],
})
export class RotationSettingsComponent implements OnInit {
  readonly slug = input.required<string>();
  readonly rotationName = input.required<string>();
  readonly schedule = input<ScheduleDto | null>(null);

  readonly rotationRenamed = output<RotationResponseDto>();
  readonly rotationDeleted = output<void>();
  readonly scheduleUpdated = output<ScheduleDto>();

  protected readonly renaming = signal(false);
  protected readonly renameError = signal(false);

  private readonly api = inject(RotationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  protected readonly renameForm = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(ROTATION_NAME_MAX_LENGTH),
        noControlCharsValidator,
      ],
    ],
  });

  constructor() {}

  ngOnInit(): void {
    this.renameForm.controls.name.setValue(this.rotationName());
  }

  protected onRename(): void {
    if (this.renameForm.invalid || this.renaming()) return;
    const name = this.renameForm.controls.name.value.trim();
    if (!name) {
      this.renameForm.controls.name.setErrors({ whitespace: true });
      return;
    }
    this.renaming.set(true);
    this.renameError.set(false);
    this.api.rename(this.slug(), { name }).subscribe({
      next: (updated) => {
        this.renaming.set(false);
        this.rotationRenamed.emit(updated);
      },
      error: () => {
        this.renaming.set(false);
        this.renameError.set(true);
      },
    });
  }

  protected openDeleteDialog(): void {
    const rotationName = this.rotationName();
    const ref = this.dialog.open(DeleteRotationDialogComponent, { data: { rotationName } });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.api.delete(this.slug()).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('delete_dialog.deleted_snackbar') as string,
            undefined,
            { duration: 5000, politeness: 'polite' },
          );
          this.rotationDeleted.emit();
        },
      });
    });
  }
}
