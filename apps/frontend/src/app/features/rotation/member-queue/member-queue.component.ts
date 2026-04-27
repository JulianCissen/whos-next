import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { MemberDto } from '@whos-next/shared';

import { LanguageService } from '../../../core/language.service.js';

function nameToColor(name: string): string {
  let hash = 0;
  // eslint-disable-next-line unicorn/prefer-code-point
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = (hash % 12) * 30;
  return `hsl(${hue}, 65%, 42%)`;
}

function formatDate(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

@Component({
  selector: 'app-member-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, MatIconModule, TranslateModule],
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
          <li
            class="queue-item"
            cdkDrag
            [cdkDragData]="member"
            [class.queue-item--highlight]="member.id === highlightMemberId"
          >
            <mat-icon cdkDragHandle class="drag-handle" aria-hidden="true">drag_indicator</mat-icon>
            <div class="queue-item__avatar" [style.background]="avatarColor(member.name)">
              {{ member.name.charAt(0).toUpperCase() }}
            </div>
            <div class="queue-item__info">
              <span class="queue-item__name">{{ member.name }}</span>
              @if (memberNextDates().get(member.id); as date) {
                <span class="queue-item__date">{{ formatDate(date, currentLang()) }}</span>
              }
            </div>
            <button
              class="queue-item__remove"
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
  private readonly lang = inject(LanguageService);
  protected readonly formatDate = formatDate;
  protected readonly currentLang = computed(() => this.lang.current());

  readonly members = input.required<MemberDto[]>();
  readonly memberNextDates = input<ReadonlyMap<string, string>>(new Map());
  readonly memberRemoved = output<string>();
  readonly membersReordered = output<string[]>();

  @Input() highlightMemberId: string | null = null;

  readonly localMembers = signal<MemberDto[]>([]);

  constructor() {
    effect(() => {
      this.localMembers.set(this.members());
    });
  }

  protected avatarColor(name: string): string {
    return nameToColor(name);
  }

  onDrop(event: CdkDragDrop<MemberDto[]>): void {
    const current = [...this.localMembers()];
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    const updated = current.map((m, i) => ({ ...m, position: i + 1 }));
    this.localMembers.set(updated);
    this.membersReordered.emit(updated.map((m) => m.id));
  }
}
