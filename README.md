# Sticky Board

Sticky Board is a Chrome extension that turns every new tab into a board of today's sticky notes. You can also pin notes on any website, so a thought stays next to the page it belongs to.

Everything stays in your browser. There's no account, no server and no tracking. Only your settings follow you to other computers through Chrome sync.

## How it works

- **Open a new tab** and you see today's board: paper notes pinned to a wall, which you can drag anywhere.
- **Add a note** with `N` or the New note button. Type a title and press Enter. Open a note to add details, a checklist, a due time or a reminder. It saves as you type.
- **Each morning**, unfinished notes from your last active day are offered as copies, so nothing slips.
- **On a website**, right click and choose **Pin a note here**, or press `Alt+Shift+N`. Chrome asks for access to that one site only, the first time you pin there. The note comes back whenever you revisit the page.
- **Move a page note to today's board** when it becomes a task for today. Undo is there for a few seconds if you change your mind.

## Features

- **Daily board**: same size notes you drag anywhere. Colors are picked for you, and a day holds up to 50 notes.
- **Notes on websites**: pin, move, resize, collapse and edit notes on any page, up to 50 per page. Every site's notes are listed in the Pages drawer.
- **Right click capture**: **Send selection to Sticky Board** and **Save link to Sticky Board** add a note to today's board.
- **Reminders**: turn on Remind for a note with a due time to get a Chrome notification.
- **Search** across every day and every website note. `⌘K` / `Ctrl+K` also lists commands.
- **Calendar, Pages, Trash and Settings** open as drawers from the top bar. Trash keeps notes for 30 days.
- **Themes**: Light (default), Dark, Midnight, Cork, or follow your system. Handwriting on notes can be turned off.
- **Backups**: download a JSON backup and import it again. Importing merges, and the newer copy of a note wins.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New note |
| `←` / `→` | Previous or next day |
| `T` | Back to today |
| `⌘K` / `Ctrl+K` | Search and commands |
| `Alt+Shift+S` | Open the board from anywhere |
| `Alt+Shift+N` | Pin a note on the current page |

You can change the two `Alt+Shift` shortcuts at `chrome://extensions/shortcuts`.

## Getting started

You need Node.js 20 or newer.

```bash
npm install
npm run dev     # opens Chrome with the extension loaded and hot reload
npm test        # runs the test suite
npm run lint    # ESLint and the type check
npm run build   # production build in .output/chrome-mv3
npm run zip     # store ready zip in .output/
```

To try a production build by hand, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and pick `.output/chrome-mv3`.

## Docs

- [`docs/architecture.md`](docs/architecture.md): how the code is laid out, and where new code goes
- [`docs/scope/scope.md`](docs/scope/scope.md): what's built and what's next
- [`docs/specs/`](docs/specs/): the design of each feature
- [`design.md`](design.md): the visual design rules
