# Page notes (notes on websites)

## Overview

The React app the content script draws on websites. It runs inside other people's pages, so it is sealed off from them: a closed shadow root, plain CSS, and no direct storage writes.

## Key files

| File | Owns |
|---|---|
| `PageNotesApp.tsx` | Every note for the current address, the draft, moves to the board and their messages |
| `PageNote.tsx` | One note: drag, resize, collapse, edit, saving 500 ms after typing stops |
| `PageDraft.tsx` | A new note that exists only on the page until it has a title |
| `MovedMessage.tsx` | "Moved to today's board" with Undo, shown for 6 seconds |
| `bridge.ts` | Events from the content script entry (messages, address changes, right clicks) to React |
| `font.ts` | Caveat Brush inlined as a data URL and registered as `SB Hand` |
| `@/entrypoints/page-notes.content/index.tsx` | Mounts the app in the shadow root and handles focus and extension reloads |
| `@/styles/pageNotes.css` | All styling for this area |

## Conventions

- Styling is plain CSS in `src/styles/pageNotes.css` (plus the shared `paper.css`). No Tailwind here, and sizes are px, never rem, because rem follows the site's font size.
- Notes always use the Light paper values, whatever the board theme.
- Read notes with `notes.getAll()` / `notes.subscribe()`. Every write is a message (`src/features/page-notes/page-notes.messages.ts`) answered by `src/features/page-notes/page-notes.background.ts`.
- A move is not optimistic: the note stays, with buttons disabled, until the background answers.

## Gotchas

- The script is not in the manifest. The background registers it for allowed sites and injects it on demand, so it may run twice in one tab. A shared global keeps only the newest copy.
- After the extension updates or reloads, the old copy can't save. It detects the invalid context and removes its notes.
- Chat sites (ChatGPT, Claude) catch keys and pastes in capture listeners. While focus is in a note the host is marked editable, and focus taken away is handed back.
- `crypto.randomUUID` only exists on https pages; `ids.ts` has the http fallback.
- The address can change before a reply arrives (single page apps). Check `urlRef.current` before showing a message for an old address.

## Related specs

- [0002 pin notes on websites](../../../docs/specs/0002-pin-notes-on-websites/index.md)
- [0004 move a page note to today's board](../../../docs/specs/0004-move-page-note-board/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
