import { defineConfig } from 'vitest/config';

// Unit and component tests. Separate from wxt.config.ts on purpose: tests run
// in jsdom with an in-memory fake of the chrome.* APIs (src/test/setup.ts).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
