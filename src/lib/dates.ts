// Date helpers. All "calendar days" are plain 'YYYY-MM-DD' strings interpreted in the user's
// timezone — never JS Date objects at UTC midnight — so a day never shifts because of UTC conversion.

export type ISODate = string; // 'YYYY-MM-DD'

export const DEFAULT_TZ = 'Asia/Beirut';

const pad = (n: number) => String(n).padStart(2, '0');

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date of an instant in a given IANA timezone. */
export function dateInTz(instant: Date | number | string, tz: string = DEFAULT_TZ): ISODate {
  const d = instant instanceof Date ? instant : new Date(instant);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Wall-clock time 'HH:MM' of an instant in a timezone. */
export function timeInTz(instant: Date | number, tz: string = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant instanceof Date ? instant : new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

export function todayISO(tz: string = DEFAULT_TZ): ISODate {
  return dateInTz(new Date(), tz);
}

/** Parse 'YYYY-MM-DD' into [y, m, d] numbers. */
export function parseISODate(s: ISODate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parseISODate(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Arithmetic uses UTC so it is independent of the device timezone and DST.
const toUTC = (s: ISODate) => {
  const [y, m, d] = parseISODate(s);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (d: Date): ISODate => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDays(s: ISODate, n: number): ISODate {
  const d = toUTC(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

export function addMonths(s: ISODate, n: number): ISODate {
  const [y, m, d] = parseISODate(s);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = daysInMonth(target.getUTCFullYear(), target.getUTCMonth() + 1);
  target.setUTCDate(Math.min(d, last));
  return fromUTC(target);
}

export function addYears(s: ISODate, n: number): ISODate {
  return addMonths(s, n * 12);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(s: ISODate): number {
  return toUTC(s).getUTCDay();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

export function startOfWeek(s: ISODate, weekStart = 1): ISODate {
  const delta = (weekday(s) - weekStart + 7) % 7;
  return addDays(s, -delta);
}

export function startOfMonth(s: ISODate): ISODate {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s: ISODate): ISODate {
  const [y, m] = parseISODate(s);
  return `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
}

export function startOfYear(s: ISODate): ISODate {
  return s.slice(0, 4) + '-01-01';
}

export function endOfYear(s: ISODate): ISODate {
  return s.slice(0, 4) + '-12-31';
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Month grid (6 weeks) starting at weekStart. */
export function monthGrid(s: ISODate, weekStart = 1): ISODate[] {
  const first = startOfWeek(startOfMonth(s), weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** Format a plain date for display without timezone shifting. */
export function formatDate(s: ISODate, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(toUTC(s));
}

export function weekdayNames(locale: string, weekStart = 1, style: 'short' | 'narrow' | 'long' = 'short'): string[] {
  // 2023-01-01 was a Sunday
  return Array.from({ length: 7 }, (_, i) => formatDate(addDays('2023-01-01', (i + weekStart) % 7), locale, { weekday: style }));
}

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = intl.supportedValuesOf?.('timeZone') ?? [];
  return list.length ? list : ['Asia/Beirut', 'UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'Asia/Dubai'];
}

/** Offset (ms) of a timezone from UTC at a given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return asUTC - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert a wall-clock date + time in `tz` to a UTC instant (handles DST). */
export function zonedToUtc(date: ISODate, time: string, tz: string = DEFAULT_TZ): Date {
  const [y, m, d] = parseISODate(date);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const zone = isValidTimeZone(tz) ? tz : DEFAULT_TZ;
  let off = tzOffsetMs(new Date(guess), zone);
  let result = guess - off;
  const off2 = tzOffsetMs(new Date(result), zone);
  if (off2 !== off) {
    off = off2;
    result = guess - off;
  }
  return new Date(result);
}
