import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import type { AddMemberResponseDto } from '@whos-next/shared';
import { MEMBER_NAME_MAX_LENGTH } from '@whos-next/shared';

import { MembersApiService } from '../../../core/api/members.api';
import { noControlCharsValidator } from '../../../shared/validators';

@Component({
  selector: 'app-add-member-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './add-member-form.component.html',
  styles: [
    `
      :host {
        display: block;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 4px;
      }
      .ctrl-wrap {
        position: relative;
      }
      .ctrl-label {
        position: absolute;
        top: 9px;
        left: 18px;
        font-family: 'Inter Tight', sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--mat-sys-on-surface-variant);
        pointer-events: none;
        z-index: 1;
      }
      .ctrl-input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        background: var(--mat-sys-surface-container-low);
        border: 1.5px solid var(--mat-sys-outline-variant);
        border-radius: 16px;
        padding: 26px 18px 11px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
        appearance: none;
        transition: border-color 160ms ease;
        &:focus {
          outline: none;
          border-color: var(--mat-sys-primary);
        }
      }
      .ctrl-error {
        display: block;
        margin-top: 6px;
        padding-left: 18px;
        font-size: 12px;
        color: var(--mat-sys-error);
      }
      .placement-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .placement-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
      }
      .placement-toggle {
        display: inline-flex;
        background: var(--mat-sys-surface-container);
        border-radius: 999px;
        padding: 3px;
        gap: 2px;
      }
      .placement-btn {
        border: none;
        background: transparent;
        border-radius: 999px;
        padding: 5px 16px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
        cursor: pointer;
        transition:
          background 130ms ease,
          color 130ms ease,
          box-shadow 130ms ease;
        &--on {
          background: var(--mat-sys-surface);
          color: var(--mat-sys-on-surface);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }
      }
      .form-error {
        margin: 0;
        font-size: 0.875rem;
        color: var(--mat-sys-error);
      }
      .submit-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .submit-btn {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        border: none;
        border-radius: 999px;
        padding: 10px 24px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 130ms ease;
        flex-shrink: 0;
        &:disabled {
          opacity: 0.5;
          cursor: default;
        }
      }
      .add-another-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
        cursor: pointer;
        user-select: none;
      }
      .add-another-check {
        width: 16px;
        height: 16px;
        accent-color: var(--mat-sys-primary);
        cursor: pointer;
        flex-shrink: 0;
      }
    `,
  ],
})
export class AddMemberFormComponent {
  readonly slug = input.required<string>();
  readonly memberAdded = output<AddMemberResponseDto>();
  readonly closeRequested = output<void>();

  readonly submitting = signal(false);
  readonly addAnother = signal(false);
  readonly capacityError = signal(false);
  readonly genericError = signal(false);

  @ViewChild(FormGroupDirective) private formDir!: FormGroupDirective;
  @ViewChild('nameInput') private nameInputRef!: ElementRef<HTMLInputElement>;

  private readonly api = inject(MembersApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.maxLength(MEMBER_NAME_MAX_LENGTH), noControlCharsValidator],
    ],
    placement: ['back' as 'front' | 'back', [Validators.required]],
  });

  toggleAddAnother(): void {
    this.addAnother.update((v) => !v);
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) return;
    const name = this.form.controls.name.value?.trim() ?? '';
    if (!name) {
      this.form.controls.name.setErrors({ whitespace: true });
      return;
    }
    const placement = this.form.controls.placement.value ?? 'back';
    this.submitting.set(true);
    this.capacityError.set(false);
    this.genericError.set(false);
    this.api.addMember(this.slug(), { name, placement }).subscribe({
      next: (member) => {
        this.formDir.resetForm({
          name: '',
          placement: this.form.controls.placement.value ?? 'back',
        });
        this.submitting.set(false);
        this.memberAdded.emit(member);
        if (!this.addAnother()) this.closeRequested.emit();
        this.cdr.markForCheck();
        setTimeout(() => this.nameInputRef.nativeElement.focus(), 0);
      },
      error: (err: { status?: number }) => {
        this.submitting.set(false);
        if (err?.status === 409) this.capacityError.set(true);
        else this.genericError.set(true);
        this.cdr.markForCheck();
      },
    });
  }
}
