# Sticky Board scope

**Product**: a sticky note daily board that lives on Chrome's new tab page.
**Workflow:** Beta (assumed default; change it with `/scope`)
**Approach:** Tracer Bullet (assumed default)

## At a glance

| Feature | Status | Spec |
|---|---|---|
| Chrome extension first release | in-progress | [0001](../specs/0001-chrome-extension-mvp/index.md) |
| Pin notes on websites | in-progress | [0002](../specs/0002-pin-notes-on-websites/index.md) |

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

Spec: [0002](../specs/0002-pin-notes-on-websites/index.md)

- [x] Design it (spec): /architect pin notes on websites
- [ ] Build it: /develop pin notes on websites
  - [ ] Data and board guard: page fields, address matching, page notes kept off the day board (AC-6, AC-11, AC-13)
  - [ ] First note on a real page and coming back: right click pin, sealed note UI, Allow window, notes return on revisit (AC-1, AC-2, AC-4, AC-5, AC-15, AC-20)
  - [ ] Shortcut, 50 note limit, blocked pages (AC-3, AC-17, AC-18, AC-19)
  - [ ] Full note and board side: drag, resize, edit, collapse, Trash, live updates, address changes, Pages drawer, search, Settings sites list (AC-7 to AC-12, AC-14, AC-16)
- [ ] Verify it: /check verify pin notes on websites
- [ ] Test it: /test pin notes on websites

## Deferred

- Side panel board (from spec 0001)
- Optional cloud sync of notes (from spec 0001)
- Page notes fixed to the window ("pin on screen") (from spec 0002)
- Color filters in the Pages drawer (from spec 0002)
- Rich text and images in notes (from spec 0001)
- Archive (from spec 0001)
- Focus timer and analytics, brought back from git history (from spec 0001)
