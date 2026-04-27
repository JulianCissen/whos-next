import type { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { merge } from 'rxjs';

import type {
  CreateRotationScheduleDto,
  IsoWeekday,
  RecurrenceRuleDto,
  RecurrenceRuleType,
  ScheduleType,
} from '@whos-next/shared';

function positiveIntValidator(min: number, max: number): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const raw = String(ctrl.value ?? '').trim();
    const n = Number(raw);
    if (!raw || !/^\d+$/.test(raw) || !Number.isInteger(n) || n < min || n > max) {
      return { outOfRange: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-schedule-config-compact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule],
  styleUrl: './schedule-config-compact.component.scss',
  template: `
    <div class="scc">
      <div class="scc__row">
        <div class="scc__toggle" role="group">
          <button
            type="button"
            class="scc__btn"
            [class.scc__btn--on]="type() === 'recurrence_rule'"
            (click)="setType('recurrence_rule')"
          >
            {{ 'landing.cadence_toggle' | translate }}
          </button>
          <button
            type="button"
            class="scc__btn"
            disabled
          >
            {{ 'landing.manual_toggle' | translate }}
          </button>
        </div>
        @if (type() === 'recurrence_rule') {
          <div class="scc__field">
            <div class="scc__ctrl-wrap">
              <span class="scc__ctrl-label">{{
                'schedule.rrule.rule_type_label' | translate
              }}</span>
              <select class="scc__select" [formControl]="ruleTypeCtrl">
                <option value="weekly">{{ 'schedule.rrule.weekly' | translate }}</option>
                <option value="every_n_weeks">
                  {{ 'schedule.rrule.every_n_weeks' | translate }}
                </option>
                <option value="monthly">{{ 'schedule.rrule.monthly' | translate }}</option>
              </select>
            </div>
          </div>
          @if (ruleType() === 'every_n_weeks') {
            <div class="scc__field scc__field--narrow">
              <div
                class="scc__ctrl-wrap"
                [class.scc__ctrl-wrap--error]="intervalNCtrl.invalid && intervalNCtrl.touched"
              >
                <span class="scc__ctrl-label">{{
                  'schedule.rrule.interval_n.label' | translate
                }}</span>
                <input
                  class="scc__input"
                  type="text"
                  inputmode="numeric"
                  [formControl]="intervalNCtrl"
                />
              </div>
            </div>
          }
          @if (ruleType() === 'weekly' || ruleType() === 'every_n_weeks') {
            <div class="scc__field">
              <div class="scc__ctrl-wrap">
                <span class="scc__ctrl-label">{{
                  'schedule.rrule.day_of_week.label_compact' | translate
                }}</span>
                <select class="scc__select" [formControl]="dayCtrl">
                  @for (d of weekdays; track d) {
                    <option [value]="d">{{ 'schedule.rrule.day_of_week.' + d | translate }}</option>
                  }
                </select>
              </div>
            </div>
          }
          @if (ruleType() === 'monthly') {
            <div class="scc__field scc__field--narrow">
              <div
                class="scc__ctrl-wrap"
                [class.scc__ctrl-wrap--error]="monthlyDayCtrl.invalid && monthlyDayCtrl.touched"
              >
                <span class="scc__ctrl-label">{{
                  'schedule.rrule.monthly_day.label' | translate
                }}</span>
                <input
                  class="scc__input"
                  type="text"
                  inputmode="numeric"
                  [formControl]="monthlyDayCtrl"
                />
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class ScheduleConfigCompactComponent implements OnInit {
  readonly scheduleChange = output<CreateRotationScheduleDto>();

  protected readonly type = signal<ScheduleType>('recurrence_rule');
  protected readonly ruleType = signal<RecurrenceRuleType>('weekly');

  protected readonly typeCtrl = new FormControl<ScheduleType>('recurrence_rule', {
    nonNullable: true,
  });
  protected readonly ruleTypeCtrl = new FormControl<RecurrenceRuleType>('weekly', {
    nonNullable: true,
  });
  protected readonly dayCtrl = new FormControl<number>(1, { nonNullable: true });
  protected readonly intervalNCtrl = new FormControl<string>('2', {
    nonNullable: true,
    validators: [positiveIntValidator(2, 52)],
  });
  protected readonly monthlyDayCtrl = new FormControl<string>('1', {
    nonNullable: true,
    validators: [positiveIntValidator(1, 31)],
  });

  protected readonly weekdays = [1, 2, 3, 4, 5, 6, 7] as const;

  ngOnInit(): void {
    this.emit();
    merge(
      this.typeCtrl.valueChanges,
      this.ruleTypeCtrl.valueChanges,
      this.dayCtrl.valueChanges,
      this.intervalNCtrl.valueChanges,
      this.monthlyDayCtrl.valueChanges,
    ).subscribe(() => {
      this.type.set(this.typeCtrl.value);
      this.ruleType.set(this.ruleTypeCtrl.value);
      this.emit();
    });
  }

  protected setType(t: ScheduleType): void {
    this.typeCtrl.setValue(t);
  }

  private buildRule(): RecurrenceRuleDto {
    const type = this.ruleType();
    const rule: RecurrenceRuleDto = { type };
    if (type === 'weekly' || type === 'every_n_weeks') {
      rule.dayOfWeek = this.dayCtrl.value as IsoWeekday;
    }
    if (type === 'every_n_weeks') {
      const n = Number.parseInt(this.intervalNCtrl.value, 10);
      rule.intervalN = Number.isNaN(n) || n < 2 ? 2 : n;
    }
    if (type === 'monthly') {
      const d = Number.parseInt(this.monthlyDayCtrl.value, 10);
      rule.monthlyDay = Number.isNaN(d) || d < 1 ? 1 : Math.min(d, 31);
    }
    return rule;
  }

  private emit(): void {
    if (this.typeCtrl.value === 'custom_date_list') {
      this.scheduleChange.emit({ type: 'custom_date_list' });
      return;
    }
    this.scheduleChange.emit({ type: 'recurrence_rule', recurrenceRule: this.buildRule() });
  }
}
