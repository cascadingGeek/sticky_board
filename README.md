# Sticky Board

A Chrome extension that puts today's sticky notes on every new tab. Drag notes anywhere, carry unfinished ones into tomorrow, get reminders, and send text or links to your board from any website. Everything stays in your browser: no account, no server, no tracking.

## Features

- **New tab board**: today's notes as same size (220 × 220) sticky notes you drag anywhere. Long notes scroll inside themselves. Colors are picked for you.
- **Quick notes**: press `N` or `+`, type a title, press Enter. Double click a note for details, a checklist, a day, and a due time.
- **Carry over**: each morning, unfinished notes from your last active day are offered as copies.
- **Search** across every day (`⌘K` / `Ctrl+K` also lists commands).
- **Calendar, Trash, Settings** in drawers from the top bar. Trash keeps notes for 30 days.
- **Themes**: Dark (default), Light, Midnight, Cork, or follow your system.
- **Right click capture**: "Send selection to Sticky Board" and "Save link to Sticky Board".
- **Reminders**: turn on Remind for a note with a due time to get a Chrome notification.
- **Backups**: download a JSON backup and import it again (merges, newest wins).
- **Shortcuts**: `N` new note, `←`/`→` change day, `T` today, `Alt+Shift+S` open the board from anywhere.

## Development

```bash
npm install
npm run dev     # WXT dev mode: opens Chrome with the extension loaded and hot reload
npm run build   # typecheck + production build in .output/chrome-mv3
npm run zip     # store ready zip in .output/
npm run lint    # ESLint + typecheck
```

To try a production build by hand: open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick `.output/chrome-mv3`.

## How it is built

| Layer | Choice |
|---|---|
| Extension | Manifest V3, built with [WXT](https://wxt.dev) |
| UI | React 19, TypeScript (strict), Tailwind CSS v4, lucide icons, fonts bundled with `@fontsource` |
| Data | `chrome.storage.local` (one key per note, `note:<id>`), `chrome.storage.sync` for settings |
| Background | One service worker: context menus, a single reminder alarm, daily trash purge |

```
src/
├── entrypoints/
│   ├── newtab/        # the new tab page (index.html + main.tsx)
│   └── background.ts  # service worker
├── lib/
│   ├── storage/       # ⭐ the only code that touches chrome.storage
│   ├── StickyBoardContext.tsx  # app state, optimistic saves, live sync across tabs
│   ├── board.ts       # color rule, first free spot, stacking, links
│   ├── dates.ts       # timezone safe day helpers
│   ├── reminders.ts   # the reminder check (background)
│   └── capture.ts     # right click capture (background)
├── components/        # TopBar, Board, NoteCard, drawers, editor, search, welcome
└── index.css          # theme tokens ([data-theme] on <html>)
public/                # icons + theme-boot.js (sets the theme before first paint)
```

Rules worth knowing:

1. **Only `src/lib/storage/` calls `chrome.storage`.** Change notes with `notes.patch` (it merges fields into the latest stored copy), create them with `createNote` (it picks the color and stacking order inside a shared lock).
2. **Days are `YYYY-MM-DD` strings in the resolved timezone.** Use `todayInTz(resolveTz(settings.timezone))`, never `toISOString()`.
3. **Use the theme tokens** (`bg-panel`, `text-ink`, `border-line`, `bg-accent`, …), not raw colors, so every theme works.

The full design lives in [`docs/specs/0001-chrome-extension-mvp/`](docs/specs/0001-chrome-extension-mvp/index.md).
