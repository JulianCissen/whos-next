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
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

import type { AddMemberResponseDto } from '@whos-next/shared';
import { MEMBER_NAME_MAX_LENGTH } from '@whos-next/shared';

import { MembersApiService } from '../../../core/api/members.api';

@Component({
  selector: 'app-add-member-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
  ],
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
        padding-top: 8px;
      }

      .name-field {
        width: 100%;
      }

      .form-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .form-error {
        margin: 0;
        font-size: 0.875rem;
        color: var(--mat-sys-error);
      }
    `,
  ],
})
export class AddMemberFormComponent {
  readonly slug = input.required<string>();

  readonly memberAdded = output<AddMemberResponseDto>();

  readonly submitting = signal(false);
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
        this.cdr.markForCheck();
        setTimeout(() => this.nameInputRef.nativeElement.focus(), 0);
      },
      error: (err: { status?: number }) => {
        this.submitting.set(false);
        if (err?.status === 409) {
          this.capacityError.set(true);
        } else {
          this.genericError.set(true);
        }
        this.cdr.markForCheck();
      },
    });
  }
}

function noControlCharsValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';
  return /[\u0000-\u001F\u007F-\u009F]/.test(value) ? { controlChars: true } : null;
}
