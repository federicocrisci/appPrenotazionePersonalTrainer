import { Temporal } from '@js-temporal/polyfill';

export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateInZone(date: Date | string, timezone: string): string {
  const iso = typeof date === 'string' ? date : date.toISOString();
  return Temporal.Instant.from(iso).toZonedDateTimeISO(timezone).toPlainDate().toString();
}

/** A missing or repeated wall clock time must be chosen explicitly instead of silently shifted. */
export function wallTimeToIso(day: string, time: string, timezone: string): string {
  return Temporal.PlainDateTime.from(`${day}T${time}`)
    .toZonedDateTime(timezone, { disambiguation: 'reject' })
    .toInstant().toString();
}
