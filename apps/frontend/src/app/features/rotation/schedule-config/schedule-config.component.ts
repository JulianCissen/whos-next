import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { merge } from 'rxjs';

import type {
  CreateRotationScheduleDto,
  IsoWeekday,
  RecurrenceRuleDto,
  RecurrenceRuleType,
  ScheduleDto,
  ScheduleType,
} from '@whos-next/shared';

import { ScheduleApiService } from '../../../core/api/schedule.api.js';

import { ConfirmSwitchDialogComponent } from './confirm-switch-dialog.component.js';
import { CustomDatesListComponent } from './custom-dates-list.component.js';

@Component({
  selector: 'app-schedule-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    TranslateModule,
    CustomDatesListComponent,
  ],
  template: `
    <div class="schedule-config">
      <h3 class="schedule-config__title">{{ 'schedule.section_title' | translate }}</h3>
      @if (!slug()) {
        <mat-radio-group [formControl]="typeControl" class="schedule-config__type-group">
          <mat-radio-button value="recurrence_rule">
            {{ 'schedule.type.recurrence_rule' | translate }}
          </mat-radio-button>
          <mat-radio-button value="custom_date_list">
            {{ 'schedule.type.custom_date_list' | translate }}
          </mat-radio-button>
        </mat-radio-group>
      }
      @if (selectedType() === 'recurrence_rule') {
        <mat-form-field appearance="outline" class="schedule-config__field">
          <mat-label>{{ 'schedule.rrule.rule_type_label' | translate }}</mat-label>
          <mat-select [formControl]="ruleTypeControl">
            <mat-option value="weekly">{{ 'schedule.rrule.weekly' | translate }}</mat-option>
            <mat-option value="every_n_weeks">{{
              'schedule.rrule.every_n_weeks' | translate
            }}</mat-option>
            <mat-option value="monthly">{{ 'schedule.rrule.monthly' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
        @if (ruleType() === 'weekly' || ruleType() === 'every_n_weeks') {
          <mat-form-field appearance="outline" class="schedule-config__field">
            <mat-label>{{ 'schedule.rrule.day_of_week.label' | translate }}</mat-label>
            <mat-select [formControl]="dayOfWeekControl">
              @for (d of weekdays; track d) {
                <mat-option [value]="d">{{
                  'schedule.rrule.day_of_week.' + d | translate
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @if (ruleType() === 'every_n_weeks') {
          <mat-form-field appearance="outline" class="schedule-config__field">
            <mat-label>{{ 'schedule.rrule.interval_n.label' | translate }}</mat-label>
            <input matInput type="number" min="2" [formControl]="intervalNControl" />
          </mat-form-field>
        }
        @if (ruleType() === 'monthly') {
          <mat-form-field appearance="outline" class="schedule-config__field">
            <mat-label>{{ 'schedule.rrule.monthly_day.label' | translate }}</mat-label>
            <input matInput type="number" min="1" max="31" [formControl]="monthlyDayControl" />
          </mat-form-field>
        }
        <mat-checkbox [formControl]="showStartDateControl">
          {{ 'schedule.start_date.toggle' | translate }}
        </mat-checkbox>
        @if (showStartDateControl.value) {
          <mat-form-field appearance="outline" class="schedule-config__field">
            <mat-label>{{ 'schedule.start_date.label' | translate }}</mat-label>
            <input matInput type="date" [formControl]="startDateControl" />
          </mat-form-field>
        }
        @if (slug()) {
          @if (saveError()) {
            <p class="schedule-config__error" role="alert">
              {{ 'schedule.error.save_failed' | translate }}
            </p>
          }
          <button mat-flat-button (click)="onSave()" [disabled]="saving()">
            {{ 'schedule.save_button' | translate }}
          </button>
        }
      }
      @if (selectedType() === 'custom_date_list' && slug()) {
        <app-custom-dates-list
          [slug]="slug()!"
          [dates]="localDates()"
          (datesChanged)="onDatesChanged($event)"
        />
      }
      @if (slug() && schedule()) {
        <button mat-stroked-button class="schedule-config__switch-btn" (click)="onSwitchType()">
          {{
            (selectedType() === 'recurrence_rule'
              ? 'schedule.switch_type.to_custom_dates'
              : 'schedule.switch_type.to_recurrence_rule'
            ) | translate
          }}
        </button>
      }
    </div>
  `,
  styleUrl: './schedule-config.component.scss',
})
export class ScheduleConfigComponent implements OnInit {
  readonly slug = input<string | undefined>();
  readonly schedule = input<ScheduleDto | null>(null);

  readonly scheduleChange = output<CreateRotationScheduleDto>();
  readonly scheduleUpdated = output<ScheduleDto>();

  protected readonly selectedType = signal<ScheduleType>('recurrence_rule');
  protected readonly ruleType = signal<RecurrenceRuleType>('weekly');
  protected readonly saving = signal(false);
  protected readonly saveError = signal(false);
  protected readonly localDates = signal<string[]>([]);

  protected readonly typeControl = new FormControl<ScheduleType>('recurrence_rule', {
    nonNullable: true,
  });
  protected readonly ruleTypeControl = new FormControl<RecurrenceRuleType>('weekly', {
    nonNullable: true,
  });
  protected readonly dayOfWeekControl = new FormControl<number>(1, { nonNullable: true });
  protected readonly intervalNControl = new FormControl<number>(2, { nonNullable: true });
  protected readonly monthlyDayControl = new FormControl<number>(1, { nonNullable: true });
  protected readonly showStartDateControl = new FormControl(false, { nonNullable: true });
  protected readonly startDateControl = new FormControl('', { nonNullable: true });

  protected readonly weekdays = [1, 2, 3, 4, 5, 6, 7] as const;

  private readonly api = inject(ScheduleApiService);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    const s = this.schedule();
    if (s) {
      this.selectedType.set(s.type);
      this.typeControl.setValue(s.type);
      if (s.type === 'recurrence_rule' && s.recurrenceRule) {
        const rule = s.recurrenceRule;
        this.ruleType.set(rule.type);
        this.ruleTypeControl.setValue(rule.type);
        if (rule.dayOfWeek !== undefined) this.dayOfWeekControl.setValue(rule.dayOfWeek);
        if (rule.intervalN !== undefined) this.intervalNControl.setValue(rule.intervalN);
        if (rule.monthlyDay !== undefined) this.monthlyDayControl.setValue(rule.monthlyDay);
      }
      if (s.startDate) {
        this.showStartDateControl.setValue(true);
        this.startDateControl.setValue(s.startDate);
      }
      if (s.type === 'custom_date_list') {
        this.localDates.set(s.dates ?? []);
      }
    }

    if (!this.slug()) {
      this.emitScheduleChange();
      merge(
        this.typeControl.valueChanges,
        this.ruleTypeControl.valueChanges,
        this.dayOfWeekControl.valueChanges,
        this.intervalNControl.valueChanges,
        this.monthlyDayControl.valueChanges,
        this.showStartDateControl.valueChanges,
        this.startDateControl.valueChanges,
      ).subscribe(() => {
        this.selectedType.set(this.typeControl.value);
        this.ruleType.set(this.ruleTypeControl.value);
        this.emitScheduleChange();
      });
    }
  }

  protected onDatesChanged(dates: string[]): void {
    this.localDates.set(dates);
    const current = this.schedule();
    const updated: ScheduleDto = {
      type: 'custom_date_list',
      startDate: current?.startDate,
      dates,
    };
    this.scheduleUpdated.emit(updated);
  }

  protected onSave(): void {
    const slug = this.slug();
    if (!slug) return;
    const rule = this.buildRule();
    if (!rule) return;
    const startDate =
      this.showStartDateControl.value && this.startDateControl.value
        ? this.startDateControl.value
        : undefined;
    this.saving.set(true);
    this.saveError.set(false);
    this.api.configureRecurrenceRule(slug, { rule, startDate }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.scheduleUpdated.emit(updated);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set(true);
      },
    });
  }

  protected onSwitchType(): void {
    const slug = this.slug();
    if (!slug) return;
    const targetType: ScheduleType =
      this.selectedType() === 'recurrence_rule' ? 'custom_date_list' : 'recurrence_rule';
    const ref = this.dialog.open(ConfirmSwitchDialogComponent);
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.api.switchType(slug, { type: targetType }).subscribe({
        next: (updated) => {
          this.selectedType.set(updated.type);
          this.typeControl.setValue(updated.type);
          if (updated.type === 'custom_date_list') {
            this.localDates.set(updated.dates ?? []);
          } else {
            this.ruleType.set('weekly');
            this.ruleTypeControl.setValue('weekly');
          }
          this.scheduleUpdated.emit(updated);
        },
      });
    });
  }

  private buildRule(): RecurrenceRuleDto | null {
    const type = this.ruleType();
    if (!type) return null;
    const rule: RecurrenceRuleDto = { type };
    if (type === 'weekly' || type === 'every_n_weeks') {
      rule.dayOfWeek = this.dayOfWeekControl.value as IsoWeekday;
    }
    if (type === 'every_n_weeks') rule.intervalN = this.intervalNControl.value;
    if (type === 'monthly') rule.monthlyDay = this.monthlyDayControl.value;
    return rule;
  }

  private emitScheduleChange(): void {
    const type = this.typeControl.value;
    if (type === 'custom_date_list') {
      this.scheduleChange.emit({ type: 'custom_date_list' });
      return;
    }
    const rule = this.buildRule();
    if (!rule) return;
    const dto: CreateRotationScheduleDto = { type: 'recurrence_rule', recurrenceRule: rule };
    if (this.showStartDateControl.value && this.startDateControl.value) {
      dto.startDate = this.startDateControl.value;
    }
    this.scheduleChange.emit(dto);
  }
}
