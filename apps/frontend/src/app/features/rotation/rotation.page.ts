import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import type {
  AddMemberResponseDto,
  MemberDto,
  RotationResponseDto,
  ScheduleDto,
} from '@whos-next/shared';

import { MembersApiService } from '../../core/api/members.api';
import { RotationsApiService } from '../../core/api/rotations.api';

import { AddMemberFormComponent } from './add-member-form/add-member-form.component';
import { MemberQueueComponent } from './member-queue/member-queue.component';
import { OccurrenceViewComponent } from './occurrence-view/occurrence-view.component';
import { RotationSettingsComponent } from './rotation-settings.component';

@Component({
  selector: 'app-rotation-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatExpansionModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
    AddMemberFormComponent,
    MemberQueueComponent,
    OccurrenceViewComponent,
    RotationSettingsComponent,
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
          <div class="rotation-header__title-row">
            <h1 class="rotation-header__title">{{ rotation()!.name }}</h1>
            <button
              mat-icon-button
              class="rotation-header__copy-btn"
              (click)="copyUrl()"
              [attr.aria-label]="'rotation.copy_link_label' | translate"
              [matTooltip]="'rotation.copy_link_tooltip' | translate"
            >
              <mat-icon>{{ urlCopied() ? 'check' : 'content_copy' }}</mat-icon>
            </button>
          </div>
        </header>

        <section class="schedule-section">
          @if (rotation()!.schedule) {
            <app-occurrence-view
              [slug]="rotation()!.slug"
              [scheduleVersion]="scheduleVersion()"
              [activeMemberCount]="members().length"
              [schedule]="rotation()!.schedule"
            />
          } @else {
            <p class="occurrence-empty-state">
              {{ 'occurrence.empty_state.no_schedule' | translate }}
            </p>
          }
        </section>

        <mat-card appearance="outlined" class="section-card section-card--queue">
          <mat-card-header>
            <div class="queue-header">
              <div class="queue-header__text">
                <mat-card-title class="queue-title">{{ 'queue.title' | translate }}</mat-card-title>
                <mat-card-subtitle class="queue-subtitle">
                  {{ 'queue.description' | translate }}
                </mat-card-subtitle>
              </div>
              <span class="queue-count">{{ members().length }}</span>
            </div>
          </mat-card-header>
          <mat-card-content>
            <app-member-queue
              [members]="members()"
              [highlightMemberId]="lastAddedMemberId()"
              (memberRemoved)="onMemberRemoved($event)"
              (membersReordered)="onMembersReordered($event)"
            />
          </mat-card-content>
        </mat-card>

        <mat-expansion-panel
          class="add-member-panel"
          [expanded]="addMemberExpanded()"
          (opened)="addMemberExpanded.set(true)"
          (closed)="addMemberExpanded.set(false)"
        >
          <mat-expansion-panel-header>
            <mat-panel-title>{{ 'member.add_form.title' | translate }}</mat-panel-title>
          </mat-expansion-panel-header>
          <app-add-member-form [slug]="rotation()!.slug" (memberAdded)="onMemberAdded($event)" />
        </mat-expansion-panel>

        <app-rotation-settings
          [slug]="rotation()!.slug"
          [rotationName]="rotation()!.name"
          [schedule]="rotation()!.schedule"
          (rotationRenamed)="onRotationRenamed($event)"
          (rotationDeleted)="onRotationDeleted()"
          (scheduleUpdated)="onScheduleUpdated($event)"
        />
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

  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly rotation = signal<RotationResponseDto | null>(null);
  readonly members = signal<MemberDto[]>([]);
  readonly urlCopied = signal(false);
  readonly scheduleVersion = signal(0);
  readonly lastAddedMemberId = signal<string | null>(null);
  readonly addMemberExpanded = signal(false);

  protected readonly currentUrl = globalThis.location.href;

  copyUrl(): void {
    void navigator.clipboard.writeText(this.currentUrl).then(() => {
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
        this.addMemberExpanded.set((rotation.members ?? []).length < 2);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
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
}
