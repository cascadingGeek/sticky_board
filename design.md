---
source: design-canvas + extracted-from-code
canvas: https://claude.ai/artifact/5bcJgQXDxKw7QeN4X9eAAT
tokens: src/index.css
character: calm, tactile, paper on a board
---

# Sticky Board design direction

**Character.** A calm corkboard, like Balance: the notes are the only thing you look at. Paper sticky notes with a push pin, a slight tilt and a soft shadow, on a quiet dotted (or cork) board. Handwriting (Caveat) for note titles, Inter for the interface, Space Grotesk for headings.

## Build mandate

- The board is full screen. The only lasting UI is the slim top bar (day with ←/→, then Search, Calendar, Trash, Settings, and the accent "+" button). Never add a sidebar, filter bar or toolbar to the board.
- Every note is 220 × 220 px; long content scrolls inside the note. No size, color, priority or category controls.
- Calendar, Trash and Settings open as drawers from the right (400 px). The note editor is a centered modal. Search opens as a panel under the top bar.
- Dark is the default theme; Light, Midnight, Cork and System must all work. Text placed straight on the board uses `.on-board` so Cork keeps 4.5:1 contrast.

## Where things live

- **Token values**: `src/index.css` (`@theme` plus one `[data-theme]` block per theme). Use the semantic utilities: `bg-panel`, `bg-field`, `bg-raise`, `text-ink`, `text-ink-soft`, `text-ink-faint`, `border-line`, `bg-accent`, `text-accent-ink`, `text-accent-soft`, `bg-accent-wash`, `text-danger`, `bg-scrim`.
- **Paper colors**: `.paper-<color>` classes (8 presets), each with dark ink that passes contrast and its own `--pin` color.
- **Shadows**: `var(--note-shadow)` and `var(--note-shadow-lift)` (dragging).
- **Reference screens**: the design canvas above (board, welcome, carry over, editor, search, calendar, trash, settings, themes, capture).

## Do and don't

- Do use icons from `lucide-react` with an `aria-label` on icon only buttons.
- Do keep touch targets at least 40 px in the top bar and 44 px elsewhere.
- Don't use raw colors in components; add a token to `src/index.css` instead (theme preview swatches are the one exception).
- Don't load anything from the network (fonts are bundled), to keep the "nothing leaves your browser" promise.
