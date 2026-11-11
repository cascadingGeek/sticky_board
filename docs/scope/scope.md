# Sticky Board scope

**Product**: a sticky note daily board that lives on Chrome's new tab page.
**Workflow:** Beta (assumed default; change it with `/scope`)
**Approach:** Tracer Bullet (assumed default)

## At a glance

| Feature | Status | Spec |
|---|---|---|
| Chrome extension first release | in-progress | [0001](../specs/0001-chrome-extension-mvp/index.md) |
| Pin notes on websites | in-progress | [0002](../specs/0002-pin-notes-on-websites/index.md) |
| Realistic notes redesign | in-progress | [0003](../specs/0003-realistic-notes-redesign/index.md) |
| Move a page note to today's board | in-progress | [0004](../specs/0004-move-page-note-board.md) |

## Chrome extension first release · in-progress

Turn the web app into a local first Chrome extension: today's freeform board on every new tab, themes (dark by default), search, trash, backups, right click capture and due time reminders. No login, no server, no tracking.

Done when: the production zip installs with only the "Display notifications" warning and AC-1 to AC-21 in spec 0001 pass.

Spec: [0001](../specs/0001-chrome-extension-mvp/index.md) · code in `src/` (WXT extension: `src/entrypoints/`, storage in `src/lib/storage/`)

- [x] Design it (spec)
- [x] Build it: /develop chrome extension first release
  - [x] Foundation: WXT move, storage layer with live updates across tabs, settings and themes, top bar and drawers, unused code deleted (AC-1, AC-2, AC-3, AC-6, AC-7, AC-9, AC-15)
  - [x] Board experience: welcome screen, fixed size draggable notes, blank note creation with random colors, carry over and midnight rollover, search (AC-8, AC-10, AC-11, AC-12, AC-13, AC-14)
  - [x] Data safety: trash with restore and purge, export and import (AC-4, AC-5)
  - [x] Background: right click capture, reminders, toolbar icon and shortcut, store ready zip (AC-16, AC-17, AC-18, AC-19, AC-20, AC-21)
- [ ] Verify it: /check verify chrome extension first release
- [x] Test it: /test chrome extension first release

## Pin notes on websites · in-progress

Pin sticky notes on any web page, so a thought stays next to the page it belongs to. Notes come back when you revisit the page, and they live in the same storage as board notes, so search, Trash and backups cover them.

Done when: you can pin a note on a page by right click or a shortcut, move, resize, edit and delete it, see it again on revisit and after a browser restart, and the install warning stays "Display notifications" (website access is asked for one site at a time, only after you pin a note there).

Spec: [0002](../specs/0002-pin-notes-on-websites/index.md) · code in `src/pageNotes/` (on page UI), `src/entrypoints/page-notes.content/`, `src/entrypoints/site-access/`, `src/lib/pageNotes.ts`, `src/lib/pageAccess.ts`

- [x] Design it (spec): /architect pin notes on websites
- [x] Build it: /develop pin notes on websites
  - [x] Data and board guard: page fields, address matching, page notes kept off the day board (AC-6, AC-11, AC-13)
  - [x] First note on a real page and coming back: right click pin, sealed note UI, Allow window, notes return on revisit (AC-1, AC-2, AC-4, AC-5, AC-15, AC-20)
  - [x] Shortcut, 50 note limit, blocked pages (AC-3, AC-17, AC-18, AC-19)
  - [x] Full note and board side: drag, resize, edit, collapse, Trash, live updates, address changes, Pages drawer, search, Settings sites list (AC-7 to AC-12, AC-14, AC-16)
- [ ] Verify it: /check verify pin notes on websites
- [ ] Test it: /test pin notes on websites

## Realistic notes redesign · in-progress

Give every surface the new realistic paper look from the "Realistic Sticky Board" canvas: notes with a pushpin, glue strip, lifted shadows and grain, Caveat Brush handwriting, a light Wall default, and matching Dark, Midnight and Cork themes. The board, editor, drawers, search, onboarding, messages and notes on websites all change; behaviour and stored data do not.

Done when: every board in the canvas matches in all five themes, existing users who never picked a theme stay on Dark, and AC-1 to AC-26 in spec 0003 pass.

Spec: [0003](../specs/0003-realistic-notes-redesign/index.md) · code in `src/index.css`, new `src/styles/paper.css`, `src/components/`, `src/pageNotes/`

- [x] Design it (spec): /architect realistic notes redesign
- [x] Build it: /develop realistic notes redesign
  - [x] Paper note thread: shared paper CSS, pins, tilt, Caveat Brush, Light default and the one time theme check (AC-1 to AC-8, AC-10)
  - [x] Board and dialogs: top bar, chips and time format, draft, states, paper editor that saves as you type, carry over, toasts, onboarding (AC-9, AC-11 to AC-14, AC-17 to AC-19, AC-27)
  - [x] Drawers, search and themes: 440 px drawers, search, Dark, Midnight, Cork, System, contrast (AC-15, AC-16, AC-20 to AC-22)
  - [x] Notes on websites and cleanup: paper and bundled font on websites, Allow window, package cleanup, design.md, tests (AC-23 to AC-26)
- [ ] Verify it: /check verify realistic notes redesign
- [ ] Test it: /test realistic notes redesign

## Move a page note to today's board · in-progress

Rescue a note pinned on a website whose page is gone (a finished Google Meet call): one button on the note or in the Pages drawer moves it to today's board as an ordinary board note with a link back to the site, sends the page note to Trash, and offers Undo for 6 seconds.

Done when: a note pinned in a call can be moved from the Pages drawer after the tab is closed and read and edited on today's board, the 50 notes a day limit is respected, Undo restores the page note, and AC-1 to AC-12 in spec 0004 pass.

Spec: [0004](../specs/0004-move-page-note-board.md) · code in `src/lib/storage/`, `src/lib/pageAccess.ts`, `src/lib/pageMessages.ts`, `src/components/PagesDrawer.tsx`, `src/pageNotes/`

- [x] Design it (spec): /architect copy page note to board
- [ ] Build it: /develop move a page note to today's board
  - [ ] Storage move and Undo under the shared lock, in one write, with today from settings (AC-3, AC-6, AC-7, AC-8, AC-10, AC-11)
  - [ ] Pages drawer button with toast and Undo (AC-2, AC-4, AC-5, AC-12)
  - [ ] Button on the note on a website, page messages and the on page message with Undo (AC-1, AC-5, AC-6, AC-7, AC-9, AC-11, AC-12)
- [ ] Verify it: /check verify move a page note to today's board
- [ ] Test it: /test move a page note to today's board

## Deferred

- Side panel board (from spec 0001)
- Optional cloud sync of notes (from spec 0001)
- Page notes fixed to the window ("pin on screen") (from spec 0002)
- Color filters in the Pages drawer (from spec 0002)
- Rich text and images in notes (from spec 0001)
- Archive (from spec 0001)
- Focus timer and analytics, brought back from git history (from spec 0001)
