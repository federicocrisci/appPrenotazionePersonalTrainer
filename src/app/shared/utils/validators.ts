import { AbstractControl, ValidationErrors } from '@angular/forms';

export const PRIVACY_VERSION = 'draft-v1';

export function nonBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim().length > 0 ? null : { blank: true };
}

export function strongPassword(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return typeof value === 'string' && value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
    ? null : { passwordStrength: true };
}

export function optionalHttpsUrl(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? null : { httpsUrl: true };
  } catch {
    return { httpsUrl: true };
  }
}

export function validTimezone(control: AbstractControl): ValidationErrors | null {
  try {
    new Intl.DateTimeFormat('it', { timeZone: String(control.value) }).format();
    return null;
  } catch {
    return { timezone: true };
  }
}
