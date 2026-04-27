import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

import type { AddMemberResponseDto } from '@whos-next/shared';

import { AddMemberFormComponent } from './add-member-form.component.js';

@Component({
  selector: 'app-add-member-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslateModule,
    AddMemberFormComponent,
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
      <span class="dialog-title">{{ 'member.add_form.title' | translate }}</span>
      <button
        mat-icon-button
        mat-dialog-close
        [attr.aria-label]="'occurrence.skip.dismissAriaLabel' | translate"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <app-add-member-form
        [slug]="data.slug"
        (memberAdded)="onMemberAdded($event)"
        (closeRequested)="onCloseRequested()"
      />
    </mat-dialog-content>
  `,
})
export class AddMemberDialogComponent {
  readonly memberAdded = output<AddMemberResponseDto>();

  protected readonly data = inject<{ slug: string }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AddMemberDialogComponent>);

  protected onMemberAdded(member: AddMemberResponseDto): void {
    this.memberAdded.emit(member);
  }

  protected onCloseRequested(): void {
    this.dialogRef.close();
  }
}
