# 0004. Move a page note to today's board: rationale

The decision record for [index.md](index.md).

## Context

Spec 0002 made page notes live on their page only: they never show on the day board, and the Pages drawer opens their page in a new tab. That works while the page exists. Some pages don't last. A Google Meet link stops working when the call ends, so notes taken during a call are stored and listed in the Pages drawer, but the only way to read them in full is to open a page that no longer exists. Search shows part of the text, but not the whole note.

The user asked for a way to "save a copy of the note so they can access it in the new tab without it being attached to the link". Chrome gives an extension no way to show its own box when a tab closes, so anything automatic would have to be a Chrome notification after the fact. The user chose buttons only.

Forces: the board has a 50 notes per day limit; board notes and page notes share one storage and one `note-create` lock (the lock that stops two tabs creating notes at the same moment); every write from a website goes through the background worker with sender checks (spec 0002); a page note must never show on the board (spec 0002, AC-11).

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

## Rationale

The problem is a note stranded behind a page that no longer exists. A copy (Option 1) solves reading but leaves the stranded original in the drawer forever and splits edits across two notes. Moving keeps exactly one live note, and Trash plus Undo make the move cheap to reverse, so it needs no confirm dialog. The user chose Move, Undo in the message, today as the day, and buttons only.

Doing the whole move in one storage write, under the same `note-create` lock that already guards the color rule, z order, the page limit and the new day limit, is the cheapest way to make AC-6 and AC-8 hold. The day count and the write happen with no other tab in between, and there's no state where both notes or neither exist. A board note built in the new tab page and a Trash request sent separately would need two locks and a compensating write on failure.

The board note reuses the existing `source` field for its link back, rather than a new `fromPageId` field. That keeps the data model unchanged: import, export, validation and the chip on board notes already handle `source`. Undo doesn't need a stored link either, because the message that offers Undo holds both ids in memory for its 6 seconds.

Undo sends the board note to Trash rather than deleting it for good (a change from the first draft, after the cross check). In the 6 seconds you might start typing in the board note in another tab; a permanent delete would lose that text without warning. Trash reuses an existing safety net, needs no extra rule about whether the board note was edited, and costs only one extra Trash entry.
