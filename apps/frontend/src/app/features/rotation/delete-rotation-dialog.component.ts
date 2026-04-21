import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

export interface DeleteRotationDialogData {
  rotationName: string;
}

@Component({
  selector: 'app-delete-rotation-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'delete_dialog.title' | translate }}</h2>
    <mat-dialog-content>
      <p id="delete-warning" aria-live="assertive">
        {{ 'delete_dialog.warning' | translate }}
      </p>
      <p>{{ 'delete_dialog.confirm_prompt' | translate }}</p>
      <mat-form-field appearance="outline" style="width: 100%">
        <mat-label>{{ 'delete_dialog.confirm_placeholder' | translate }}</mat-label>
        <input
          matInput
          [formControl]="confirmControl"
          [attr.aria-describedby]="'delete-warning'"
          (input)="onInput()"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false" cdkFocusInitial>
        {{ 'delete_dialog.cancel_button' | translate }}
      </button>
      <button mat-flat-button class="delete-confirm-btn" [disabled]="!canDelete()" (click)="confirm()">
        {{ 'delete_dialog.delete_button' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .delete-confirm-btn {
        --mat-button-filled-container-color: var(--mat-sys-error);
        --mat-button-filled-label-text-color: var(--mat-sys-on-error);
      }
    `,
  ],
})
export class DeleteRotationDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeleteRotationDialogComponent>);
  readonly data = inject<DeleteRotationDialogData>(MAT_DIALOG_DATA);

  readonly confirmControl = new FormControl('', Validators.required);
  readonly canDelete = signal(false);

  onInput(): void {
    this.canDelete.set(this.confirmControl.value?.trim() === this.data.rotationName);
  }

  confirm(): void {
    if (!this.canDelete()) return;
    this.dialogRef.close(true);
  }
}
