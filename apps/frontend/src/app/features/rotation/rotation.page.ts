import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';
import type { RotationResponseDto } from '@whos-next/shared';

import { RotationsApiService } from '../../core/api/rotations.api';

import { DeleteRotationDialogComponent } from './delete-rotation-dialog.component';
import { ShareLinkBannerComponent } from './share-link-banner.component';

@Component({
  selector: 'app-rotation-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
    ShareLinkBannerComponent,
  ],
  template: `
    @if (loading()) {
      <div class="page-container state-message" aria-live="polite">Loading…</div>
    } @else if (loadError()) {
      <div class="page-container state-message" role="alert">
        {{ 'rotation.load_error' | translate }}
      </div>
    } @else if (rotation()) {
      @if (showShareBanner()) {
        <app-share-link-banner [url]="shareUrl()" (dismissed)="showShareBanner.set(false)" />
      }

      <div class="page-container">
        <header class="rotation-header">
          <p class="rotation-header__label">Rotation</p>
          <h1 class="rotation-header__title">{{ rotation()!.name }}</h1>
        </header>

        <mat-card appearance="outlined" class="section-card">
          <mat-card-header>
            <mat-card-title>{{ 'rotation.rename_button' | translate }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
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
          </mat-card-content>
        </mat-card>

        <div class="danger-section">
          <button mat-stroked-button class="delete-btn" (click)="openDeleteDialog()">
            {{ 'rotation.delete_button' | translate }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .state-message {
        color: var(--mat-sys-on-surface-variant);
        font-size: 1rem;
      }

      .rotation-header {
        margin-bottom: 32px;
      }

      .rotation-header__label {
        margin: 0 0 4px;
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--mat-sys-primary);
      }

      /* M3 headline-large: 32sp / 40 lh */
      .rotation-header__title {
        margin: 0;
        font-size: 2rem;
        line-height: 2.5rem;
        font-weight: 400;
        color: var(--mat-sys-on-surface);
      }

      .section-card {
        margin-bottom: 32px;
      }

      .rename-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 8px;
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

      .danger-section {
        display: flex;
        justify-content: flex-start;
      }

      .delete-btn {
        --mat-button-outlined-label-text-color: var(--mat-sys-error);
        --mat-button-outlined-outline-color: var(--mat-sys-error);
      }
    `,
  ],
})
export class RotationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RotationsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly rotation = signal<RotationResponseDto | null>(null);
  readonly showShareBanner = signal(false);
  readonly renaming = signal(false);
  readonly renameError = signal(false);

  readonly renameForm = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(ROTATION_NAME_MAX_LENGTH),
        noControlCharsValidator,
      ],
    ],
  });

  get shareUrl(): () => string {
    return () => globalThis.location.href;
  }

  ngOnInit(): void {
    const navState = history.state as { justCreated?: boolean } | null;
    if (navState?.justCreated === true) {
      this.showShareBanner.set(true);
      history.replaceState({}, '');
    }

    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.get(slug).subscribe({
      next: (rotation) => {
        this.rotation.set(rotation);
        this.renameForm.controls.name.setValue(rotation.name);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  onRename(): void {
    if (this.renameForm.invalid || this.renaming()) return;
    const name = this.renameForm.controls.name.value?.trim() ?? '';
    if (!name) {
      this.renameForm.controls.name.setErrors({ whitespace: true });
      return;
    }
    const slug = this.rotation()?.slug ?? '';
    this.renaming.set(true);
    this.renameError.set(false);
    this.api.rename(slug, { name }).subscribe({
      next: (updated) => {
        this.rotation.set(updated);
        this.renaming.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.renaming.set(false);
        this.renameError.set(true);
        this.cdr.markForCheck();
      },
    });
  }

  openDeleteDialog(): void {
    const rotationName = this.rotation()?.name ?? '';
    const ref = this.dialog.open(DeleteRotationDialogComponent, {
      data: { rotationName },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const slug = this.rotation()?.slug ?? '';
      this.api.delete(slug).subscribe({
        next: () => {
          this.snackBar.open(
            this.translate.instant('delete_dialog.deleted_snackbar') as string,
            undefined,
            { duration: 5000, politeness: 'polite' },
          );
          void this.router.navigateByUrl('/');
        },
      });
    });
  }
}

function noControlCharsValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';

  return /[\u0000-\u001F\u007F]/.test(value) ? { controlChars: true } : null;
}
