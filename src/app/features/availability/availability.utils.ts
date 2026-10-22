import { Temporal } from '@js-temporal/polyfill';
import { wallTimeToIso } from '../../shared/utils/date';

/** Date ranges are inclusive for full days, and converted in the trainer's zone. */
export function blockInterval(value: {
  startDate: string; endDate: string; startTime: string; endTime: string;
  allDay: boolean; timezone: string;
}): { starts_at: string; ends_at: string } {
  const startDay = Temporal.PlainDate.from(value.startDate);
  const lastDay = Temporal.PlainDate.from(value.endDate);
  if (Temporal.PlainDate.compare(lastDay, startDay) < 0) throw new RangeError('INVALID_DATE_RANGE');
  const endDay = value.allDay ? lastDay.add({ days: 1 }) : lastDay;
  const starts_at = wallTimeToIso(startDay.toString(), value.allDay ? '00:00' : value.startTime, value.timezone);
  const ends_at = wallTimeToIso(endDay.toString(), value.allDay ? '00:00' : value.endTime, value.timezone);
  if (Date.parse(ends_at) <= Date.parse(starts_at)) throw new RangeError('INVALID_DATE_RANGE');
  return { starts_at, ends_at };
}
