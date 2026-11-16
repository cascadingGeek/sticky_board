# Review, chore/feature-architecture, 2026-11-16

**Reviewed by**: Sonnet 5.5 (author on unknown)
**Scope**: 201 files, branch vs main
**Verdict**: Approve with nits

## Summary
Reorganizes src by feature (entrypoints, surfaces, features, lib/utils) with ESLint-enforced one way imports. Storage is split into notes, settings and meta, and tests are moved to tests/. Diffing the moved files against the base shows import-only changes plus pure function moves (hashOf, pinFor, linkify, hostOf, sanitizePagePatch, openPage, Loading/Error states). Bodies are unchanged and no behavior change was found. The Caveat Brush bare-specifier fix is confirmed in the built CSS and assets.

## Minor
### 🟡 Scrollbar guard never fires for overlay scrollbars, `src/surfaces/board/components/notes/NoteCard.tsx:80`
**Problem**: `clientX > left + clientWidth` is false for macOS overlay scrollbars (clientWidth equals the full width), so a press on the scrollbar starts a card drag.
**Why it matters**: Scrolling a long note can move the card. Confirmed from the code, but the line is unchanged by this branch (pre-existing).
**Suggested fix**: Use a different scrollbar check, or make the scroll area a no-drag zone. Handle it outside this refactor.

### 🟡 Global `t` shortcut fires before the new draft has focus, `src/surfaces/board/App.tsx:50`
**Problem**: `n` calls requestNewNote, and the draft title only takes focus in a later effect. A fast `t` keydown in between passes isTyping and runs "go to today" ("two" saved as "wo").
**Why it matters**: Lost input. Confirmed from the code and pre-existing (App.tsx logic unchanged).
**Suggested fix**: Ignore single-letter shortcuts for a short window after `n`, or focus the draft synchronously.

### 🟡 Page-notes test is timing sensitive, `tests/surfaces/page-notes/PageNotesApp.test.tsx:106`
**Problem**: The test blurs the input and waits on a `setTimeout(0)` commit in PageDraft with the default 1s waitFor. This is a plausible flake under load, but I could not reproduce it. Only imports changed in this branch.
**Suggested fix**: Assert focus before blurring, or raise the waitFor timeout.

### 🟡 Relative cross-folder imports in tests, `tests/features/**` (for example `tests/features/notes/notes.storage.test.ts:5`)
**Problem**: `../../support/notes` and `../../support/fakeChrome` break "relative only within one folder". ESLint scopes that rule to `src/**` only, so it is not caught.
**Suggested fix**: Add an `@tests` alias, or extend the lint rule to tests.

### 🟡 Untested logic that moved or was split out
`runMigrations` and `settleThemeDefault` (meta.storage), `parseSettings`, `settings.patch` and `flush` debounce, `linkify`, `splitOrigins`, `sanitizePagePatch` and `pinFor` have little or no direct test coverage in tests/features or tests/utils. A grep of tests found none for `runMigrations`, `parseSettings`, `linkify` or `splitOrigins`. Existing tests may cover some indirectly. The split gave these functions their own modules, so add focused tests.

## Nits
- ⚪ `src/features/site-access/useSiteAccess.ts`: a React hook inside features, which the ESLint message says holds "data and rules, not UI". Consider `src/hooks` (it is domain-coupled, so maybe surfaces/site-access).
- ⚪ `src/features/notes/page-notes.rules.ts`: the page rules sit in the notes folder with a `page-notes.` prefix, which is confusing next to `features/page-notes/`.
- ⚪ `src/features/settings/themes.ts`: raw hex colors. They are documented as intentional swatches, but this breaks the "theme tokens only" rule.
- ⚪ ESLint layer blocks repeat the parent `'../*'` rule by hand. A comment already warns about this.

## Strengths
- Clean module splits with no cycles (settings, meta, notes, page-notes.messages), and only `*.storage.ts` files call chrome.storage (the one exception is a pre-existing `onChanged` listener in background.ts).
- Locking, queueing and the "page address from the sender" invariants survive intact, and the layer boundaries are encoded in ESLint.
- Lint, typecheck, build and zip pass per the runtime verification, and the font is verified in the built output.

## Test coverage
Existing suites moved and mirror src/ with only import edits, so coverage of notes storage, locks, moves, backup, capture, reminders and page notes is preserved. The gaps are listed under Minor.

Note: I ran `git add -N .` while reading the diff. It only marks intent-to-add on existing untracked files, and none appeared in status, but the index may differ slightly.
