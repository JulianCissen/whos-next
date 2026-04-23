import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import type { MemberDto, RotationResponseDto, ScheduleDto } from '@whos-next/shared';

import { MembersApiService } from '../../core/api/members.api';
import { RotationsApiService } from '../../core/api/rotations.api';

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
    MatIconModule,
    TranslateModule,
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
          <h1 class="rotation-header__title">{{ rotation()!.name }}</h1>
          <div class="share-url-bar">
            <div class="share-url-bar__pill">
              <mat-icon aria-hidden="true">link</mat-icon>
              <code class="share-url-bar__url">{{ currentUrl }}</code>
            </div>
            <button
              mat-stroked-button
              (click)="copyUrl()"
              [attr.aria-label]="'rotation.copy_link_label' | translate"
            >
              <mat-icon>{{ urlCopied() ? 'check' : 'content_copy' }}</mat-icon>
              {{
                urlCopied()
                  ? ('rotation.link_copied' | translate)
                  : ('rotation.copy_link' | translate)
              }}
            </button>
          </div>
        </header>

        <mat-card appearance="outlined" class="section-card section-card--hero">
          <mat-card-header>
            <mat-card-title>{{ 'occurrence.section_title' | translate }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (rotation()!.schedule) {
              <app-occurrence-view
                [slug]="rotation()!.slug"
                [scheduleVersion]="scheduleVersion()"
              />
            } @else {
              <p class="occurrence-empty-state">
                {{ 'occurrence.empty_state.no_schedule' | translate }}
              </p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="section-card section-card--queue">
          <mat-card-content>
            <app-member-queue
              [members]="members()"
              (memberRemoved)="onMemberRemoved($event)"
              (membersReordered)="onMembersReordered($event)"
            />
          </mat-card-content>
        </mat-card>

        <app-rotation-settings
          [slug]="rotation()!.slug"
          [rotationName]="rotation()!.name"
          [schedule]="rotation()!.schedule"
          (rotationRenamed)="onRotationRenamed($event)"
          (rotationDeleted)="onRotationDeleted()"
          (scheduleUpdated)="onScheduleUpdated($event)"
          (memberAdded)="onMemberAdded()"
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
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  onMemberAdded(): void {
    const slug = this.rotation()?.slug ?? '';
    this.api.get(slug).subscribe({
      next: (rotation) => {
        this.rotation.set(rotation);
        this.members.set(rotation.members ?? []);
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
