# Sticky Board scope

**Product**: a sticky note daily board that lives on Chrome's new tab page.
**Workflow:** Beta (assumed default; change it with `/scope`)
**Approach:** Tracer Bullet (assumed default)

## At a glance

| Feature | Status | Spec |
|---|---|---|
| Chrome extension first release | in-progress | [0001](../specs/0001-chrome-extension-mvp/index.md) |

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
- [ ] Test it: /test chrome extension first release

## Deferred

- Side panel board (from spec 0001)
- Notes pinned to a website URL (needs access to all sites; from spec 0001)
- Optional cloud sync of notes (from spec 0001)
- Rich text and images in notes (from spec 0001)
- Archive (from spec 0001)
- Focus timer and analytics, brought back from git history (from spec 0001)
