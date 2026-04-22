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
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ROTATION_NAME_MAX_LENGTH } from '@whos-next/shared';
import type { MemberDto, RotationResponseDto } from '@whos-next/shared';

import { MembersApiService } from '../../core/api/members.api';
import { RotationsApiService } from '../../core/api/rotations.api';

import { AddMemberFormComponent } from './add-member-form/add-member-form.component';
import { DeleteRotationDialogComponent } from './delete-rotation-dialog.component';
import { MemberQueueComponent } from './member-queue/member-queue.component';

@Component({
  selector: 'app-rotation-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
    AddMemberFormComponent,
    MemberQueueComponent,
  ],
  template: `
    @if (loading()) {
      <div class="page-container state-message" aria-live="polite">Loading…</div>
    } @else if (loadError()) {
      <div class="page-container state-message" role="alert">
        {{ 'rotation.load_error' | translate }}
      </div>
    } @else if (rotation()) {
      <div class="page-container">
        <header class="rotation-header">
          <p class="rotation-header__label">Rotation</p>
          <h1 class="rotation-header__title">{{ rotation()!.name }}</h1>
          <div class="share-url-bar">
            <code class="share-url-bar__url">{{ currentUrl() }}</code>
            <button
              mat-icon-button
              class="share-url-bar__copy-btn"
              (click)="copyUrl()"
              [attr.aria-label]="'rotation.copy_link_label' | translate"
            >
              <mat-icon>{{ urlCopied() ? 'check' : 'content_copy' }}</mat-icon>
            </button>
          </div>
        </header>

        <mat-card appearance="outlined" class="section-card">
          <mat-card-header>
            <mat-card-title>{{ 'member.add_form.title' | translate }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-add-member-form [slug]="rotation()!.slug" (memberAdded)="onMemberAdded($event)" />
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="section-card">
          <mat-card-content>
            <app-member-queue
              [members]="members()"
              (memberRemoved)="onMemberRemoved($event)"
              (membersReordered)="onMembersReordered($event)"
            />
          </mat-card-content>
        </mat-card>

        <mat-expansion-panel class="settings-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>{{ 'rotation.settings_title' | translate }}</mat-panel-title>
          </mat-expansion-panel-header>

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

          <mat-divider class="settings-divider"></mat-divider>

          <div class="settings-section settings-section--danger">
            <button mat-stroked-button class="delete-btn" (click)="openDeleteDialog()">
              {{ 'rotation.delete_button' | translate }}
            </button>
          </div>
        </mat-expansion-panel>
      </div>
    }
  `,
  styleUrl: './rotation.page.scss',
})
export class RotationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RotationsApiService);
  private readonly membersApi = inject(MembersApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly rotation = signal<RotationResponseDto | null>(null);
  readonly members = signal<MemberDto[]>([]);
  readonly renaming = signal(false);
  readonly renameError = signal(false);
  readonly urlCopied = signal(false);

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

  currentUrl(): string {
    return globalThis.location.href;
  }

  copyUrl(): void {
    void navigator.clipboard.writeText(this.currentUrl()).then(() => {
      this.urlCopied.set(true);
      setTimeout(() => {
        this.urlCopied.set(false);
      }, 2000);
    });
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.get(slug).subscribe({
      next: (rotation) => {
        this.rotation.set(rotation);
        this.members.set(rotation.members ?? []);
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

  onMemberAdded(_member: MemberDto): void {
    const slug = this.rotation()?.slug ?? '';
    this.api.get(slug).subscribe({
      next: (rotation) => {
        this.rotation.set(rotation);
        this.members.set(rotation.members ?? []);
        this.cdr.markForCheck();
      },
    });
  }

  onMemberRemoved(memberId: string): void {
    const slug = this.rotation()?.slug ?? '';
    this.membersApi.removeMember(slug, memberId).subscribe({
      next: () => {
        this.api.get(slug).subscribe({
          next: (rotation) => {
            this.rotation.set(rotation);
            this.members.set(rotation.members ?? []);
            this.cdr.markForCheck();
          },
        });
      },
    });
  }

  onMembersReordered(memberIds: string[]): void {
    const slug = this.rotation()?.slug ?? '';
    this.membersApi.reorderMembers(slug, { memberIds }).subscribe({
      next: (result) => {
        this.members.set(result.members);
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

  return /[ -]/.test(value) ? { controlChars: true } : null;
}
