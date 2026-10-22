import { describe, it, expect } from 'vitest';
import { bookingErrorMessage } from './booking.service';

describe('booking error handling', () => {
  it('explains a concurrent booking conflict without exposing SQL internals', () => {
    expect(bookingErrorMessage({ code: '23P01', message: 'secret constraint detail' })).toContain('appena prenotato');
    expect(bookingErrorMessage({ message: 'SLOT_UNAVAILABLE' })).toContain('Seleziona un altro orario');
  });
  it('distinguishes cutoff from expired authorization', () => {
    expect(bookingErrorMessage({ message: 'BOOKING_CUTOFF' })).toContain('termine');
    expect(bookingErrorMessage({ code: '42501' })).toContain('Accedi nuovamente');
  });
  it('keeps unknown database diagnostics private', () => {
    expect(bookingErrorMessage({ message: 'password database internal SELECT' })).not.toContain('SELECT');
  });
});
