# Verify: Chrome extension first release · spec 0001 · updated 2026-10-23
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: `npm run build`, then load `.output/chrome-mv3` with **Load unpacked** in `chrome://extensions` (or `npm run dev`).

## UI / manual

### Storage (0002)
- [ ] Create a note, quit Chrome fully, reopen: the note is unchanged; DevTools > Application > Extension storage shows key `note:<id>` → AC-1
- [ ] Open two new tabs; edit note A in tab 1 and note B in tab 2 at the same time: both edits show in both tabs within 1 s, no reload → AC-2
- [ ] Change the theme on one computer signed into Chrome sync: it appears on a second computer; turn sync off: the theme still persists locally → AC-3
- [ ] Trash a note: it leaves the board; Trash drawer lists it with "30 days left"; Restore puts it back on its own day and position; "Delete forever" and "Empty trash" ask to confirm, then remove the key → AC-4
- [ ] Set a trashed note's `deletedAt` to 31 days ago in storage, restart Chrome: it is gone → AC-4
- [ ] Settings > Download backup: `sticky-board-backup-<today>.json` holds every note (Trash too) and settings → AC-5
- [ ] Edit a note, then import an older backup: the newer local copy is kept (counted as "already up to date"); import a newer edit: it replaces; import a file with a `javascript:` source URL or a broken note: "nothing was imported", data unchanged → AC-5
- [ ] Make a write fail (for example remove the note's key from storage while its editor is open, then save): an error toast shows and the screen returns to the last saved state → AC-6

### Board (0003)
- [ ] Open a new tab: today's board in Dark, no login; DevTools Network shows only `chrome-extension://` requests → AC-7
- [ ] Fresh profile: the welcome screen shows, Dark preselected; clicking themes previews live; "Start my board" or "Skip" lands on the empty board hint; reopening never shows it again → AC-8
- [ ] Settings: pick each of Dark, Light, Midnight, Cork, System; with System, flip the OS appearance: the board follows without reload; reopening a tab shows no flash of another theme → AC-9
- [ ] Every note is 220 × 220; drag one from its body to a new spot and reload: it stays; it can't be dragged above the top or past the right edge; dragging from its scrollbar, a link, or a checkbox does not move it; Esc during a drag puts it back → AC-10
- [ ] Narrow the window below a note's x: the note is drawn inside the view; widen again: it returns to its stored spot → AC-10
- [ ] Tab to a note, press Alt+→ three times, release, reload: it moved 72 px; tick a checklist item on a note underneath another: it stays underneath → AC-10
- [ ] A note with 20 checklist items scrolls inside and stays 220 × 220; scrolling doesn't move it → AC-11
- [ ] A URL in the details opens in a new tab (trailing full stop not part of the link); a captured note shows its source link → AC-11
- [ ] Press N (or "+"): a blank note appears at the first free spot with the cursor in its title; type and press Enter: saved; press N then Esc, or leave the title empty and click away: nothing saved → AC-12
- [ ] Create 10 notes in a row: no two consecutive notes share a color; double click a note: the editor has only Title, Details, Checklist, Day, Due time and Remind → AC-12
- [ ] Type a title in a blank note, then click the Calendar icon: the note is saved on its own day, then the drawer opens → AC-12
- [ ] Put unfinished notes on an earlier day, set `meta.lastCarryOverPromptDate` to an older date, open a new tab: the prompt lists them; "Carry selected" creates copies on today ("Carried from …") and tags originals "Carried to …"; a second tab opened at the same time shows no prompt; "Not today" hides it until tomorrow → AC-13
- [ ] Leave a board open across midnight with an unfinished note: it switches to the new day and offers the note → AC-13
- [ ] Click the search icon (or ⌘K / Ctrl+K), type "pass": results across days with the match highlighted, Trash and carried originals excluded; Enter opens that day and outlines the note for 2 s → AC-14
- [ ] The screen shows only the top bar (day, ←/→, Search, Calendar, Trash, Settings, "+") and the board; Calendar, Trash and Settings open as right drawers, one at a time; Esc, the close button, or a click outside closes and returns focus to the icon; a calendar day click shows that day; N, ←, →, T work and do nothing while typing → AC-15

### Background (0004)
- [ ] Select text on any web page, right click > "Send selection to Sticky Board" with no board tab open, then open a new tab: the note is on today, title is the first line (max 80), source links back to the page → AC-16
- [ ] Right click a link > "Save link to Sticky Board": title is the link's host and path (or "Saved link" for a non http link), details hold the URL → AC-17
- [ ] Give a note a due time 2 minutes ahead with Remind on: a notification appears and stays until clicked; clicking opens or focuses the board on that day; completing, trashing or turning Remind off before the time stops it; changing the time reschedules → AC-18
- [ ] Set a reminder, quit Chrome past its time, restart: one "You missed 1 reminder" notification (no separate one); restart again: nothing → AC-19
- [ ] Click the toolbar icon, and press Alt+Shift+S: an open board tab is focused, or a new one opens → AC-20
- [ ] Install `.output/sticky-board-0.1.0-chrome.zip` (unzipped, production build): the only install warning is "Display notifications"; the manifest has no host permissions → AC-21

### Value sourcing (one step per source, varying the input)
- [ ] Today: set Settings > Time zone to a zone where it is already tomorrow: the board and "Today" switch to that zone's day; back to Automatic: this computer's day → Board load / today
- [ ] `#date=`: open `chrome-extension://<id>/newtab.html#date=2026-01-01`: that day shows once, then the hash is cleared → Board load / day to show
- [ ] Stacking: create or move a note: it gets the day's highest `z` + 1; editing text never changes `z` → Create or move / z
- [ ] Color: create notes from two tabs and a right click capture in quick succession: no new note repeats the previous note's color (carry over copies keep theirs) → New note / color
- [ ] Position: scroll the board down, press N: the new note lands in the visible area, not at the top → New note / position
- [ ] Day: browse to tomorrow, press N: the note belongs to tomorrow → New note / day
- [ ] Tilt: reload twice: each note keeps the same tilt → Note card / tilt
- [ ] Trash count: trash 100+ notes: the badge reads "99+" → Trash icon / count
- [ ] Reminder time across daylight saving: a 02:30 reminder on a spring forward day fires at 03:00 → Reminder / due time
- [ ] Capture source title: capture from the PDF viewer (no tab title): the source label falls back to the host → Capture / source title
- [ ] Export file name: uses today in the chosen time zone → Export / file date

## Commands
- [ ] `npm run lint` → ESLint and typecheck pass → all
- [ ] `npm run build` → `.output/chrome-mv3/manifest.json` has exactly `storage, unlimitedStorage, contextMenus, activeTab, alarms, notifications`, `chrome_url_overrides.newtab`, `action`, `_execute_action` Alt+Shift+S → AC-21
- [ ] `npm run zip` → `.output/sticky-board-0.1.0-chrome.zip` exists → AC-21

## Acceptance-criteria coverage
- AC-1, AC-2, AC-3, AC-4, AC-5, AC-6: Storage steps
- AC-7 to AC-15: Board steps (AC-10 three steps, AC-12 three steps)
- AC-16 to AC-21: Background steps plus Commands
- Value sourcing table rows: one step each
