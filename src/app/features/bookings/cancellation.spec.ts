import { describe, expect, it } from 'vitest';
import type { Booking } from '../../core/models';
import { canCancelBooking } from './cancellation';
const booking = { status:'confirmed', starts_at:'2026-11-12T18:00:00Z', cancellation_hours:12 } as Booking & { cancellation_hours:number };
describe('cancellation affordance', () => {
  it('accepts the 12-hour boundary and rejects one millisecond later', () => {
    expect(canCancelBooking(booking,false,Date.parse('2026-11-12T06:00:00Z'))).toBe(true);
    expect(canCancelBooking(booking,false,Date.parse('2026-11-12T06:00:00.001Z'))).toBe(false);
  });
  it('uses trainer-specific cutoff hours', () => {
    expect(canCancelBooking({...booking,cancellation_hours:24},false,Date.parse('2026-11-12T00:00:00Z'))).toBe(false);
  });
  it('permits trainer cancellation while denying final state changes', () => {
    expect(canCancelBooking(booking,true,Date.parse('2026-12-01T00:00:00Z'))).toBe(true);
    expect(canCancelBooking({...booking,status:'cancelled'},true,0)).toBe(false);
  });
});
