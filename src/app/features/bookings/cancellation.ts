import type { Booking } from '../../core/models';
/** UI affordance only. The database checks this boundary again atomically. */
export function canCancelBooking(booking: Booking & { cancellation_hours?: number }, isTrainer: boolean, now: number): boolean {
  if (booking.status !== 'confirmed') return false;
  if (isTrainer) return true;
  const cutoffHours = booking.cancellation_hours ?? 12;
  return Date.parse(booking.starts_at) > now && now <= Date.parse(booking.starts_at) - cutoffHours*3600000;
}
