import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { MemberDto } from '@whos-next/shared';

@Component({
  selector: 'app-member-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    @if (localMembers().length === 0) {
      <p class="empty-state">{{ 'member.empty_state' | translate }}</p>
    } @else {
      <ul
        class="queue-list"
        cdkDropList
        [cdkDropListData]="localMembers()"
        (cdkDropListDropped)="onDrop($event)"
        aria-label="Member queue"
      >
        @for (member of localMembers(); track member.id) {
          <li class="queue-item" cdkDrag [cdkDragData]="member">
            <mat-icon cdkDragHandle class="drag-handle" aria-hidden="true">drag_indicator</mat-icon>
            <span
              class="queue-item__position"
              [class.queue-item__position--top]="member.position <= 3"
              aria-hidden="true"
              >{{ member.position }}</span
            >
            <span class="queue-item__name">{{ member.name }}</span>
            <button
              mat-icon-button
              type="button"
              [attr.aria-label]="
                translate.instant('member.remove_button_label', { name: member.name })
              "
              (click)="memberRemoved.emit(member.id)"
            >
              <mat-icon>close</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './member-queue.component.scss',
})
export class MemberQueueComponent {
  protected readonly translate = inject(TranslateService);

  readonly members = input.required<MemberDto[]>();
  readonly memberRemoved = output<string>();
  readonly membersReordered = output<string[]>();

  readonly localMembers = signal<MemberDto[]>([]);

  constructor() {
    effect(() => {
      this.localMembers.set(this.members());
    });
  }

  onDrop(event: CdkDragDrop<MemberDto[]>): void {
    const current = [...this.localMembers()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    const updated = current.map((m, i) => ({ ...m, position: i + 1 }));
    this.localMembers.set(updated);
    this.membersReordered.emit(updated.map((m) => m.id));
  }
}
