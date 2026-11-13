# Architecture

Sticky Board is a Chrome extension (Manifest V3) built with WXT, React, TypeScript and Tailwind. It has three things you can see, plus a background worker. Each one has its own folder, and they share code through `src/shared/` only.

```
src/
├── entrypoints/          Thin WXT entry files: they mount a surface, nothing more
│   ├── background.ts       service worker wiring (menus, alarms, messages)
│   ├── newtab/             the board on every new tab
│   ├── page-notes.content/ the content script for notes on websites
│   └── site-access/        the small Allow window
├── background/           Service worker logic
│   ├── capture.ts          right click "Send selection" and "Save link"
│   ├── reminders.ts        the reminder alarm and notifications
│   └── pageNotes.ts        content script registration and every page note write
├── board/                The new tab board (React app)
│   ├── App.tsx
│   ├── StickyBoardContext.tsx   app state, kept in sync across tabs
│   ├── components/         top bar, notes, editor, drawers, search, welcome
│   ├── hooks/              useFocusTrap, useSiteAccess
│   ├── sounds.ts
│   └── themes.ts
├── pageNotes/            Notes drawn on websites (React app in a shadow root)
├── siteAccess/           The Allow window UI
├── shared/               Used by more than one surface
│   ├── types.ts            the Note, Settings and Meta shapes
│   ├── storage/            the only code that touches chrome.storage
│   ├── notes.ts            colors, layout, tilt and link rules for notes
│   ├── pageNotes.ts        rules for notes pinned on websites
│   ├── siteAccess.ts       which sites the extension may run on
│   ├── messages.ts         messages between pages and the background
│   ├── dates.ts            timezone safe day helpers
│   └── ui/Pin.tsx          the pushpin, drawn on the board and on websites
└── styles/
    ├── app.css             theme tokens and base styles (board and Allow window)
    ├── paper.css           the paper look, shared by every surface
    └── pageNotes.css       notes on websites
tests/                    Every test, mirroring src/
├── setup.ts              a fresh fake browser for each test
└── support/              fakeChrome.ts and note helpers
public/                   icons and theme-boot.js (sets the theme before first paint)
```

## Rules

1. **Imports point one way.** `entrypoints/` mounts a surface. `background/`, `board/`, `pageNotes/` and `siteAccess/` import from `shared/` and never from each other. `shared/` imports from nothing else in `src/`.
2. **Only `shared/storage/` calls `chrome.storage`.** Notes live one per key in `chrome.storage.local` (`note:<id>`), and settings live in `chrome.storage.sync`. Change a note with `notes.patch`, and create one with `createNote` or `createPageNote`. Creates, moves and restores run inside the shared `note-create` lock.
3. **Websites never write storage.** The content script sends a message (`shared/messages.ts`), and `background/pageNotes.ts` checks it and writes. The page address always comes from the sender, never from the message.
4. **Days are `YYYY-MM-DD` strings in the resolved timezone.** Use `todayInTz(resolveTz(settings.timezone))`, never `toISOString()`.
5. **Use the theme tokens** (`bg-panel`, `text-ink`, `border-line`, `bg-accent` and so on), never raw colors, so every theme works. See [`design.md`](../design.md).
6. **Tests live in `tests/`, in the same folder path as the code they cover.** They import source through the `@/` alias (`@/shared/dates`) and run against an in-memory fake of the Chrome APIs.

## Where to put new code

| You're adding | Put it in |
|---|---|
| A board screen, drawer or control | `src/board/components/` |
| A rule more than one surface needs | `src/shared/` |
| Anything that reads or writes storage | `src/shared/storage/` |
| A new background job or menu | `src/background/`, wired up in `src/entrypoints/background.ts` |
| Something drawn on websites | `src/pageNotes/` |
| A test | `tests/`, in the same folder path as the code |
