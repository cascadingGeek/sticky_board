/**
 * Date helpers. Board dates are plain YYYY-MM-DD strings in the resolved
 * timezone. Never use toISOString() for day keys: it returns the UTC date.
 */

/** Splits YYYY-MM-DD into numbers (callers validate the format first where it matters). */
const ymd = (s: string): [number, number, number] => {
  const [y = 1970, m = 1, d = 1] = s.split('-').map(Number);
  return [y, m, d];
};

export const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 'auto' (or anything invalid) resolves to this computer's zone. */
export const resolveTz = (timezone: string | undefined): string => {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timezone || timezone === 'auto') return device;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return device;
  }
};

/** Today in a timezone, as YYYY-MM-DD ('en-CA' formats that way). */
export const todayInTz = (timeZone: string, at: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

export const offsetDateStr = (dateStr: string, days: number): string => {
  const [y, m, d] = ymd(dateStr);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
};

export const isDateStr = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = ymd(value);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export const isTimeStr = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Parse YYYY-MM-DD as a local calendar date (for display only). */
export const parseDateStr = (dateStr: string): Date => {
  const [y, m, d] = ymd(dateStr);
  return new Date(y, m - 1, d);
};

export const weekdayName = (dateStr: string): string =>
  parseDateStr(dateStr).toLocaleDateString(undefined, { weekday: 'long' });

export const longDate = (dateStr: string): string =>
  parseDateStr(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

export const shortDay = (dateStr: string): string =>
  parseDateStr(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// Offset of a timezone from UTC at a given instant, in ms (local minus UTC).
const tzOffsetMs = (epoch: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epoch));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(epoch / 1000) * 1000;
};

/**
 * Epoch ms for a wall clock date and time in a timezone. A time skipped by a
 * daylight saving change moves forward to the next valid minute; a repeated
 * time uses its first occurrence.
 */
export const zonedToEpoch = (dateStr: string, time: string, timeZone: string): number => {
  const [y, m, d] = ymd(dateStr);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const HOUR = 3_600_000;
  const candidates = [wall - tzOffsetMs(wall - 12 * HOUR, timeZone), wall - tzOffsetMs(wall + 12 * HOUR, timeZone)];
  const valid = candidates.filter(c => c + tzOffsetMs(c, timeZone) === wall);
  if (valid.length) return Math.min(...valid);

  // Skipped wall time: find the transition instant between the two guesses.
  let lo = Math.min(...candidates);
  let hi = Math.max(...candidates);
  const offLo = tzOffsetMs(lo, timeZone);
  while (hi - lo > 60_000) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (tzOffsetMs(mid, timeZone) === offLo) lo = mid;
    else hi = mid;
  }
  return Math.ceil(hi / 60_000) * 60_000;
};

/** Ms until the next local midnight in a timezone (at least 1 second). */
export const msUntilNextMidnight = (timeZone: string, now = Date.now()): number => {
  const today = todayInTz(timeZone, new Date(now));
  const next = zonedToEpoch(offsetDateStr(today, 1), '00:00', timeZone);
  return Math.max(1000, next - now);
};
