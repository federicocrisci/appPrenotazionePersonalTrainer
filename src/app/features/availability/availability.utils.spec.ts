import { describe, expect, it } from 'vitest';
import { blockInterval } from './availability.utils';

describe('trainer absence date ranges', () => {
  const base = { startTime: '09:00', endTime: '18:00', allDay: true, timezone: 'Europe/Rome' };
  it('blocks the entire trainer day on the 23-hour spring DST date', () => {
    const interval = blockInterval({ ...base, startDate: '2027-03-28', endDate: '2027-03-28' });
    expect(Date.parse(interval.ends_at) - Date.parse(interval.starts_at)).toBe(23 * 3600_000);
    expect(interval.starts_at).toBe('2027-03-27T23:00:00Z');
    expect(interval.ends_at).toBe('2027-03-28T22:00:00Z');
  });
  it('blocks the entire trainer day on the 25-hour autumn DST date', () => {
    const interval = blockInterval({ ...base, startDate: '2027-10-31', endDate: '2027-10-31' });
    expect(Date.parse(interval.ends_at) - Date.parse(interval.starts_at)).toBe(25 * 3600_000);
  });
  it('includes the end date for multiple whole days', () => {
    const interval = blockInterval({ ...base, startDate: '2027-02-01', endDate: '2027-02-03' });
    expect(Date.parse(interval.ends_at) - Date.parse(interval.starts_at)).toBe(72 * 3600_000);
  });
  it('rejects reversed dates and same-day reversed hours', () => {
    expect(() => blockInterval({ ...base, startDate: '2027-02-03', endDate: '2027-02-01' })).toThrow();
    expect(() => blockInterval({ ...base, allDay: false, startDate: '2027-02-03', endDate: '2027-02-03',
      startTime: '18:00', endTime: '09:00' })).toThrow();
  });
  it('rejects a nonexistent clock time rather than moving the block silently', () => {
    expect(() => blockInterval({ ...base, allDay: false, startDate: '2027-03-28', endDate: '2027-03-28',
      startTime: '02:30', endTime: '04:00' })).toThrow();
  });
});
