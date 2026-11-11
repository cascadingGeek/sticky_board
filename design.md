---
source: design-canvas + extracted-from-code
canvas: https://claude.ai/artifact/6YWUQSwVqvQTs2E6XsfBye
tokens: src/index.css
paper: src/styles/paper.css
character: calm, tactile, real paper notes pinned to a wall
---

# Sticky Board design direction

**Character.** Real paper sticky notes on a quiet wall: the notes are the only thing you look at. Each note has a glossy pushpin, a glue band across the top, soft lifted shadows with a curled edge, a fine grain and a slight tilt. Caveat Brush handwriting on the notes, Inter for the interface, Inter Bold for every heading. Spec 0003 (`docs/specs/0003-realistic-notes-redesign/`) is the source for every value.

## Build mandate

- The board is full screen. The only lasting UI is the slim 64 px top bar (day with ←/→ and a "Today · N notes" subtitle, then Search, Calendar, Notes on web pages, Trash, Settings, and the primary "New note" button). Never add a sidebar, filter bar or toolbar to the board.
- Every note is 220 × 220 px; long content scrolls inside the note. No size, color, priority or category controls. Pin colour and tilt come from the note id, so a note looks the same everywhere.
- Calendar, Trash, Settings and Pages open as 440 px drawers from the right. The note editor is a centered paper sheet that saves as you type (status text plus Done). Search (⌘K) is a centered panel over a dimmed board.
- Light ("Wall") is the default theme; Dark, Midnight, Cork and System must all work. Text placed straight on the board sits on `.board-backing` so Cork keeps 4.5:1 contrast.
- Notes on websites use the same paper, always in Light values, inside a closed shadow root. Their handwriting is the bundled Caveat Brush Latin subset, registered as `SB Hand` through the FontFace API (`src/pageNotes/font.ts`).

## Where things live

- **Interface tokens**: `src/index.css` (`@theme` holds Light, plus one `[data-theme]` block per theme). Use the semantic utilities: `bg-panel`, `bg-field`, `bg-raise`, `bg-hover`, `text-ink`, `text-ink-soft`, `text-ink-faint`, `border-line`, `bg-accent`, `text-accent-ink`, `bg-accent-wash`, `text-danger`, `bg-danger-wash`, `bg-warn-wash`, `bg-ok-wash`, `bg-mark`, `bg-kbd`, `bg-scrim`, `shadow-panel`, `shadow-pop`, `shadow-toast`.
- **Paper**: `src/styles/paper.css`, plain CSS shared by the board and the content script. A note is `.paper-note.paper-<color>` (the shell with the curls) holding `.paper` (the sheet: colour, glue band, sheen, shadow, grain). `.paper-swatch` gives a flat square of the colour. Text classes: `.note-title`, `.note-text`, `.note-row-title` (list rows), `.editor-title`, `.editor-text`; each has a `.no-handwriting` size.
- **Pins**: the `Pin` component (`src/components/Pin.tsx`), colour from `pinFor(id)`; tilt from `tiltFor(id)` in `src/lib/board.ts`.
- **Shadows**: `--note-drop` and `--note-drop-lift` (dragging and drafts), deeper on Dark, Midnight and Cork.
- **Reference screens**: the design canvas above (37 boards, light and dark).

## Do and don't

- Do use icons from `lucide-react` with an `aria-label` on icon only buttons.
- Do keep touch targets at least 44 px.
- Do put new CSS that must beat utilities inside `@layer base`; unlayered rules in `index.css` and `paper.css` override every Tailwind utility.
- Don't use raw colors in components; add a token to `src/index.css` or a variable to `src/styles/paper.css` instead (theme preview swatches are the one exception).
- Don't load anything from the network (fonts are bundled), to keep the "nothing leaves your browser" promise.
