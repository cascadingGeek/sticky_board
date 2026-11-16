# Architecture

Sticky Board is a Chrome extension (Manifest V3) built with WXT, React, TypeScript and Tailwind. It has three things you can see (the board on every new tab, notes on websites, the small Allow window) and a background worker.

The code is split by **what it knows**, not by where it runs:

- **features/** know the domain: the shapes, the rules, the storage, and the background handlers. No UI.
- **surfaces/** are what the user sees. They compose features into screens.
- **entrypoints/** only mount a surface or wire the worker.
- **components/ui**, **hooks**, **lib** and **utils** know nothing about notes.

```
src/
├── entrypoints/                  WXT bootstrap: mount a surface or wire the worker. Nothing else.
│   ├── background.ts               menus, alarms, messages → feature handlers
│   ├── newtab/                     mounts surfaces/board
│   ├── page-notes.content/         mounts surfaces/page-notes in a shadow root
│   └── site-access/                mounts surfaces/site-access
│
├── surfaces/                     Screens. Compose features, own their layout and UI state.
│   ├── board/                      the new tab board
│   │   ├── App.tsx                   picks loading / error / welcome / board, global keys
│   │   ├── StickyBoardContext.tsx    board state, kept in sync across tabs
│   │   └── components/
│   │       ├── notes/                Board, NoteCard, DraftNote, NoteEditor, CarryOverPrompt
│   │       ├── drawers/              Calendar, Pages, Trash, Settings (+ SitesSection, SiteBadge)
│   │       └── TopBar, SearchBox, WelcomeScreen, Toasts, BoardStates
│   ├── page-notes/                 notes drawn on websites (sealed: shadow root, plain CSS)
│   └── site-access/                the Allow window
│
├── features/                     The domain. Each folder: *.types, *.rules, *.validate, *.storage, *.background
│   ├── notes/                      the Note entity, board and page alike (the core)
│   │   ├── notes.types.ts            Note, Subtask, PageRef, NoteColor
│   │   ├── notes.constants.ts        sizes and limits
│   │   ├── notes.rules.ts            color, stacking, placement, tilt (pure)
│   │   ├── page-notes.rules.ts       page address, size and spot rules (pure)
│   │   ├── notes.validate.ts         parseNote: stored or imported data → clean Note
│   │   └── notes.storage.ts          every note read and write, the locks and save queues
│   ├── settings/                   Settings shape, validation, sync storage, theme labels
│   ├── meta/                       schema version, one time prompts, migrations
│   ├── page-notes/                 the website ↔ background protocol and its handler
│   │   ├── page-notes.messages.ts    message types + sanitizePagePatch
│   │   ├── page-notes.background.ts  checks and writes everything a website asks for
│   │   └── openPage.ts
│   ├── site-access/                which sites we may run on (+ useSiteAccess)
│   ├── backup/                     JSON export and import
│   ├── reminders/                  reminders.background.ts: the alarm and notifications
│   └── capture/                    capture.background.ts: right click "Send selection" / "Save link"
│
├── components/ui/                Domain free UI: Drawer, ConfirmDialog, Pin (+ pinColor)
├── hooks/                        Domain free hooks: useFocusTrap, useScrollLock
├── lib/                          Our plumbing: sounds (Web Audio)
├── utils/                        Pure helpers: dates, url, hash
└── styles/                       app.css (tokens), paper.css (shared paper), pageNotes.css

tests/                            Mirrors src/ (tests/features/notes/… covers src/features/notes/…)
├── setup.ts                        a fresh fake browser for each test
└── support/                        fakeChrome.ts and note helpers
public/                           icons and theme-boot.js (sets the theme before first paint)
```

## Rules

1. **Imports point one way:** `entrypoints → surfaces → features → lib / utils`. ESLint enforces this (`eslint.config.js`):
   - features never import UI (`surfaces`, `components`, `hooks`)
   - `components/ui`, `hooks`, `lib` and `utils` never import `features` or `surfaces`
   - a surface never imports another surface
   - import across folders with `@/`; relative paths (`./x`) only within a folder
2. **Features build on `notes` and `settings`.** The feature graph has no cycles: `settings` is at the bottom, `notes` uses it, and everything else (`meta`, `page-notes`, `backup`, `reminders`, `capture`) uses those two. A new feature must not create a cycle.
3. **Only `*.storage.ts` files call `chrome.storage`.** Notes live one per key in `chrome.storage.local` (`note:<id>`), meta under `meta`, settings in `chrome.storage.sync`. Change a note with `notes.patch`; create one with `createNote` or `createPageNote`. Creates, moves and restores share the `note-create` lock.
4. **Websites never write storage.** The content script sends a message (`page-notes.messages.ts`), and `page-notes.background.ts` checks it and writes. The page address always comes from the sender, never from the message.
5. **Days are `YYYY-MM-DD` strings in the resolved timezone.** Use `todayInTz(resolveTz(settings.timezone))`, never `toISOString()`.
6. **Use the theme tokens** (`bg-panel`, `text-ink`, `border-line`, `bg-accent` and so on), never raw colors. See [`design.md`](../design.md).
7. **Tests mirror `src/`** and import source through `@/`. They run against an in-memory fake of the Chrome APIs.

## File naming inside a feature

| Suffix | Holds | May use |
|---|---|---|
| `.types.ts` | shapes only | nothing |
| `.constants.ts` | limits and sizes | nothing |
| `.rules.ts` | pure functions over the shapes | types, utils |
| `.validate.ts` | untrusted data → clean shape | rules, utils |
| `.storage.ts` | `chrome.storage` reads and writes | everything above |
| `.background.ts` | service worker handlers, wired in `entrypoints/background.ts` | everything above |
| `useX.ts` | a React hook over the feature's data | everything above |

Start flat. Add a file when the feature needs it, not before.

## Where to put new code

| You're adding | Put it in |
|---|---|
| A new kind of data, or rules about it | `src/features/<name>/` |
| Anything that reads or writes storage | that feature's `*.storage.ts` |
| A background job or menu | `src/features/<name>/<name>.background.ts`, wired in `src/entrypoints/background.ts` |
| A board screen, drawer or control | `src/surfaces/board/components/` (`notes/` or `drawers/` when it fits) |
| Something drawn on websites | `src/surfaces/page-notes/` |
| UI or a hook with no domain knowledge | `src/components/ui/` or `src/hooks/` |
| A pure helper | `src/utils/` |
| A test | `tests/`, at the same path as the code |
