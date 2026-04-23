import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-switch-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ 'schedule.switch_type.confirm_title' | translate }}</h2>
    <mat-dialog-content>
      <p>{{ 'schedule.switch_type.confirm_body' | translate }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'delete_dialog.cancel_button' | translate }}</button>
      <button mat-flat-button (click)="confirm()">
        {{ 'schedule.switch_type.confirm_action' | translate }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmSwitchDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmSwitchDialogComponent>);

  confirm(): void {
    this.dialogRef.close(true);
  }
}
