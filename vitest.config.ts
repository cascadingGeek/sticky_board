import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests run in jsdom against an in-memory fake of the chrome.* APIs (tests/support/fakeChrome.ts).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
