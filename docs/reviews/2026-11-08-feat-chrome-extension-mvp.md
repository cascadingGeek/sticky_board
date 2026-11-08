# Review, feat/chrome-extension-mvp, 2026-11-08

**Reviewed by**: claude-sonnet-5-5 (author model not stated)
**Scope**: about 77 changed files, branch vs main (one commit plus uncommitted work)
**Verdict**: Changes requested

## Summary
This turns Sticky Board into a local first Manifest V3 extension with a storage layer, a background worker for capture, reminders and trash purge, and a new tab board. The code is clean and follows the spec closely. Permissions match the spec exactly, there is no network code, note text is never rendered as HTML, and only http and https URLs become links. Nothing still imports the deleted web app files, and only `src/lib/storage/` calls `chrome.storage` (plus one `onChanged` listener in the worker, which is fine). I found no blockers. The one major item is that the most important client logic (optimistic saves and rollback, the editor's reminder reset, and the worker wiring) has no tests. The two earlier fixes (the `forDay` check in CarryOverPrompt and the `.catch` on the patch queue cleanup) are sound.

## Major
### 🟠 Core client and worker logic is untested, `src/lib/StickyBoardContext.tsx:259`
**Problem**: The 151 tests cover storage, reminders, capture, board maths, dates and the carry over prompt well. But nothing tests `patchNote` (optimistic update, pending counter, rollback to the last saved copy, the "so it was undone" toast), the live update merge in `subscribe` (skipping notes with a save in flight), `NoteEditor.save` (sending only changed fields, and clearing `remindedAt` when the day or time changes), or `src/entrypoints/background.ts` (`openBoard` focus or open logic, the notification click path, the context menu failure notification, alarm wiring).
**Why it matters**: These are branching and error handling paths. The `remindedAt` reset in the editor is the only thing that lets an edited note remind again (spec 0004), and a regression would silently break reminders. The rollback logic is where a lost edit would hide.
**Suggested fix**: Add tests for the provider with the fake chrome helper (a failing save restores the saved copy and toasts; two quick patches settle on the stored result; a remote change during a save is ignored then reconciled). Add an editor test for the `remindedAt` reset. Add background tests that call the registered listeners with the fake chrome (openBoard with and without an open board tab, notification click with a deleted note, capture failure shows the failure notification).

## Minor
### 🟡 Two contexts can overwrite each other's field, `src/lib/storage/index.ts:73`
**Problem**: The per note queue is a module level `Map`, so it only orders saves inside one page or one worker. Two tabs, or a tab and the worker, can both read the same note and then both write, so the later write drops the other's change. A concrete case: the worker writes `remindedAt` while the page saves an edit, the page's write lacks `remindedAt`, and the reminder is announced a second time.
**Why it matters**: The window is a few milliseconds, but spec 0002 promises two tabs can never overwrite each other's edits, and `createNote` already uses `navigator.locks` for the same reason.
**Suggested fix**: Run the read, merge and write of `patch` inside a `navigator.locks.request` keyed by the note id.

### 🟡 Carry over writes whole notes outside `notes.patch`, `src/components/CarryOverPrompt.tsx:60`
**Problem**: `carry` reads all notes, then `putMany` writes full copies of the originals with `carriedToDate`. If the user, another tab or the worker changed an original between the read and the write, that change is overwritten. Spec 0003 does say one `putMany`, but it conflicts with the shared invariant that every write goes through `notes.patch`.
**Why it matters**: Small chance of a lost edit or lost `remindedAt` on an original.
**Suggested fix**: Write the copies with `putMany`, then tag each original with `notes.patch(id, { carriedToDate })`. Also note that copies keep `remind` and `dueTime`, so carrying at 10:00 a 09:00 reminder produces an instant "You missed 1 reminder" notification. Consider whether that is wanted.

### 🟡 A settings change can be lost on a quick close, `src/lib/storage/index.ts:188`
**Problem**: `flush` awaits `settings.get()` before it calls `sync.set`. When it runs from `pagehide`, the page may be torn down before the `set` happens. Also `pendingSettings` is cleared before the write, so a failed write drops the change with no message while the UI still shows the new value.
**Why it matters**: A theme or time zone change made just before closing the tab may not stick.
**Suggested fix**: Keep a local copy of the last known settings so flush can call `sync.set` immediately, and put the fields back into `pendingSettings` (with a toast) if the write fails.

### 🟡 Trash purge only runs at browser start and once a day, `src/entrypoints/background.ts:59`
**Problem**: This matches spec 0002 and the verify step works through `onStartup`. But the every wake path (line 105) does not purge, and the Trash drawer (`TrashDrawer.tsx:51`) shows "0 days left" for notes that are already past 30 days until the next purge. An install, update or reload also skips the purge.
**Why it matters**: Not a correctness bug for AC-4, but the 30 day promise is only as good as the next startup or alarm.
**Suggested fix**: Call `purgeTrash()` on every worker wake next to `runReminderCheck()`, and hide notes older than 30 days in the drawer.

### 🟡 A failed "reminded" write still sends the notification, `src/lib/reminders.ts:36`
**Problem**: The `catch` around `notes.patch` swallows every error, not just "note is gone", and the notification is then shown anyway. If the write fails for another reason (for example a storage error), `remindedAt` stays unset and the same reminder is announced again on the next storage change or alarm.
**Why it matters**: Repeated notifications for one reminder, which is the thing the "mark first" rule was meant to prevent.
**Suggested fix**: Only notify for notes whose patch succeeded; treat the "no longer exists" error as skip and let other errors skip the notification too.

### 🟡 Worker listeners can fail without any handling, `src/entrypoints/background.ts:50`
**Problem**: `onInstalled`, `onStartup`, `onAlarm` and `notifications.onClicked` are async with no `try/catch`. If `runMigrations` throws on install, the context menus and alarms are never created, with only an unhandled rejection in the worker console.
**Why it matters**: A single storage hiccup at install leaves the extension half set up.
**Suggested fix**: Create the menus and alarms first (or in separate guarded steps) so one failure does not block the rest.

### 🟡 Import compares timestamps as plain strings, `src/lib/storage/backup.ts:85`
**Problem**: `isIso` accepts any string `Date.parse` understands, but the merge compares `updatedAt` with `>` on the raw strings. A value like `2026-11-08` and `2026-11-08T00:00:00.000Z` compare wrongly, as would a timezone offset form.
**Why it matters**: A newer note in a hand edited or foreign file may be skipped, or an older one may win.
**Suggested fix**: Compare with `Date.parse`, or require the canonical `toISOString` format in `parseNote`.

## Nits
- ⚪ `public/theme-boot.js:6`, the cached theme is applied without checking it is one of the five known themes; a bad value leaves `data-theme` unset until the app loads.
- ⚪ `src/lib/StickyBoardContext.tsx:62`, `readHashDate` calls `history.replaceState` inside a `useState` initializer, which is a side effect during render (works today, fragile).
- ⚪ `src/lib/StickyBoardContext.tsx:145`, `lastSaved.current.set` runs inside a `setNoteMap` updater; keep updaters pure.
- ⚪ `src/App.tsx:36`, `useStickyBoard()` is called twice; merge into one destructure.
- ⚪ `src/lib/storage/backup.ts:61`, duplicate ids inside one backup file are both counted as added but only the last is written.

## Strengths
- The storage boundary is real: one module owns `chrome.storage`, notes are one key each, saves per note are queued, and `createNote` and the carry over prompt use `navigator.locks` so tabs and the worker take turns.
- Validation is strict and total: `parseNote` rejects bad data, a backup is checked fully before anything is written, and unsafe URLs (such as `javascript:`) are refused at import time and never become links. Links open with `noopener noreferrer`.
- The manifest permissions match the spec exactly, and the build has no network calls and no `innerHTML`.
- The time zone code (`zonedToEpoch`) handles skipped and repeated daylight saving times with tests, and the reminder check marks notes as reminded before it notifies.

## Test coverage
Strong for the library layer: storage (patch merge, undefined removal, queue ordering, failed save without an unhandled rejection, subscribe, settings debounce, purge, migrations), backup import and export (all rejection paths and merge rules), reminders (due, missed, once only, alarm set and cleared, zone aware), capture, board maths, dates, and the carry over prompt including the stale offer fix. The queue fix has its own test. Gaps: the provider's optimistic save and rollback, the live update merge, `NoteEditor`, `NoteCard` drag and keyboard moves, `Board` draft handling, `SettingsDrawer` import UI, and everything in `background.ts`. There is also no test that a failed `remindedAt` write skips the notification.
