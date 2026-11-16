# Notes

## Overview

The Note entity, board and page notes alike, and every read and write of it. The board, the background worker and (through the background) websites all write notes through `notes.storage.ts`, so its locks and queues are what keep several tabs from overwriting each other. Settings and meta storage live in `features/settings/` and `features/meta/`.

## Key files

| File | Owns |
|---|---|
| `notes.types.ts` / `notes.constants.ts` | The Note shape, sizes and limits |
| `notes.rules.ts` | Color, stacking, placement and tilt (pure) |
| `page-notes.rules.ts` | Page address, size and spot rules, and `boardNotes` (the selector that keeps page notes off the board) |
| `notes.validate.ts` | `parseNote`: stored or imported data into a clean Note (`parseSettings` is in `features/settings/`) |
| `notes.storage.ts` | `notes`, creating, restoring and moving notes, the Trash purge |
| `../meta/meta.storage.ts` | `meta` and `runMigrations` |
| `../backup/backup.ts` | JSON export and import (validate everything first, then merge by id, newer wins) |

## Conventions

- Change an existing note only with `notes.patch(id, fields)`. It reads the latest stored copy, merges, and sets `updatedAt`. A field set to `undefined` is removed.
- Anything that checks a limit or picks a color or `z` runs inside `navigator.locks.request('note-create')`: `createNote`, `createPageNote`, `restoreNote`, `movePageNoteToBoard`, `undoMoveToBoard`.
- Limits: 50 active notes per day (`DAY_NOTE_LIMIT`, `DayFullError`) and 50 per page (`'limit'`). Trashed notes don't count.
- Every value read from storage or a backup goes through `parseNote` / `parseSettings`. Unknown fields are dropped, an invalid setting falls back to its default.
- Settings writes are debounced (500 ms) because `chrome.storage.sync` allows about 120 writes a minute. Pages call `settings.flush()` when they hide.
- A data shape change needs a migration in `runMigrations`, which the background runs on install and update.

## Gotchas

- Locks are not reentrant. Code already inside `note-create` must not call another function that takes it (for example `restoreNote` from `undoMoveToBoard`), or it waits forever. Use `notes.patch` plus the check instead.
- Saves for one note run one at a time through a per note queue. A move waits for queued saves first, so it reads the latest text.
- `chrome.storage.local` can't change two keys as one step. Multi note operations order their writes so a failure in between leaves both notes, never neither.
- Other locks elsewhere: `carry-over` (board) and `reminder-check` (background).

## Related specs

- [0001 storage design](../../../docs/specs/0001-chrome-extension-mvp/0002-local-storage-data.md)
- [0004 move a page note](../../../docs/specs/0004-move-page-note-board/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
