import type { AbstractControl, ValidationErrors } from '@angular/forms';

export function noControlCharsValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value : '';
  return /[\u0000-\u001F\u007F]/.test(value) ? { controlChars: true } : null;
}
