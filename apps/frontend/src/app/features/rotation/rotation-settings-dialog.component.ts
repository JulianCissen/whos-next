import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import type { RotationResponseDto, ScheduleDto } from '@whos-next/shared';

import { RotationSettingsComponent } from './rotation-settings.component.js';

export interface SettingsDialogData {
  slug: string;
  rotationName: string;
  schedule: ScheduleDto | null;
}

@Component({
  selector: 'app-rotation-settings-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslateModule,
    RotationSettingsComponent,
  ],
  styles: [
    `
      .dialog-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 8px 0 24px;
      }
      .dialog-title {
        font-family: 'Inter Tight', sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: var(--mat-sys-on-surface);
      }
    `,
  ],
  template: `
    <div class="dialog-head" mat-dialog-title>
      <span class="dialog-title">{{ 'rotation.settings_title' | translate }}</span>
      <button
        mat-icon-button
        mat-dialog-close
        [attr.aria-label]="'occurrence.skip.dismissAriaLabel' | translate"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <app-rotation-settings
        [slug]="data.slug"
        [rotationName]="data.rotationName"
        [schedule]="data.schedule"
        (rotationRenamed)="rotationRenamed.emit($event)"
        (scheduleUpdated)="scheduleUpdated.emit($event)"
        (rotationDeleted)="rotationDeleted.emit()"
      />
    </mat-dialog-content>
  `,
})
export class RotationSettingsDialogComponent {
  readonly rotationRenamed = output<RotationResponseDto>();
  readonly scheduleUpdated = output<ScheduleDto>();
  readonly rotationDeleted = output<void>();

  protected readonly data = inject<SettingsDialogData>(MAT_DIALOG_DATA);
}
