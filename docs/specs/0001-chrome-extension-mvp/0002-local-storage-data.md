# 0002. Local storage, trash and backups

## Summary

Each note is saved as its own entry in Chrome's local extension storage, so two open tabs can never overwrite each other's edits. Settings live in Chrome sync storage, so your theme follows you to other computers. Deleted notes wait 30 days in Trash, and a JSON backup file can be downloaded and merged back in at any time. All of this goes through one small storage layer that both the page and the background worker use.

## Requirements

**User stories**
- As a user, I want my notes to survive restarts and stay in sync across my open tabs so that I never lose or duplicate work.
- As a user, I want deleted notes recoverable and a backup file I control so that I trust the extension with my data.

**Acceptance criteria**
- **AC-1**: A created or edited note is still there, unchanged, after closing and reopening Chrome. It is stored under the key `note:<id>` in `chrome.storage.local`.
- **AC-2**: With two board tabs open, an edit in one tab shows in the other within 1 second without a reload. Editing two different notes at the same time in two tabs keeps both edits.
- **AC-3**: A settings change is saved to `chrome.storage.sync` and appears on another computer signed into the same Chrome profile with sync on. With Chrome sync off, settings still persist on this computer.
- **AC-4**: Deleting a note moves it to Trash (`deletedAt` set) and off its board. Restore returns it to its original day and position. "Delete forever" and "Empty trash" remove the key. A trashed note older than 30 days is removed within 24 hours of Chrome running.
- **AC-5**: Export downloads `sticky-board-backup-YYYY-MM-DD.json` holding every note (Trash included) and the settings. Import merges by note `id`: a note missing locally is added, and for a note on both sides the one with the newer `updatedAt` wins. An invalid file is rejected with a clear message and no data changes.
- **AC-6**: If a storage write fails, the user sees an error toast and the screen returns to the last saved state.

## Decision

A storage layer in `src/lib/storage/` that wraps `chrome.storage`. Notes use one key each, settings use one synced key, and changes reach every open page through `chrome.storage.onChanged`. `StickyBoardContext` keeps its public function signatures and calls this layer instead of `localStorage`.

## Design

**Storage layer API** (`src/lib/storage/`)

| Function | Input | Output | Notes |
|---|---|---|---|
| `notes.getAll()` | none | `Note[]` | `chrome.storage.local.get(null)`, keeps keys starting with `note:`. |
| `notes.create(note)` | `Note` | `Promise<void>` | New note only; writes one key. Rejects on failure. |
| `notes.patch(id, fields)` | id, partial `Note` | `Promise<Note>` | The only way to change an existing note: reads the latest stored copy, merges only `fields`, sets `updatedAt`, writes. Calls for the same id run one at a time (a small queue per id), so saves can't land out of order. Rejects on failure or if the note no longer exists. |
| `notes.putMany(notes)` | `Note[]` | `Promise<void>` | One `set` call (carry over, import). |
| `notes.remove(ids)` | `string[]` | `Promise<void>` | Permanent delete. |
| `notes.subscribe(cb)` | callback | unsubscribe fn | Listens to `onChanged` for area `local`, reports upserted and removed notes. |
| `meta.get()` / `meta.patch(p)` | partial | `Meta` | Single `meta` key. |
| `settings.get()` / `settings.patch(p)` / `settings.subscribe(cb)` | partial | `Settings` | Single `settings` key in `sync`. On read, each field is checked and an unknown or invalid value (for example a theme from a newer version) falls back to that field's default. `patch` merges pending changes and is debounced 500 ms to stay well under sync's 120 writes per minute; a pending write is flushed on `pagehide` and when the page becomes hidden. |
| `backup.export()` | none | `Blob` | `{ app: "sticky-board", schemaVersion, exportedAt, notes, settings }`. The page downloads it with `URL.createObjectURL` and an `<a download>` click, so no `downloads` permission is needed. |
| `backup.import(file)` | `File` | `{ added, updated, skipped }` | The page reads the file from an `<input type="file">`. Upgrades, validates, then one `putMany`. `skipped` counts notes where the local copy is newer or equally new. |

**Live updates and echoes**: Chrome fires `onChanged` in the tab that made the write too. The context applies an incoming note only if its `updatedAt` is newer than the copy on screen, so an echo of an older save can't undo newer typing. The context also keeps a `lastSaved` map (note id → last copy confirmed in storage), updated when a write resolves and when a newer `onChanged` arrives. When a write fails, the note on screen reverts to `lastSaved`.

**Trash flow**: delete → `patch(id, { deletedAt: now })`; restore → `patch(id, { deletedAt: undefined })`; delete forever / empty trash → `remove`. The reminder check in 0004 ignores trashed notes, so nothing extra is needed for alarms. The background worker makes sure a `purge-trash` alarm (every 24 hours) exists each time it starts (create it if `alarms.get` finds none), and runs the purge once on `onStartup`. The purge removes notes with `deletedAt` older than 30 days.

**Import steps**
1. File size up to 50 MB; JSON parses; `app === "sticky-board"`; `schemaVersion` is not higher than the current one (otherwise "This backup is from a newer version").
2. Run the same migration chain the background uses, up to the current `schemaVersion`.
3. Check every note against the full Note shape: `id` string; `title` 1 to 200 chars; `description` up to 5,000; `dateStr` a valid `YYYY-MM-DD`; `noteColor` one of the 8 presets; unknown extra fields (for example `priority` from an older file) dropped; up to 50 well formed subtasks; `positionX`/`positionY` finite numbers (an older file without them gets the first free cell, and without `z` gets the day's highest + 1); `dueTime` `HH:MM` when present; `source.url` http or https only; timestamps valid ISO strings. Any invalid note rejects the whole file, so nothing is half imported.
4. Merge by `id`: missing locally → add; file newer → replace; tie or local newer → keep local. `carriedFromId` values that point at missing notes are kept as is (nothing looks them up).
5. Imported settings replace current settings only if the user ticks "Also restore settings" (default off), and go through the same per field check.

A note deleted forever on this computer comes back if it's in the imported file. That's accepted, because import is a deliberate restore.

**Value sourcing**

| Action | Value | Source |
|---|---|---|
| Any write | `updatedAt` | `new Date().toISOString()` inside `notes.create` / `notes.patch` |
| Failed write | state to revert to | `lastSaved` map in the context |
| Purge | "older than 30 days" | `now − deletedAt > 30 × 24 h`, measured at alarm time |
| Export | file date in name | `todayInTz(resolveTz(settings.timezone))` |
| Import merge | winner | Compare `updatedAt` (ISO strings) of the local and file note |
| Restore | original day and position | The note's own `dateStr`, `positionX`, `positionY` (left untouched by delete) |

**Key invariants**
- Nothing outside `src/lib/storage/` touches `chrome.storage` or `localStorage`, with one exception: the theme cache for first paint in 0003.
- The UI updates optimistically (shows the change before the save finishes), then rolls back that one note to `lastSaved` if the write rejects.
- Two writers (two tabs, or a tab and the background worker) changing different fields of the same note both keep their changes, because `patch` merges fields into the latest stored copy. Two writers changing the same field: the later write wins.
- Settings writes never include notes, so sync's 8 KB per item and 100 KB total limits are never approached.

**Migrations**: `meta.schemaVersion` is 1. The background `runtime.onInstalled` (reason `update`) runs any pending migrations in order before menus are registered.

## Rationale (short)

One key per note was chosen over one big array (today's approach), because the array lets two tabs overwrite each other and rewrites everything on each edit. Notes stay out of `chrome.storage.sync` because its 100 KB cap is the most common complaint about similar extensions. IndexedDB was the runner up: better for thousands of notes or images, but more setup, and not needed at this scale. Details in [rationale.md](rationale.md).
