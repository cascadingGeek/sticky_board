# Verify: move a page note to today's board · spec 0004 · updated 2026-11-12
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Before you start: run `npm run build`, then reload Sticky Board in `chrome://extensions` from `.output/chrome-mv3`.

## UI / manual
- [x] On any allowed site, pin a note titled "Call notes" with some details and a checklist where one item is ticked. Press the calendar arrow button in its top bar → the note leaves the page, and "Moved to today's board" with Undo shows where it was → AC-1, AC-5
- [x] Open a new tab → today's board has "Call notes" with the same details, color and done state, the ticked item still ticked, no due time, above the other notes, with the site chip → AC-3, AC-4
- [x] Click the site chip on that board note → the page opens in a new tab → AC-4
- [x] Type in the details and press Move within half a second → the board note has the text you just typed (Value sourcing: latest stored copy) → AC-3
- [x] Move a note again and press Undo within 6 seconds → the note is back at the same spot, size and collapsed state, and the board note is in Trash, not deleted → AC-5
- [x] Move a note and wait → the message disappears after about 6 seconds; with the keyboard only, Undo has focus right after the move → AC-5, AC-12
- [x] Google Meet: pin a note during a call, end the call and close the tab. On the new tab page, open Notes on web pages and press "Move Call notes to today's board" → the toast "“Call notes” moved to today's board" with Undo shows, the row leaves the drawer, and the note is on today's board → AC-2, AC-5
- [x] In the drawer toast, press Undo → the row is back in the drawer and the board note is in Trash → AC-5
- [x] Fill today with 50 notes, then press Move on a page note and in the drawer → nothing moves, and both places show "This day already has 50 notes, the most a day can hold. Finish or remove one to add another." → AC-6
- [x] Open the same page in two tabs, move the note in tab A, then press Move in tab B before it updates → "This note was already moved or deleted." → AC-7
- [x] Set Settings > Time zone to a zone where it is already tomorrow (or yesterday), then move a note → it lands on that zone's today (Value sourcing: today from settings at click time) → AC-3
- [x] After a move, check that the page note never shows on the board, and the board note shows in search, the calendar count and the carry over prompt the next day → AC-10
- [x] Move a note, add notes until that page has 50, then press Undo → "This page already has 50 notes.", and the board note stays on the board → AC-11
- [x] Use a screen reader or the accessibility tree: both buttons read "Move <title> to today's board", and the page message is announced → AC-12

## Commands
- [x] `npx vitest run src/lib/moveToBoard.test.ts src/lib/pageAccess.test.ts src/components/pageNotesBoard.test.tsx src/pageNotes/PageNotesApp.test.tsx` → all pass → AC-1 to AC-12
- [x] `npx tsc --noEmit -p . && npx eslint src` → no errors

## Acceptance-criteria coverage
- AC-1: steps 1 and 4 · AC-2: step 7 · AC-3: steps 2, 4 and 11 · AC-4: steps 2 and 3 · AC-5: steps 1, 5, 6, 7 and 8 · AC-6: step 9 · AC-7: step 10 · AC-8: covered by the unit test "leaves both notes as they were when the write fails" (a failed write can't be forced by hand) · AC-9: covered by the handler test "refuses one from another page" (needs a crafted message) · AC-10: step 12 · AC-11: step 13 · AC-12: steps 6 and 14
