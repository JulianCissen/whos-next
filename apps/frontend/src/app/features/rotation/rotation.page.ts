import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type {
  AddMemberResponseDto,
  MemberDto,
  OccurrenceDto,
  OccurrenceWindowDto,
  RotationResponseDto,
  ScheduleDto,
} from '@whos-next/shared';

import { MembersApiService } from '../../core/api/members.api.js';
import { RotationsApiService } from '../../core/api/rotations.api.js';
import { OccurrencesApiService } from '../../core/api/schedule.api.js';
import { LanguageService } from '../../core/language.service.js';
import type { CadenceDescriptor } from '../../core/recent-rotation-store.service.js';
import { RecentRotationStore } from '../../core/recent-rotation-store.service.js';
import { PillAppBarComponent } from '../../shared/pill-app-bar/pill-app-bar.component.js';

import { AddMemberDialogComponent } from './add-member-form/add-member-dialog.component.js';
import { DashboardSkeletonComponent } from './dashboard-skeleton/dashboard-skeleton.component.js';
import { MemberQueueComponent } from './member-queue/member-queue.component.js';
import { OccurrenceViewComponent } from './occurrence-view/occurrence-view.component.js';
import type { SettingsDialogData } from './rotation-settings-dialog.component.js';
import { RotationSettingsDialogComponent } from './rotation-settings-dialog.component.js';
import { UpNextHeroCardComponent } from './up-next-hero-card/up-next-hero-card.component.js';

@Component({
  selector: 'app-rotation-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    MatMenuModule,
    RouterLink,
    TranslateModule,
    PillAppBarComponent,
    DashboardSkeletonComponent,
    UpNextHeroCardComponent,
    MemberQueueComponent,
    OccurrenceViewComponent,
  ],
  templateUrl: './rotation.page.html',
  styleUrl: './rotation.page.scss',
})
export class RotationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(RotationsApiService);
  private readonly membersApi = inject(MembersApiService);
  private readonly occurrencesApi = inject(OccurrencesApiService);
  private readonly recentStore = inject(RecentRotationStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly rotation = signal<RotationResponseDto | null>(null);
  readonly members = signal<MemberDto[]>([]);
  readonly scheduleVersion = signal(0);
  readonly lastAddedMemberId = signal<string | null>(null);
  readonly nextOccurrence = signal<OccurrenceDto | null>(null);
  readonly afterNextOccurrence = signal<OccurrenceDto | null>(null);
  readonly memberNextDates = signal<ReadonlyMap<string, string>>(new Map());
  readonly futureCount = signal(0);

  readonly cadenceChip = computed(() => {
    this.lang.current(); // reactive dependency — re-runs on language change
    return this.formatCadenceLabel(this.toCadenceDescriptor(this.rotation()?.schedule));
  });
  copyUrl(): void {
    void navigator.clipboard.writeText(globalThis.location.href).then(() => {
      this.snackBar.open(this.translate.instant('rotation.link_copied') as string, undefined, {
        duration: 2000,
      });
    });
  }

  openAddMember(): void {
    const r = this.rotation();
    if (!r) return;
    const ref = this.dialog.open(AddMemberDialogComponent, {
      data: { slug: r.slug },
      width: '400px',
      maxWidth: '95vw',
    });
    ref.componentInstance.memberAdded.subscribe((member: AddMemberResponseDto) => {
      this.onMemberAdded(member);
    });
  }

  openSettings(): void {
    const r = this.rotation();
    if (!r) return;
    const data: SettingsDialogData = {
      slug: r.slug,
      rotationName: r.name,
      schedule: r.schedule ?? null,
    };
    const ref = this.dialog.open(RotationSettingsDialogComponent, {
      data,
      width: '560px',
      maxWidth: '95vw',
    });
    ref.componentInstance.rotationRenamed.subscribe((u: RotationResponseDto) =>
      this.onRotationRenamed(u),
    );
    ref.componentInstance.scheduleUpdated.subscribe((s: ScheduleDto) => this.onScheduleUpdated(s));
    ref.componentInstance.rotationDeleted.subscribe(() => {
      ref.close();
      this.onRotationDeleted();
    });
  }

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.get(slug).subscribe({
      next: (rotation) => {
        this.rotation.set(rotation);
        this.members.set(rotation.members ?? []);
        this.loading.set(false);
        this.recentStore.add({
          slug: rotation.slug,
          name: rotation.name,
          cadence: this.toCadenceDescriptor(rotation.schedule),
          nextMember: '',
          nextDate: '',
        });
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected onWindowLoaded(w: OccurrenceWindowDto): void {
    this.nextOccurrence.set(w.next);
    this.afterNextOccurrence.set(w.future[0] ?? null);
    const dates = new Map<string, string>();
    for (const occ of [w.next, ...w.future]) {
      if (occ?.memberId && !occ.cancelledMemberId && !dates.has(occ.memberId)) {
        dates.set(occ.memberId, occ.date);
      }
    }
    this.memberNextDates.set(dates);
    this.futureCount.set((w.next ? 1 : 0) + w.future.length);
    const r = this.rotation();
    if (r && w.next) {
      this.recentStore.add({
        slug: r.slug,
        name: r.name,
        cadence: this.toCadenceDescriptor(r.schedule),
        nextMember: w.next.memberName ?? '',
        nextDate: w.next.date,
      });
    }
  }

  protected onSkipNext(date: string): void {
    const slug = this.rotation()?.slug;
    if (!slug || !date) return;
    this.occurrencesApi.cancelOccurrence(slug, date).subscribe({
      next: () => this.scheduleVersion.update((v) => v + 1),
    });
  }

  onMemberAdded(added: AddMemberResponseDto): void {
    const slug = this.rotation()?.slug ?? '';
    this.api.get(slug).subscribe({
      next: (rotation) => {
        this.rotation.set(rotation);
        this.members.set(rotation.members ?? []);
        this.scheduleVersion.update((v) => v + 1);
        this.lastAddedMemberId.set(added.id);
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
            this.scheduleVersion.update((v) => v + 1);
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
        this.scheduleVersion.update((v) => v + 1);
      },
    });
  }

  onRotationRenamed(updated: RotationResponseDto): void {
    const current = this.rotation();
    this.rotation.set({ ...updated, schedule: updated.schedule ?? current?.schedule ?? null });
  }

  onRotationDeleted(): void {
    void this.router.navigateByUrl('/');
  }

  onScheduleUpdated(schedule: ScheduleDto): void {
    const current = this.rotation();
    if (current) this.rotation.set({ ...current, schedule });
    this.scheduleVersion.update((v) => v + 1);
  }

  private toCadenceDescriptor(schedule: ScheduleDto | null | undefined): CadenceDescriptor | null {
    if (!schedule) return null;
    if (schedule.type === 'custom_date_list') return { scheduleType: 'custom_date_list' };
    const rule = schedule.recurrenceRule;
    if (!rule) return null;
    return {
      scheduleType: 'recurrence_rule',
      ruleType: rule.type,
      dayOfWeek: rule.dayOfWeek,
      intervalN: rule.intervalN,
    };
  }

  private formatCadenceLabel(desc: CadenceDescriptor | null): string {
    if (!desc) return '';
    if (desc.scheduleType === 'custom_date_list') {
      return this.translate.instant('schedule.type.custom_date_list') as string;
    }
    const { ruleType, dayOfWeek, intervalN } = desc;
    let label = '';
    switch (ruleType) {
      case 'weekly': {
        label = this.translate.instant('schedule.rrule.weekly') as string;
        break;
      }
      case 'every_n_weeks': {
        label = this.translate.instant('landing.cadence_chip.every_n_weeks', {
          n: intervalN ?? 2,
        }) as string;
        break;
      }
      case 'monthly': {
        label = this.translate.instant('schedule.rrule.monthly') as string;
        // No default
        break;
      }
    }
    if (dayOfWeek) {
      const day = this.translate.instant(`landing.cadence_chip.day_short.${dayOfWeek}`) as string;
      label += ` · ${day}`;
    }
    return label;
  }
}
