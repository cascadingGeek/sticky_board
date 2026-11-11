# 0003. The new tab board

## Summary

Every new tab opens today's board: a clean, full screen corkboard of same size sticky notes you can drag anywhere, in the dark theme unless you pick another. The only controls are a slim top bar with the date and a few icons; Calendar, Trash and Settings slide in as drawers from the right. A "+" pins a blank note you type straight into, its color picked for you, and long notes scroll inside themselves. Unfinished notes from your last active day are offered as copies each morning, and search finds any note across all days.

## Requirements

**User stories**
- As a busy person, I want today's notes on every new tab so that my priorities are always in front of me.
- As someone who likes things simple, I want a calm board with almost no controls so that the notes are the only thing I look at.
- As a returning user, I want yesterday's unfinished work offered to me so that a fresh day doesn't lose anything.
- As someone with many notes, I want to search all days at once so that I can find anything quickly.

**Acceptance criteria**
- **AC-7**: Opening a new tab shows today's board (today in the settings timezone) in the dark theme by default, with no login and no network requests (the DevTools Network panel shows only `chrome-extension://` requests).
- **AC-8**: The first new tab after install shows a welcome screen with a theme picker and a live preview, Dark preselected. "Start my board" or "Skip" lands on today's empty board with an empty state hint, and the welcome screen never shows again (`meta.onboardedAt` set).
- **AC-9**: Settings offers Dark, Light, Midnight, Cork and System. System follows the OS light or dark setting live, without a reload. Opening a new tab never flashes a different theme first.
- **AC-10**: Every note is the same size, 220 × 220 px. A note can be dragged from anywhere on its body (except its checkbox, a link, or text being edited) to any spot on the board, and its position persists. The note being dragged sits on top of the others. When the window is narrower than a stored position, the note is drawn inside the visible area without changing its stored position.
- **AC-11**: When a note's content is longer than the note, it scrolls inside the note (mouse wheel or trackpad) without moving the note or changing its size. `http` and `https` URLs in the details open in a new tab. A captured note shows its source page as a link.
- **AC-12**: Clicking "+" (or pressing N) pins a blank note at the first free spot on the board with the cursor in its title. Typing and then pressing Enter or clicking away saves it; leaving the title empty discards it. Its color is picked at random from the 8 paper colors, never the same as the most recently created note's color. Double clicking a note opens the editor, which has exactly Title, Details, Checklist, Day, and Due time with a Remind toggle (no color, size, priority or category).
- **AC-13**: On the first board open of a new day, if the most recent earlier day that has active notes contains unfinished notes that have not been carried yet, a prompt lists them. "Carry all" or "Carry selected" creates copies on today (new `id`, `carriedFromId` set, same position, subtasks with their completion kept), and tags each original "Carried over" (`carriedToDate` = today). "Not today" hides the prompt until tomorrow. The prompt shows at most once per day, even with several tabs open. A board left open past midnight switches to the new day on its own (if it was showing today) and runs this check.
- **AC-14**: The search icon (or ⌘K) opens a search box. Search matches title, details, checklist items and source title across all days, case insensitively, ignoring Trash and carried over originals. Clicking a result opens that note's day and highlights the note.
- **AC-15**: The only lasting UI is a slim top bar: the day name and date with ← and → buttons (plus a "Today" button when another day is shown), and icon buttons for Search, Calendar, Trash, Settings and New note, each with an accessible name and a tooltip. Calendar, Trash and Settings each open as a drawer from the right, one at a time; Esc, the close button, or a click outside closes it and returns focus to its icon. Clicking a calendar day closes the drawer and shows that day. The Settings drawer holds exactly: theme, handwriting font, sounds, time zone, week start, Your data (backup, import, uninstall warning), and the shortcut and privacy notes. The ⌘K palette and the N, ←, →, T and Esc keys work. No sidebar, filters, quick add box, Tidy button, landing page, login, grid layout, focus, analytics or AI briefing exists, and their code is deleted.

## Decision

Keep the current React app as the new tab page, rewired onto the storage layer (0002), stripped down to a full screen freeform board with a slim top bar; Calendar, Trash and Settings move into drawers.

## Design

**Screen layout**
- **Top bar** (height 64 px, transparent over the board, no border): left, the day name in the display font plus the date in smaller text, with ← and → icon buttons and a "Today" chip when not on today. Right, icon buttons in this order: Search, Calendar, Trash (with a small count when not empty), Settings, then New note ("+", the one accent filled button). Each icon button is at least 40 × 40 px.
- **Board**: everything below the top bar, the theme's board background (dot grid, or the cork texture). It scrolls vertically when notes sit lower than the window; its height is the lowest note bottom plus 240 px, at least the window height.
- **Drawers**: 400 px wide from the right (full width below 480 px), over a light dim of the board, with a title and a close button. Calendar (month grid with per day density, and the ← and → month buttons), Trash (the list from 0002 with Restore, Delete forever, Empty trash), Settings (sections listed in AC-15). Opening one closes any other.
- **Note editor**: a centered modal (it edits one note; a drawer would hide the board context it came from). Fields per AC-12, plus "Move to Trash", "Cancel" and "Save".

**Note card** (fixed 220 × 220 px)
- Paper color from `noteColor`, a push pin at the top center, slight random tilt (between −2° and 2°, derived from the note id so it is stable).
- The card has two layers: a fixed frame (pin, and on hover or focus a complete checkbox top left, an edit button and a delete icon top right) and inside it a scroll area (`overflow-y: auto`, thin scrollbar) holding, in order: title (handwriting font when enabled), details, checklist, then a footer row with due time, bell when `remind` is on, "Carried from <day>" when `carriedFromId` is set, and the source link (label `source.title`, else the URL's host, one line with an ellipsis). The frame icons never scroll away.
- Completed notes fade to 60% opacity with the title struck through.
- Links: `https?://\S+` in the details, with trailing `. , ; : ! ? ) ]` left out of the link.
- Drag: pointer down on the card body starts a drag after 4 px of movement, using pointer capture. It never starts from the checkbox, edit or delete icons, a link, a checklist box, a title being typed, or the scrollbar gutter (pointer x beyond the scroll area's `clientWidth`). The body uses `user-select: none` and `touch-action: none` while not editing. Esc or window blur cancels a drag and puts the note back. While dragging the note sits on top. The note can't go above the board's top (y ≥ 0) or past its right edge (x between 0 and board width − 236), and there is no snapping. Dropping saves `positionX`, `positionY` and a new `z` in one `notes.patch`. Dragging a note that was clamped into view saves the drawn position (the old, larger stored x is replaced; intended).
- Keyboard: each card is focusable (`tabindex="0"`, labelled by its title). Enter opens the editor, Delete or Backspace moves it to Trash, Alt plus an arrow key moves it 24 px (saved when the key is released, with a new `z`).
- Stacking: notes render in ascending `z`. Only creating or moving a note gives it `z` = the highest `z` on that day + 1. Ticking a box, editing text, or the background's `remindedAt` write never changes stacking.

**Creating a note** (the "draft" is a blank note that exists only on screen until saved)
1. "+" or N creates a draft at the first free spot and focuses its title. If a draft already exists: an empty one just gets focus again; one with a title is saved first, then a new draft starts.
2. The draft is saved (`notes.create`) when its title has text and the user presses Enter, clicks anywhere else, switches day, opens a drawer, search or ⌘K, or midnight passes. It is saved to the day it was created on, never moved to another day. Titles are trimmed; empty or spaces only means the draft disappears. Esc discards the draft. The title input has `maxLength` 200.
3. Fields written on save: `id`, `title`, `description` `''`, `isCompleted` false, `dateStr` = the draft's day, `noteColor` (rule below), `subtasks` [], `remind` false, no `dueTime`, `positionX`/`positionY` from the draft, `z`, and `createdAt` = `updatedAt` = save time.
4. If the save fails, the draft stays on screen with its text and an error toast, so nothing typed is lost.
5. Shift+Enter in the title moves the cursor into the details. Full editing (checklist, day, time) is via double click, Enter on a focused note, or the edit button.

**Random color rule**: chosen at save time, inside a `navigator.locks` lock named `note-create` that the page, every other tab and the background worker all use for any note creation. Pick uniformly from the 8 presets, excluding the `noteColor` of the "latest note": the note with the greatest `createdAt` among notes without `carriedFromId` (ties broken by the greater `id`). No such note means all 8 are allowed. The draft shows a provisional color, which may change once at save if another tab created a note meanwhile. The color is saved on the note and never changes. Carried copies keep the original's color.

**First free spot**: uses the part of the board on screen at that moment (the board's `scrollTop` and visible width; a minimum width of 268 px is assumed). Scan 220 px cells with 24 px gaps, left to right then top to bottom, starting 24 px inside the visible top left, and take the first cell no active note on this day overlaps (using drawn, clamped positions). If every visible cell is taken, cascade 24 px down and right from the most recently created note on this day, up to 8 steps, then start again at the visible top left. The position is saved with the note, so no stored note lacks one. The board scrolls to show the new note if needed.

**Note editor** (modal)
- Fields: Title (max 200), Details (max 5,000), Checklist (add, rename, tick, remove; empty items are dropped on save; max 50), Day (a date picker), Due time with a Remind toggle that is disabled until a time is set (clearing the time also turns Remind off).
- Save writes only changed fields through `notes.patch`; no changes means no write. Changing the day keeps the note's position. Cancel or Esc discards changes without asking. "Move to Trash" trashes and closes. (Save model superseded by [spec 0003](../0003-realistic-notes-redesign/index.md) AC-27: the editor now saves as you type and has no Cancel. The no colour rule still holds.)
- If the note is deleted or trashed in another tab while the editor is open, the editor closes with a toast "This note was removed".

**Keyboard rules**
- N, T (go to today), ← and → only act when focus is not in an input, textarea or editable text, no editor or confirm is open, and no modifier key is held. ⌘K (Ctrl+K on Windows and Linux) always opens search and calls `preventDefault`.
- Esc closes the topmost thing only, in this order: a confirm box, a draft, the editor, search, a drawer.

**Drawers**: `role="dialog"`, `aria-modal="true"`, labelled by the drawer title. Focus starts on the close button, stays inside while open, and returns to the icon that opened it. The board behind is `inert`, page scrolling is locked, and the slide animation is skipped under `prefers-reduced-motion`. Opening a drawer closes search, and opening search closes a drawer.
- **Calendar drawer**: opens on the month of the day being viewed; today has a ring, the day being viewed is filled with the accent; each day shows up to 3 dots (one per open note, solid for done, outlined for open; more than 3 shows "3+"). Weeks start on `settings.startOfWeek`. Clicking a day closes the drawer and shows that day.
- **Trash drawer**: newest deleted first. Each row shows the title, the day it belonged to, and days left before removal. "Empty trash" and "Delete forever" ask for confirmation; Restore does not. Restoring keeps the board on the current day (the note returns to its own day). Empty state: "Trash is empty".
- **Trash icon count**: the number of trashed notes, shown as "99+" above 99, updated live.

**Search box**: opens below the top bar, right aligned, 480 px wide. Fewer than 2 characters shows "Type to search all your notes". Each result shows the title with the match highlighted, the day, and a one line snippet of the details. Arrow keys move, Enter opens. No results: "No notes match". More than 50: show 50 plus "Showing the first 50". Opening a result shows its day, scrolls the note into view, and outlines it with the accent for 2 seconds.

**Empty states**: an empty day shows a centered hint, "Nothing pinned yet. Press N or + to add a note." in the handwriting font.

**Sounds** (when `soundEnabled`): a pop on create, a chime on complete, a crumple on delete. Nothing else plays.

**Clamping**: at render, a note is kept fully inside the board's width minus a 16 px margin; its stored position is unchanged.

**Deleted**: `LandingPage.tsx`, `AuthModal.tsx`, `FocusView.tsx`, `AnalyticsView.tsx`, `Sidebar.tsx`, `mockData.ts`; the quick add bar and `parseAIQuery`; the color and category filters; the Tidy ("quick organize") button; the grid layout and `stickyboard_view_mode`; `reorderTodos` and `duplicateTodo`; priority, category, estimated time, pin, favorite and color picker UI; `colorForPriority` and the accent color customization (`--sb-accent` from settings; each theme now sets its own accent); `login`/`register`/`loginWithOAuth`/`logout`/`startDemo`; `getAIBriefing` and its UI; the `stats` computation; and the `User`, `ActivityLog`, `StreakStats`, `DashboardStats` types. ⌘K entries pointing at removed features go too.

**New components**: `TopBar`, `Drawer` (shared shell), `CalendarDrawer`, `TrashDrawer`, `SettingsDrawer`, `NoteEditor` (modal), `WelcomeScreen`, `CarryOverPrompt`, `SearchBox` (opens from the top bar, results below it).

**Themes**: `<html data-theme="dark|light|midnight|cork">`. Each theme is one block of the semantic tokens in `src/index.css` (`bg-app`, `bg-surface`, `bg-panel`, `text-ink`, `border-line`, accent), including its own accent. The `light` class approach is replaced by `data-theme`. `system` resolves through `matchMedia('(prefers-color-scheme: dark)')` with a change listener. Cork uses a warm cork texture board with paper notes; Midnight uses pure black surfaces and a muted accent. To avoid a flash, the raw `settings.theme` value (including `system`) is cached in the page's `localStorage` (`sb_theme`). A tiny script file loaded first by `newtab/index.html` (inline scripts are blocked by the extension's security policy) applies it before React loads, running `matchMedia` itself when the value is `system`. The theme is then corrected from `settings` once loaded. On a second computer the very first tab may show Dark briefly before the synced theme arrives; that's accepted.

**Carry over logic** (runs on board mount and on day change)
1. Take a `navigator.locks` lock named `carry-over` (it makes tabs of the extension take turns), then steps 2 to 5 run inside it.
2. If `meta.lastCarryOverPromptDate` is today or later, stop. (The comparison tolerates a stored date ahead of today after a timezone change.)
3. `lastDay` = the greatest `dateStr` below today among active notes. None → stop.
4. Candidates = active notes on `lastDay` with `!isCompleted` and no `carriedToDate`. None → set `lastCarryOverPromptDate = today` and stop. Only `lastDay` is checked: if it was all done, older unfinished notes are not offered (intended; the calendar still shows them).
5. Set `lastCarryOverPromptDate = today`, release the lock, then show the candidates, all ticked, as a card centered near the top of the board. If the tab closes before an answer, the prompt is gone for the day (accepted).
6. Carry: one `putMany` with the copies and the tagged originals.

**Copy rules**: new `id`; `dateStr` = today; `createdAt` and `updatedAt` = now; `carriedFromId` = original id; `remindedAt` cleared; `isCompleted` false; every other field (title, description, subtasks with their completion, color, position, due time, `remind`, source) copied as is. The original gets `carriedToDate` = today. Trashing or restoring the copy doesn't change the original's tag.

**Day change**: a timer set to the next midnight (in the resolved timezone), plus a check on `visibilitychange`, recomputes "today". If the board was showing the old today it moves to the new one; if the user was browsing another day it stays there. Then the carry over logic runs.

**Search**: in memory over `notes` held by the context. Filter active, drop notes with `carriedToDate`, substring match on the lowercased query against title, details, checklist items and `source.title` (minimum 2 characters, 150 ms debounce), sorted newest `dateStr` first, then newest `updatedAt`, max 50 shown. Result click → `setCurrentDateStr(note.dateStr)` (past, today or future) and highlight for 2 seconds.

**Calendar density**: counts active notes per day (carried originals still count on their own day).

**Value sourcing**

| Action | Value | Source |
|---|---|---|
| Board load | today | `todayInTz(resolveTz(settings.timezone))`; `resolveTz('auto')` = this computer's zone |
| Board load | day to show | `#date=YYYY-MM-DD` in the URL if present and valid (read once), else today |
| Board load | notes shown | Active notes where `dateStr === currentDateStr`, ordered by `z` ascending |
| Create or move | `z` | Highest `z` among that day's notes + 1 |
| Welcome | show or not | `meta.onboardedAt` unset |
| First paint | theme | raw `localStorage.sb_theme`, then `settings.theme` (both resolved through `matchMedia` for `system`) |
| Carry prompt | show today or not | `meta.lastCarryOverPromptDate` vs today |
| Carry prompt | candidates | Computed from notes, steps 2 to 4 above |
| New note | color | Random rule above, decided at save time inside the `note-create` lock |
| New note | position | First free spot rule above |
| New note | day | `currentDateStr` (the day on screen) |
| Note card | tilt | Hash of the note `id` mapped to −2° to 2° |
| Trash icon | count | Number of notes with `deletedAt` set |
| Message from background | day to show | `{ type: 'go-to-date', dateStr }` sent to this tab by `tabs.sendMessage` |
| Note link | clickable URLs | Regex for `https?://\S+` in `description`, rendered as `<a target="_blank" rel="noopener noreferrer">` |

**Key invariants**
- Note text never goes through `dangerouslySetInnerHTML`.
- Every note renders at 220 × 220 px; no code path reads a size or layout setting.
- A draft note is never saved with an empty title, and is always saved to its own day.
- Every stored note has a position and a `z`.
- Everything a mouse can do on a note (open, move, trash) also works from the keyboard.
- The page makes zero network requests (fonts are bundled, per 0001).

**Critical test scenarios**
- Happy path: install, pick Cork, press N, type a title, click away, reopen a tab: Cork, note present, no welcome, verifies **AC-7**, **AC-8**, **AC-9**, **AC-12**.
- Colors: create 10 notes in a row, then repeat while a second tab and a right click capture also create notes: no two consecutive notes share a color, verifies **AC-12**.
- Draft: press N, type a title, click the Calendar icon: the note is saved on its day, then the drawer opens, verifies **AC-12**, **AC-15**.
- Stacking: tick a checklist item on a note underneath another: it stays underneath, verifies **AC-10**.
- Keyboard: Tab to a note, Alt+→ three times, reload: it moved 72 px, verifies **AC-10**.
- Long note: a note with 20 checklist items scrolls inside and stays 220 × 220; scrolling it doesn't move it; dragging it moves it, verifies **AC-10**, **AC-11**.
- Drawers: open Calendar, press Esc: drawer closes and focus is on the Calendar icon; open Trash then Settings: only Settings is open, verifies **AC-15**.
- Carry over: notes on Friday, open on Monday: Friday's unfinished notes offered; carry 2 of 3; Monday has 2 copies, Friday shows 2 tagged; a second tab opened at the same moment shows no prompt, verifies **AC-13**.
- Midnight: leave a board open across midnight with an unfinished note: the board switches to the new day and offers it, verifies **AC-13**.
- Search dupes: a carried note appears once in search, on today, verifies **AC-14**.
- Small window: a note at x=1600 in a 1200 px window is visible, and its stored position is still 1600, verifies **AC-10**.

## Rationale (short)

The board was simplified on 2026-10-23 to match the calm, low effort feel of Balance: notes are the only thing on screen, and everything else hides behind a few icons. Fixed size notes with scrolling keep the board tidy without a size control, random colors remove a decision from every note, and dropping priority and category removes fields that no longer drive anything once filters and priority based colors are gone. Drawers keep the board visible behind Calendar, Trash and Settings; the editor stays a modal because it is about one note. Copying instead of moving on carry over keeps an honest history of each day, at the cost of duplicates, which search hides.
