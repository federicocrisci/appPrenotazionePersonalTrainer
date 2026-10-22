import { describe, expect, it } from 'vitest';
import { dateInZone, localDateKey, wallTimeToIso } from './date';

describe('timezone conversion', () => {
  it('builds a local date from local date components, without a UTC day shift', () => {
    expect(localDateKey(new Date(2026, 10, 2, 0, 30))).toBe('2026-11-02');
  });
  it('converts Rome winter and summer wall clock time to the correct UTC instant', () => {
    expect(wallTimeToIso('2026-11-02', '09:00', 'Europe/Rome')).toBe('2026-11-02T08:00:00Z');
    expect(wallTimeToIso('2026-07-06', '09:00', 'Europe/Rome')).toBe('2026-07-06T07:00:00Z');
  });
  it('rejects nonexistent spring DST time instead of silently shifting a block', () => {
    expect(() => wallTimeToIso('2026-03-29', '02:30', 'Europe/Rome')).toThrow();
  });
  it('rejects ambiguous autumn DST time instead of choosing an arbitrary occurrence', () => {
    expect(() => wallTimeToIso('2026-10-25', '02:30', 'Europe/Rome')).toThrow();
  });
  it('derives the trainer day correctly when the viewer lives in another timezone', () => {
    expect(dateInZone('2026-11-02T00:30:00Z', 'America/New_York')).toBe('2026-11-01');
    expect(dateInZone('2026-11-02T00:30:00Z', 'Europe/Rome')).toBe('2026-11-02');
  });
});
