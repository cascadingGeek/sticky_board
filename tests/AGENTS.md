# Tests

## Overview

Every test for the project, in the same folder path as the code it covers under `src/`. Tests run the real storage layer and React code against an in-memory fake of the Chrome APIs, so only the browser boundary is faked.

## Key files

| File | Owns |
|---|---|
| `setup.ts` | A fresh fake browser for every test, jest-dom matchers, the en-US locale |
| `support/fakeChrome.ts` | `installFakeChrome()`: storage, alarms, notifications, runtime, permissions, scripting, `navigator.locks` |
| `support/notes.ts` | `makeNote`, `seedNotes`, `storedNotes` |
| `../vitest.config.ts` | jsdom, the `@` alias to `src/`, includes `tests/**/*.test.{ts,tsx}` |

## Commands

```bash
npm test                              # the whole suite
npx vitest run tests/utils/dates        # one folder or file
```

## Conventions

- Import source through `@/` (for example `@/features/notes/notes.storage`) and helpers through relative paths to `support/`.
- Seed data with `seedNotes` and assert on `storedNotes()`, rather than mocking storage functions.
- Name tests by behavior. No spec or AC numbers in names or comments.
- The board's sounds use Web Audio, which jsdom lacks; mock `@/lib/sounds` in component tests that trigger them.

## Gotchas

- The fake's `chrome.storage.local.get/set` are already `vi.fn`. To slow or fail one call, wrap `vi.mocked(fn).getMockImplementation()`; spying on them again makes them call themselves.
- `userEvent` and fake timers clash. In a fake timer test, use `fireEvent` inside `act` and advance time with `vi.advanceTimersByTime`.
- `formatTime` caches its formatter. Tests that change the locale call `resetTimeFormat()`.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
