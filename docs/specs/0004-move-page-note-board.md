# 0004. Move a page note to today's board

**Date**: 2026-11-12
**Status**: Proposed

## Summary

A note pinned on a website can be moved to today's board with one button, either on the note itself or in the Pages drawer. The board gets an ordinary board note with the same title, details, checklist and color, plus a link back to the site, and the page note goes to Trash. This rescues notes whose page is gone (a Google Meet call that ended), and an Undo in the message right after puts the page note back and sends the board note to Trash.

## Context

Spec 0002 made page notes live on their page only: they never show on the day board, and the Pages drawer opens their page in a new tab. That works while the page exists. Some pages don't last. A Google Meet link stops working when the call ends, so notes taken during a call are stored and listed in the Pages drawer, but the only way to read them in full is to open a page that no longer exists. Search shows part of the text, but not the whole note.

The user asked for a way to "save a copy of the note so they can access it in the new tab without it being attached to the link". Chrome gives an extension no way to show its own box when a tab closes, so anything automatic would have to be a Chrome notification after the fact. The user chose buttons only.

Forces: the board has a 50 notes per day limit; board notes and page notes share one storage and one `note-create` lock (the lock that stops two tabs creating notes at the same moment); every write from a website goes through the background worker with sender checks (spec 0002); a page note must never show on the board (spec 0002, AC-11).

## Requirements

**User stories**:
- As someone taking notes in a video call, I want to move my note to today's board so that I can still read it after the call link expires.
- As a board user, I want to rescue any page note from the Pages drawer so that a dead or unwanted page doesn't hide my notes.
- As a careful user, I want an Undo right after moving so that a misclick costs nothing.

**Acceptance criteria**:
- **AC-1**: An open note on a website (not collapsed) has a **Move to today's board** button in its top bar. Pressing it creates a board note on today's board and moves the page note to Trash, so it leaves the page.
- **AC-2**: Each note in the Pages drawer has a **Move to today's board** button next to Move to Trash. Pressing it does the same as AC-1, and the row leaves the drawer.
- **AC-3**: The board note has the page note's title, details, color and done state, and its checklist with every item's tick kept as it was. Its day is today in your time zone setting, worked out at the moment you press the button. It sits at the first free spot on today's board, above every other note. It has no due time and no reminder. A move plays the board's "pop" sound when sounds are on.
- **AC-4**: The board note shows the site as a link chip (the same chip right click captures show). Clicking it opens the page in a new tab.
- **AC-5**: After a move from a website, the page shows "Moved to today's board" with an **Undo** button where the note was, for 6 seconds, and focus moves to that Undo button. Each move gets its own message. After a move from the drawer, the board shows the toast "“<title>” moved to today's board" with **Undo**, for 6 seconds (the title cut to 60 characters with "…"). Undo puts the page note back on its page at the same spot, size and collapsed state, and sends the board note to Trash. If the board note was already removed or trashed, Undo still puts the page note back. If the page note is already back (restored in another tab), Undo only sends the board note to Trash.
- **AC-6**: When today already has 50 notes, nothing moves. On a website the note stays on the page (its buttons disabled only while the move runs) and shows "This day already has 50 notes, the most a day can hold. Finish or remove one to add another." In the drawer, the same text shows as an error toast.
- **AC-7**: When the page note was already moved or deleted (for example in another tab), or the request names a note that isn't on this page, nothing is created, and you see "This note was already moved or deleted." When the background doesn't answer, you see "Couldn't move the note. Try again."
- **AC-8**: A move is one storage write: the new board note and the page note's Trash mark land together or not at all. If the write fails, both notes stay as they were and you see "Couldn't move the note. Try again."
- **AC-9**: A website can move and undo only notes pinned on its own page address. A request about any other note is refused and changes nothing.
- **AC-10**: The page note itself still never shows on the day board (spec 0002, AC-11 holds). The board note is an ordinary board note: search, Trash, carry over, calendar counts and the 50 per day limit treat it like any other.
- **AC-11**: Undo when the page already has 50 notes again keeps the board note, leaves the page note in Trash, and shows "This page already has 50 notes." Undo when the page note was emptied from Trash keeps the board note and shows "Couldn't undo, the page note is no longer in Trash."
- **AC-12**: Both buttons are labelled "Move <title> to today's board" for screen readers and work from the keyboard. The on page message is announced (`role="status"`) and its Undo is a real button. The drawer offers the button on every page note, collapsed or not.

## Options considered

### Option 1: Copy, the page note stays

The board gets a copy and the page note stays on its page.

**Pros**:
- Nothing ever leaves its page, so there's no Undo to build.
- The page keeps working if its link comes back.

**Cons**:
- Two copies drift apart as you edit one of them.
- Dead page notes pile up in the drawer, which is the clutter this feature exists to clear.

### Option 2: Move, the page note goes to Trash (chosen)

The board gets a new note and the page note goes to Trash in the same write, with Undo right after.

**Pros**:
- One live note at a time, so nothing drifts.
- The drawer empties as you rescue notes.
- Trash keeps the page note for 30 days, a second safety net behind Undo.

**Cons**:
- It needs an Undo path on two surfaces (page and board).
- Restoring the page note from Trash later gives you two notes again.

### Option 3: Ask each time

A small choice between Copy and Move on every use.

**Pros**:
- It fits both habits.

**Cons**:
- An extra click every time for a decision most people make once.
- Twice the paths to build and test.

### Option 4: Read only view in the drawer

Open a page note's full text inside the drawer, with no move at all.

**Pros**:
- It's the smallest change, with no new writes.

**Cons**:
- The note stays tied to a dead page, so you can't edit it, tick it, or plan it into your day.

## Decision

**Chosen option**: Option 2: Move, the page note goes to Trash

A page note moves to today's board through one storage function that writes the new board note and the page note's Trash mark in a single `chrome.storage.local.set`, inside the `note-create` lock. It's started from a button on the note or in the Pages drawer, and an Undo follows for 6 seconds that restores the page note and sends the board note to Trash.

## Rationale

The problem is a note stranded behind a page that no longer exists. A copy (Option 1) solves reading but leaves the stranded original in the drawer forever and splits edits across two notes. Moving keeps exactly one live note, and Trash plus Undo make the move cheap to reverse, so it needs no confirm dialog. The user chose Move, Undo in the message, today as the day, and buttons only.

Doing the whole move in one storage write, under the same `note-create` lock that already guards the color rule, z order, the page limit and the new day limit, is the cheapest way to make AC-6 and AC-8 hold. The day count and the write happen with no other tab in between, and there's no state where both notes or neither exist. A board note built in the new tab page and a Trash request sent separately would need two locks and a compensating write on failure.

The board note reuses the existing `source` field for its link back, rather than a new `fromPageId` field. That keeps the data model unchanged: import, export, validation and the chip on board notes already handle `source`. Undo doesn't need a stored link either, because the message that offers Undo holds both ids in memory for its 6 seconds.

Undo sends the board note to Trash rather than deleting it for good (a change from the first draft, after the cross check). In the 6 seconds you might start typing in the board note in another tab; a permanent delete would lose that text without warning. Trash reuses an existing safety net, needs no extra rule about whether the board note was edited, and costs only one extra Trash entry.

## Feature design

**Data model sketch**: no new fields, keys or migration. The board note is built from the page note:

| Board note field | Source |
|---|---|
| `id` | new `crypto.randomUUID()` |
| `title`, `description`, `noteColor`, `isCompleted` | the page note, unchanged (the color skips `pickColor`, the no repeat color rule) |
| `subtasks` | the page note's items as they are (including any with an empty title), `title` and `isCompleted` kept, each a new `id`; no new checks, since page notes already meet the board limits |
| `source` | `{ url: page.url, title: (page.title \|\| hostOf(page.url)).slice(0, 200) }`, with `hostOf` from `src/lib/board.ts` |
| `dateStr` | today, `todayInTz(resolveTz(settings.timezone))`, worked out inside the storage function at call time |
| `positionX`, `positionY` | `firstFreeSpot(today's active notes from boardNotes(all), { top: 0, width: 1280 })`, the same fixed starting area right click captures use (it can sit off screen on a narrow window, as captures already can) |
| `z` | `nextZ(boardNotes(all), today)`, so page note z values never count |
| `remind` | `false`; `dueTime`, `remindedAt`, `carriedFromId`, `carriedToDate`, `page`, `width`, `height`, `collapsed` not set |
| `createdAt`, `updatedAt` | now |

The page note is written as `{ ...latest stored copy, deletedAt: now, updatedAt: now }`, read inside the lock, in the same `set` as the board note.

Undo, in the `note-create` lock: first the page note goes back through the existing `restoreNote` (it clears `deletedAt`, bumps `updatedAt`, keeps spot, size, collapsed state and `z`, and refuses with `'limit'` on a full page). Only after that succeeds is the board note sent to Trash (`deletedAt: now`). `chrome.storage.local` can't set one key and change another as a single step, so Undo is two writes in that order. A crash between them leaves two live notes, which nothing loses and you can tidy by hand.

**State transitions**: page note `active` → `trashed` (move) → `active` (Undo or Restore). Board note `created` (move) → `trashed` (Undo), otherwise an ordinary board note.

**API surface**:

| Action | Where | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `movePageNoteToBoard(id, pageUrl?)` | `src/lib/storage`, in the `note-create` lock | page note id; `pageUrl` (from the sender) when called for a website | `{ board: Note, page: Note }` | caller is the new tab page or the background | `'day-full'`, `'gone'` (missing, trashed, not a page note, or `page.url` ≠ `pageUrl`) |
| `undoMoveToBoard(pageId, boardId, pageUrl?)` | `src/lib/storage`, in the `note-create` lock | both ids; `pageUrl` for a website | `{ page: Note, board: Note \| null }` | same | `'limit'` (page full, board note kept), `'gone'` (page note purged, board note kept), `'invalid'` (the board note's `source.url` ≠ the page note's `page.url`) |
| `{ type: 'page-notes/move-to-board', id }` | content script → background | page note id (`typeof id === 'string'` and not empty, else `'invalid'`) | `{ pageId, boardId }` | sender checks (spec 0002); a note on another address answers `'gone'`, like patch and trash do | `{ error: 'day-full' \| 'gone' \| 'invalid' \| 'failed' }` |
| `{ type: 'page-notes/undo-move', pageId, boardId }` | content script → background | both ids (strings, not empty) | `{ ok: true }` | sender checks; the page note's `page.url` equals the sender's page; the board note is trashed only when its `source.url` matches too | `{ error: 'limit' \| 'gone' \| 'invalid' \| 'failed' }` |
| `moveToBoard(id)` / Undo | `StickyBoardContext`, used by the Pages drawer | page note id | toast with Undo | the new tab page | toasts for `day-full`, `gone`, failure |

Both new requests join the `PageRequest` union in `src/lib/pageMessages.ts`, with a `MoveReply = { pageId: string; boardId: string } | { error: 'day-full' | 'gone' | 'invalid' | 'failed' }`. A `send` that throws (the worker asleep or the extension reloaded) counts as `'failed'`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| move | today's day | `settings.get()` inside `movePageNoteToBoard`, through `resolveTz` and `todayInTz`; never the caller's cached `today` |
| move | free spot | `firstFreeSpot` over today's active board notes, read inside the lock |
| move | link chip text | `hostOf(source.url)`, the existing chip in `NoteCard` |
| move | 50 per day check | `countOnDay(all, today)` and `DAY_NOTE_LIMIT`, read inside the lock |
| page message | where it shows | the moved note's drawn spot (`drawnSpot`), captured when the button is pressed and kept in `PageNotesApp` state with the ids, clamped like notes |
| page or board Undo | which notes to undo | `pageId` and `boardId` kept in the message's state for its 6 seconds |
| drawer toast | the title | the page note's `title`, cut to 60 characters with "…" |
| move | sound | `sound('pop')`, the same as creating a note; Undo plays none |

**Key invariants**:
- A move never leaves both notes active, or neither note present (one `set` call).
- A board note never carries `page`; a page note never shows on the board (`boardNotes` unchanged).
- Moving counts against today's 50 board notes; Undo counts against the page's 50 notes.
- Undo never deletes anything for good: the board note goes to Trash, so text typed into it in the 6 seconds is never lost.
- Undo restores the page note before it trashes the board note, so a failure partway leaves two notes, never zero.
- A tiny window remains: an edit to the page note from another tab, landing between the read and the `set` inside the lock, is overwritten. `notes.patch` doesn't take the lock; this is accepted, as it already is for page Trash.

**On the website** (`PageNotesApp`):
- Not optimistic: while the move runs, the note stays drawn with its buttons disabled. On `day-full`, `gone` or `failed`, it stays and shows the message in its strip (the same place as the page limit message).
- On success, `PageNotesApp` adds `{ pageId, boardId, x, y, key }` to a local `moved` list and removes the note. The message is drawn from that list, never from the note, so a storage update from another tab that removes the note first can't hide it.
- Each move adds its own message. Each one clears after 6 seconds (no pause on hover or focus), on Undo, on an address change (AC-14 of spec 0002), and when the notes are removed (extension reload). Timers are cleared on unmount.
- Focus moves to the message's Undo button. After Undo or the timeout, focus returns to the page.
- Undo shows "Undoing…" while it runs, then removes the message; the restored note comes back through the normal storage update. Errors replace the message text for its remaining time.

**In the Pages drawer** (`StickyBoardContext.moveToBoard`):
- Not optimistic: the row leaves when the write lands. The returned board and page notes go straight into `lastSaved` and the note map, as `restoreNote` does. The storage subscription that follows then changes nothing.
- Undo calls `undoMoveToBoard` and puts the returned notes into the map the same way, so a late subscription event can't bring back stale state.

**Security model**: a website can only name notes on its own address. The background takes the address from `sender.tab`, never from the message, and refuses an id whose `page.url` doesn't match. Undo trashes a board note only when its `source.url` matches that same address, and never deletes it, so a page that guesses ids can at worst send a matching board note to Trash, where it can be restored. The board side runs in the extension's own new tab page. No data leaves the device.

**Critical test scenarios**:
- Happy path: move from a note on a page; the board note has the fields above, and the page note is in Trash and gone from the page. Verifies **AC-1**, **AC-3**, **AC-4**.
- Happy path: move from the Pages drawer, then Undo; both notes are back as they were. Verifies **AC-2**, **AC-5**.
- Failure: today has 50 notes; nothing changes, and the message shows on both surfaces. Verifies **AC-6**.
- Failure: the note was trashed in another tab first. Verifies **AC-7**.
- Failure: the storage write rejects; neither note changes. Verifies **AC-8**.
- Permission: page B asks to move a note pinned on page A, and is refused. Verifies **AC-9**.
- Board guard: after a move, the page note isn't on the board, and the board note shows in search and calendar counts. Verifies **AC-10**.
- Undo when the page filled up in the meantime, and when the page note was emptied from Trash. Verifies **AC-11**.
- Undo after the board note was edited: the board note is in Trash with the edit kept. Undo when the page note was already restored: only the board note goes to Trash. Verifies **AC-5**.
- A second tab removes the note while the move runs: the page message still shows. Verifies **AC-5**.

## Build plan

Tracer Bullet (the scope header's assumed default): first a thin thread end to end from the drawer, then the page surface.

1. **Storage**: add `movePageNoteToBoard` and `undoMoveToBoard` in `src/lib/storage/index.ts` under the `note-create` lock. Build the board note as in the data model table, work out today from settings, and write both notes in one `set`. Undo restores the page note through `restoreNote` first, then trashes the board note. Unit tests cover the mapping (color kept, board only z and spot), day full, gone, wrong address, a failed write leaving both notes unchanged, and every Undo case in AC-5 and AC-11. Satisfies **AC-3**, **AC-6**, **AC-7**, **AC-8**, **AC-10**, **AC-11**.
2. **Drawer thread**: add a **Move to today's board** button to each Pages drawer row, plus a context action that calls step 1 with the board's `today` and shows the toast with Undo (6 s), or the error toasts. Not optimistic, with the returned notes put into the map; the pop sound; the title cut to 60 characters. Component tests. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-12**.
3. **Page thread**: add `page-notes/move-to-board` and `page-notes/undo-move` to `PageRequest` (plus `MoveReply`) and `handlePageRequest`, with id type checks, sender checks and the address check. Add the top bar button on open page notes, the busy state while moving, and the `moved` message list with Undo at the captured spot (6 s each, focus to Undo, `role="status"`, cleared on address change). Day full, gone and failed show in the note. Tests for the handler checks and the page UI. Satisfies **AC-1**, **AC-5**, **AC-6**, **AC-7**, **AC-9**, **AC-11**, **AC-12**.
4. **Verify steps**: add the AC-1 to AC-12 checks to a verify list, including a real Meet style case (pin, close the tab, move from the drawer). Satisfies **AC-1** to **AC-12**.

## Consequences

**Positive**:
- Notes taken on short lived pages (calls, checkouts, previews) can always be rescued and edited.
- The Pages drawer gets a way to clear dead pages without losing the text.
- No schema change, so backups and imports keep working untouched.

**Negative / tradeoffs**:
- Restoring a moved page note from Trash later gives you two notes with the same text; nothing links or merges them.
- Page notes have no due time, so the board note starts without a reminder.
- The page note's size and collapsed state are lost on the board (board notes have a fixed size), and come back only through Undo or Restore.
- Undo lasts 6 seconds; after that, reversing means Restore from Trash plus deleting the board note by hand.
- Each Undo leaves one board note in Trash, which empties itself after 30 days.
- Undo is two writes, not one: a crash between them leaves both notes live (nothing lost).

**Neutral**:
- Spec 0002 needs no change: AC-11 there still holds, since the moved note is a new board note.
- The background now writes board notes from a page request, which only right click capture did before.

## Follow-up

- [ ] No scope row tracks this feature yet; enroll one so the build has a home.
- [ ] Spec 0002's AC-8 still says details hold up to 5,000 characters; the limit is now 10,000 (changed on `feat/ui-redesign`). `/sync` can fix the line.
