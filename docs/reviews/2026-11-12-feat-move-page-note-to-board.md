# Review, feat/move-page-note-to-board, 2026-11-12

**Reviewed by**: Sonnet 5.5 (author on opus)
**Scope**: 18 files, uncommitted (spec 0004 only; commit 3e5cf59 for spec 0003 is out of scope)
**Verdict**: Approve with nits

## Summary
The move and undo logic matches the spec closely. Both notes are written in one `chrome.storage.local.set` inside the `note-create` lock, the page address comes from the sender, and the undo order (restore the page note first, then trash the board note) can never leave zero notes. I found no blockers or majors. The findings below are small edge cases and wording.

## Minor

### 🟡 Double click in the Pages drawer can show a false error, `src/lib/StickyBoardContext.tsx:363`
**Problem**: `moveToBoard` has no in-flight guard. The drawer button is never disabled, so a fast double click sends two moves. The first works, the second answers `'gone'` and shows the error toast "This note was already moved or deleted." right next to the success toast.
**Why it matters**: The user sees an error for an action that worked. The website side avoids this by disabling the buttons while the move runs.
**Suggested fix**: Keep a set of ids being moved in the context (or disable the drawer button while its move runs) and ignore a second press for the same id.

### 🟡 A message can appear after the address changed, `src/pageNotes/PageNotesApp.tsx:238`
**Problem**: The `navigate` handler clears `notices`, but a move still waiting on the background calls `addNotice` when it finishes. On a single page app that navigated in between, the "Moved" message (or the "already moved" notice) shows on the new page at the old note's spot.
**Why it matters**: Spec 0002 AC-14 and spec 0004 say messages clear on an address change. Rare, but it breaks that rule, and Undo would still work from the wrong page view.
**Suggested fix**: Remember the address when the move starts and skip `addNotice` if it has changed by the time the reply arrives.

### 🟡 Wrong undo wording for an invalid pair, `src/lib/StickyBoardContext.tsx:352` and `src/pageNotes/PageNotesApp.tsx:262`
**Problem**: Undo answers `'invalid'` when the board note's `source.url` does not match the page note. Both the drawer and the page show "the page note is no longer in Trash" for it, which is not what happened.
**Why it matters**: Misleading text if it ever occurs (it should not in normal use). Low risk.
**Suggested fix**: Give `'invalid'` the generic "Couldn't undo. Please try again." text, or a short line of its own.

### 🟡 A timeout during a running Undo hides its result, `src/pageNotes/MovedMessage.tsx:34`
**Problem**: The 6 second timer is not paused while Undo is running. If Undo is slow (the worker waking up) and the timer fires first, the message closes and a later error from Undo is never seen. A success still works, since the notes come back through storage.
**Why it matters**: A failed Undo can pass silently in a slow case. Small.
**Suggested fix**: Do not start closing the message while `undoing` is true, or restart the timer after an Undo error.

## Nits
- ⚪ `src/pageNotes/style.css:262`, the message still visually covers the top of the next stacked note for 6 seconds (clicks pass through, but the buttons are hidden). Known from verify; consider placing it beside the note instead.
- ⚪ `src/lib/storage/index.ts:284`, undo restores with `notes.patch` plus its own limit check, while the spec says it goes through `restoreNote`. The behavior is the same, but the two limit checks can drift; a one line comment saying why would help.

## Strengths
- One atomic `set` for the move, with the lock, the settings based "today", and the wait for queued saves so the board note gets the latest text.
- The security model is tested and sound: address from the sender, id type checks, mismatched pages answer `'gone'`, and undo only touches a board note whose `source.url` matches.
- The message list is held separately from the notes, so a removal from another tab cannot hide it, and the pointer events fix keeps the next note usable.

## Test coverage
Good. `moveToBoard.test.ts` covers the field mapping, the time zone, day full, gone cases, a failed write leaving both notes unchanged, the queued save wait, and every undo case in AC-5 and AC-11, including the other site refusal. The handler tests cover sender, frame and id checks. The drawer, page app and `MovedMessage` have tests for success, failures, the 6 second clear, focus, and address change. Gaps tied to the minors above: no test for a double press in the drawer, for a move finishing after an address change, or for a timeout landing during a running Undo. The two flaky tests you mentioned are unrelated to this change.
