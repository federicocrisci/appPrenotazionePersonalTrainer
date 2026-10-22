import '@angular/compiler';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { nonBlank, optionalHttpsUrl, strongPassword, validTimezone } from './validators';
import { ConfigurationError, errorMessage } from './errors';

describe('registration and profile validation', () => {
  it('rejects whitespace-only names', () => {
    expect(nonBlank(new FormControl('   '))).toEqual({ blank: true });
    expect(nonBlank(new FormControl(' Ada '))).toBeNull();
  });
  it('requires a 12-character password with lowercase, uppercase and a number', () => {
    for (const value of ['', 'short123', 'onlylettershere', '123456789012', 'lowercaseonly12', 'UPPERCASEONLY12']) expect(strongPassword(new FormControl(value))).not.toBeNull();
    expect(strongPassword(new FormControl('Sufficiently-long1'))).toBeNull();
  });
  it('accepts only HTTPS or empty optional avatar URLs', () => {
    expect(optionalHttpsUrl(new FormControl(''))).toBeNull();
    expect(optionalHttpsUrl(new FormControl('https://example.test/avatar.png'))).toBeNull();
    expect(optionalHttpsUrl(new FormControl('javascript:alert(1)'))).not.toBeNull();
    expect(optionalHttpsUrl(new FormControl('http://example.test/avatar.png'))).not.toBeNull();
  });
  it('validates IANA timezone names', () => {
    expect(validTimezone(new FormControl('Europe/Rome'))).toBeNull();
    expect(validTimezone(new FormControl('Europe/Invalid'))).not.toBeNull();
  });
});

describe('safe UI errors', () => {
  it('never renders unknown raw database messages', () => {
    const raw = 'internal table private_details: failure';
    expect(errorMessage({ message: raw })).not.toContain(raw);
  });
  it('translates authentication and concurrency errors into actionable messages', () => {
    expect(errorMessage({ code: 'invalid_credentials' })).toContain('Email o password');
    expect(errorMessage({ code: '23P01' })).toContain('appena prenotato');
    expect(errorMessage({ message: 'BOOKING_CUTOFF' })).toContain('termine');
    expect(errorMessage(new ConfigurationError())).toContain('Supabase');
  });
});
