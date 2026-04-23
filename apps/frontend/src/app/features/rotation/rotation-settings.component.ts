import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';
import type { RotationResponseDto, ScheduleDto } from '@whos-next/shared';

import { RotationsApiService } from '../../core/api/rotations.api';
import { noControlCharsValidator } from '../../shared/validators';

import { AddMemberFormComponent } from './add-member-form/add-member-form.component';
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
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
    AddMemberFormComponent,
    ScheduleConfigComponent,
  ],
  template: `
    <mat-expansion-panel class="settings-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>{{ 'rotation.settings_title' | translate }}</mat-panel-title>
      </mat-expansion-panel-header>

      <div class="settings-section">
        <h3 class="settings-section__title">{{ 'member.add_form.title' | translate }}</h3>
        <app-add-member-form [slug]="slug()" (memberAdded)="memberAdded.emit()" />
      </div>

      <mat-divider class="settings-divider" />

      <div class="settings-section">
        <app-schedule-config
          [slug]="slug()"
          [schedule]="schedule()"
          (scheduleUpdated)="scheduleUpdated.emit($event)"
        />
      </div>

      <mat-divider class="settings-divider" />

      <div class="settings-section">
        <form [formGroup]="renameForm" (ngSubmit)="onRename()" class="rename-form">
          <mat-form-field appearance="outline" class="rename-form__field">
            <mat-label>{{ 'rotation.rename_label' | translate }}</mat-label>
            <input matInput formControlName="name" />
            @if (renameForm.controls.name.hasError('required')) {
              <mat-error>{{ 'landing.name_required' | translate }}</mat-error>
            } @else if (renameForm.controls.name.hasError('maxlength')) {
              <mat-error>{{ 'landing.name_max_length' | translate }}</mat-error>
            }
          </mat-form-field>
          @if (renameError()) {
            <p class="rename-form__error" role="alert">
              {{ 'rotation.rename_error' | translate }}
            </p>
          }
          <button mat-flat-button type="submit" [disabled]="renaming()">
            {{ 'rotation.rename_button' | translate }}
          </button>
        </form>
      </div>

      <mat-divider class="settings-divider" />

      <div class="settings-section settings-section--danger">
        <div class="danger-zone">
          <p class="danger-zone__label">
            <mat-icon aria-hidden="true">warning_amber</mat-icon>
            {{ 'rotation.delete_button' | translate }}
          </p>
          <button mat-stroked-button class="delete-btn" (click)="openDeleteDialog()">
            {{ 'rotation.delete_button' | translate }}
          </button>
        </div>
      </div>
    </mat-expansion-panel>
  `,
  styles: [
    `
      .settings-panel {
        background: transparent;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 12px !important;
        box-shadow: none !important;
      }
      .settings-section {
        padding: 16px 0;
        &__title {
          margin: 0 0 12px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--mat-sys-on-surface-variant);
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
      .rename-form__field {
        width: 100%;
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
        border-left: 2px solid var(--mat-sys-error-container);
        padding-left: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }
      .danger-zone__label {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
        display: flex;
        align-items: center;
        gap: 6px;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: var(--mat-sys-error);
        }
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
  readonly memberAdded = output<void>();

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
    const ref = this.dialog.open(DeleteRotationDialogComponent, {
      data: { rotationName },
    });
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
