import { describe, expect, it } from 'vitest';
import {
  isDateStr,
  isTimeStr,
  msUntilNextMidnight,
  offsetDateStr,
  resolveTz,
  todayInTz,
  zonedToEpoch,
} from './dates';

describe('todayInTz', () => {
  // covers: value sourcing "Today" (the settings time zone decides the day)
  it('returns the calendar day in the given zone, not the UTC day', () => {
    const at = new Date('2026-11-08T23:30:00Z');
    expect(todayInTz('UTC', at)).toBe('2026-11-08');
    expect(todayInTz('Pacific/Kiritimati', at)).toBe('2026-11-09'); // UTC+14
    expect(todayInTz('America/Los_Angeles', at)).toBe('2026-11-08');
  });
});

describe('resolveTz', () => {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;

  it('uses this computer\'s zone for auto, empty or missing', () => {
    expect(resolveTz('auto')).toBe(device);
    expect(resolveTz('')).toBe(device);
    expect(resolveTz(undefined)).toBe(device);
  });

  it('keeps a valid IANA zone the user picked', () => {
    expect(resolveTz('Asia/Tokyo')).toBe('Asia/Tokyo');
  });

  it('falls back to this computer\'s zone for an unknown zone', () => {
    expect(resolveTz('Mars/Olympus_Mons')).toBe(device);
  });
});

describe('offsetDateStr', () => {
  it('moves across month and year ends', () => {
    expect(offsetDateStr('2026-11-30', 1)).toBe('2026-12-01');
    expect(offsetDateStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(offsetDateStr('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles leap days', () => {
    expect(offsetDateStr('2028-02-28', 1)).toBe('2028-02-29');
    expect(offsetDateStr('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('isDateStr', () => {
  it('accepts a real YYYY-MM-DD date', () => {
    expect(isDateStr('2026-11-08')).toBe(true);
    expect(isDateStr('2028-02-29')).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-8', '08-11-2026', '', 20261108, null])(
    'rejects %s',
    value => {
      expect(isDateStr(value)).toBe(false);
    },
  );
});

describe('isTimeStr', () => {
  it.each(['00:00', '09:05', '23:59'])('accepts %s', v => expect(isTimeStr(v)).toBe(true));
  it.each(['24:00', '9:05', '12:60', '12:5', '', undefined])('rejects %s', v => expect(isTimeStr(v)).toBe(false));
});

describe('zonedToEpoch', () => {
  it('converts a wall clock time in a zone to the right instant', () => {
    expect(new Date(zonedToEpoch('2026-11-08', '09:30', 'Africa/Lagos')).toISOString()).toBe('2026-11-08T08:30:00.000Z');
    expect(new Date(zonedToEpoch('2026-07-01', '12:00', 'America/New_York')).toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });

  // covers: value sourcing "Reminder time across daylight saving"
  it('moves a time skipped by spring forward to the next valid minute (02:30 fires at 03:00)', () => {
    expect(new Date(zonedToEpoch('2027-03-14', '02:30', 'America/New_York')).toISOString()).toBe('2027-03-14T07:00:00.000Z');
  });

  it('uses the first occurrence of a time repeated by fall back', () => {
    // 01:30 happens twice on 2026-11-01 in New York: first at EDT (UTC-4).
    expect(new Date(zonedToEpoch('2026-11-01', '01:30', 'America/New_York')).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('msUntilNextMidnight', () => {
  it('counts down to the next local midnight in the zone', () => {
    const now = Date.parse('2026-11-08T22:59:30Z'); // 23:59:30 in Lagos (UTC+1)
    expect(msUntilNextMidnight('Africa/Lagos', now)).toBe(30_000);
  });

  it('never returns less than one second', () => {
    const now = Date.parse('2026-11-08T22:59:59.900Z');
    expect(msUntilNextMidnight('Africa/Lagos', now)).toBe(1000);
  });
});
