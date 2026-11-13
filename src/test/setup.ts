import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { installFakeChrome } from './fakeChrome';
import { resetTimeFormat } from '../lib/dates';

// Pin the locale to en-US so time text ("3:00 PM") is the same on every machine.
const NativeDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
  return new NativeDateTimeFormat(locales ?? 'en-US', options);
} as typeof Intl.DateTimeFormat;
Object.assign(Intl.DateTimeFormat, NativeDateTimeFormat);

// A fresh, empty browser for every test.
beforeEach(() => {
  installFakeChrome();
  resetTimeFormat();
});

afterEach(() => {
  cleanup();
});
