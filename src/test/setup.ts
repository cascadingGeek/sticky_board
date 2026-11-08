import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { installFakeChrome } from './fakeChrome';

// A fresh, empty browser for every test.
beforeEach(() => {
  installFakeChrome();
});

afterEach(() => {
  cleanup();
});
