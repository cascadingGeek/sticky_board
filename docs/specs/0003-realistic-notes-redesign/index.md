# 0003. Realistic paper notes redesign across every surface

**Date**: 2026-11-10
**Status**: In Progress

## Summary

Sticky Board gets a new look: notes that look like real paper. Each note gets a glossy pushpin, a glue strip, soft lifted shadows, a fine grain and a slight tilt. Handwriting switches to Caveat Brush, and the default theme becomes a light "Wall". The change covers the whole canvas: the board, editor, drawers, search, onboarding, messages, and notes pinned on websites, in all five themes. Nothing about how notes are stored changes, and behaviour stays the same with one exception: the note editor now saves as you type, with a small "Saved" status and a Done button, instead of Save and Cancel (the same way website notes already save). Otherwise this is a restyle of the existing components, plus one small settings migration so current users who never picked a theme stay on Dark.

## Requirements

**Design source**: the "Realistic Sticky Board" design canvas, https://claude.ai/artifact/6YWUQSwVqvQTs2E6XsfBye (37 boards, version of 2026-11-10). Light boards: `Main`, `Spec`, `WebNotes`, `PinMenu`, `PagesDrawer`, `Draft`, `SiteAccess`, `Onboarding`, `Loading`, `EmptyBoard`, `Editor`, `EditorError`, `BoardDraft`, `CarryOver`, `Search`, `SearchStates`, `Calendar`, `Trash`, `TrashStates`, `Settings`, `SettingsStates`, `PagesEmpty`, `Toasts`, `WebWarnings`, `Notifications`. Dark boards: `DarkBoard`, `DarkThemes`, `DarkOnboarding`, `DarkStates`, `DarkEditor`, `DarkSearch`, `DarkMessages`, `DarkCalendar`, `DarkTrash`, `DarkSettings`, `DarkPages`. `Spec` is the note anatomy reference (pin, shadows, palette, font). `DarkThemes` holds the token values for Dark, Midnight and Cork. Where the canvas and this spec disagree, this spec wins (the decisions below settle every conflict found). Every number the build needs is in **Visual values** below, so the build never has to open the canvas.

**User stories**:
- As a Sticky Board user, I want my notes to look like real paper pinned to a wall so that the board feels calm and tactile, not like an app.
- As a new user, I want to start on a bright, clean look and still be able to pick Dark, Midnight, Cork or System.
- As a current user, I want my board to keep the theme I am used to after the update.
- As a user who pins notes on websites, I want those notes to look the same as the ones on my board.

**Acceptance criteria** (the contract):

*Theme default and migration*
- **AC-1**: On a fresh install, onboarding preselects **Light** and its option text reads "Default, bright and clean". Dark reads "Easy on the eyes". Both "Start my board" and "Skip for now" leave the board on Light (Wall). The first paint of a new tab uses Light before settings load, so there is no flash of Dark.
- **AC-2**: When this version is installed or updated, an existing user (`meta.onboardedAt` is set) who never saved a theme in sync settings gets `theme: 'dark'` saved once, so their board does not change. A user who already saved any theme keeps it. A fresh install saves nothing and starts on Light. The check runs once only, so a new user who later skips onboarding is never moved to Dark by a future update. The write touches only the `theme` key: no other setting is written, so settings syncing from another device are not overwritten.

*The note (board)*
- **AC-3**: Every board note is a 220 × 220 px sheet of paper with, from the `Spec` board: a pushpin (dome head with a top left highlight, shaded body, darker collar, a long soft shadow falling down and left at about 38°); a 34 px glue band at the top that is 4.5% darker; a 1 px contact edge plus a soft drop shadow to the lower left (`-8px 12px 14px -10px`); two blurred curl strips under the bottom and left edges; a faint sheen and fine grain overlay. All shadows fall as if lit from the top right.
- **AC-4**: Paper colours use the new flat palette with ink `#232323` on every colour: yellow `#FDF29B`, blue `#8FCBFD`, green `#8FE0A6`, pink `#FDBEF0`, purple `#DCC0FD`, orange `#FFC97A`, mint `#86DCEE`, cream `#F1EEE6`. Stored `noteColor` keys do not change, so existing notes pick up the new hex automatically.
- **AC-5**: A note's pushpin is one of red `#E2231A`, yellow `#F2D60A`, green `#22C62E`, blue `#1E6FE0` (each with the light and dark shades in `Spec`), chosen from the note's id (see `pinFor`). The same note always gets the same pin on every load, in every theme, on the board and on websites. Notes on one board show a mix of pin colours.
- **AC-6**: A note's tilt is between −2.5° and +2.5°, stable per note id. While dragged or drafted, the note is level, raised by about 4 px, with a deeper shadow.
- **AC-7**: Note titles and details render in **Caveat Brush** (title 31 px, details 20 px, line height 1 and 1.2), loaded from fonts bundled in the extension with `font-display: block`, so a new tab never shows the fallback font first. When "Handwriting on notes" is off, notes use Inter (title 18 px semibold, details 14 px), replacing today's `0.68em` scaling rule. Opening a new tab makes no font request to the network.
- **AC-8**: A done note shows at 60% opacity (the whole note, pushpin and shadows included) with a line through its title and no "Done" stamp, in every theme. Done checklist items show a ticked box and a line through, at 60% opacity. Done notes are a deliberate exception to the contrast rule in AC-22: they are meant to step back, and the line through is the main cue.
- **AC-9**: A note's due time shows as a small chip with a bell icon, formatted in the browser's locale (for example "3:00 PM" in en-US, "15:00" in en-GB). A captured link shows as an underlined chip with the site's host name. Carry over chips keep their current text in the same chip style. Chrome reminder notifications use the same formatting (context line "Due 3:00 PM"). The editor keeps the browser's native time input, which already follows the browser locale. The stored value stays `HH:MM`.
- **AC-10**: The note's done, edit and Trash buttons still appear on hover and keyboard focus only, styled to sit on the paper without covering the pushpin.

*Board chrome and states*
- **AC-11**: The top bar is 64 px tall and translucent over the wall. On the left: previous day, the date ("Monday, 9 November") with a subtitle, next day. The subtitle is the day relation ("Today", "Yesterday", "Tomorrow", otherwise the weekday name such as "Friday"), then " · N notes" ("1 note" for one; no count when there are none). N counts that day's board notes not in Trash, done notes included, website notes excluded (the existing `boardNotes` and `isActive` filters). On the right: Search, Calendar, Notes on web pages (globe icon), Trash, Settings as 44 px icon buttons, then a primary "New note" button with a plus icon. Every icon button has an `aria-label`.
- **AC-12**: Loading, empty day ("Nothing pinned yet." with the N and + hint and a "Pin your first note" button), and board load error ("Couldn't load your notes." with "Reload board") match `Loading`, `EmptyBoard`, `Toasts`, and `DarkStates`.
- **AC-13**: A new note draft on the board appears in the note colour, level and lifted, with a focus outline, "Write a title…" and "Details…" placeholders, the hint "Enter to save · Esc to discard", and a dark pill under it reading "Lands in the first free spot · drag it anywhere" (`BoardDraft`).

*Editor, drawers, search, dialogs*
- **AC-14**: The note editor is a 580 px wide sheet of paper in the note's own colour, with a pushpin, centred over a dimmed board, laid out as `Editor`, `EditorError` and `DarkEditor`: Title, Details, Checklist (tick, edit, remove, "Add item"), Day and Due time fields, "Remind me" switch, "Move to Trash" and "Done", and the save status from AC-27. There is no colour control: the canvas's "Colour" swatch row is left out, and a note's colour stays random as spec 0001 AC-12 says. The paper keeps its colour in every theme. On a window shorter than the sheet, the sheet scrolls inside itself and Done stays reachable.
- **AC-15**: Calendar, Trash, Settings and Pages open as 440 px drawers from the right over a dimmed board and match their boards (`Calendar`, `Trash`, `TrashStates`, `Settings`, `SettingsStates`, `PagesDrawer`, `PagesEmpty`, and the dark versions). Calendar day cells show up to 3 small paper squares in the colours of that day's notes (the same notes the AC-11 count uses, first 3 by `createdAt`), today filled with the primary colour, past days muted.
- **AC-16**: Search (⌘K) matches `Search`, `SearchStates` and `DarkSearch`: the start state with the commands list, results with the match highlighted, the page note host or the day shown under each result, the no matches state, and the footer hints.
- **AC-17**: Carry over, the confirm dialogs (empty trash, delete forever), and every toast match `CarryOver`, `TrashStates`, `Toasts` and `DarkMessages`. Error toasts sit bottom centre and stay until dismissed; the info toast fades after 4 seconds.
- **AC-18**: Onboarding matches `Onboarding` / `DarkOnboarding` (with the AC-1 copy change): the theme list with swatches and hints, "Start my board", "Skip for now", and the sample notes preview in the new paper style.
- **AC-19**: Every heading in the interface uses Inter Bold. Space Grotesk is no longer bundled or referenced.

*Themes*
- **AC-20**: All five themes work on every surface, with the token values from the canvas. With no `data-theme` set, the Light values apply (they become the base `:root` tokens), on the board and on the Allow window page. **Light (Wall)**: wall radial gradient `#FDFCFA` → `#F2F0EB` → `#E6E2DA`, text `#1F1F22`, muted `#5C5A55`, primary button `#1F1F22` with white text, panels `#FBFAF7`. **Dark**: board `#18181B` with a faint dot grain, panels `#1C1C20`, raised rows `#26262B`, text and primary button `#EDEDF0`, muted `#A1A1AA`. **Midnight**: board `#000000`, panels `#0B0B0D`, raised `#161619`, accent and primary button `#8AB4F8`, muted `#9A9AA3`. **Cork**: cork texture over `#A9784C`, panels `#FFF8EE`, raised `#F3E6D2`, text and primary button `#3A2414`, muted `#6B5440`. **System** follows the computer between Light and Dark.
- **AC-21**: Paper keeps its hue in every theme. On Dark and Midnight it uses slightly darker paper colours (the values in **Visual values**, equal to the canvas's brightness 0.93 and 0.88), set as colour variables, not a CSS filter. The pushpin stays at full brightness. Shadows deepen on Dark, Midnight and Cork as listed in **Visual values**. Ink stays `#232323`.
- **AC-22**: All interface text meets 4.5:1 contrast on its background in every theme (3:1 for text 24 px and larger), including muted labels. Text placed straight on the Cork board (the empty day message and hint) sits on a soft backing (`rgba(255,248,238,0.78)`, 12 px radius) and is checked against it; the top bar already has its own solid backing. Touch targets are at least 44 px.

*Notes on websites*
- **AC-23**: Notes pinned on websites use the same paper, pushpin (same colour as on the board, per AC-5), glue band, shadows and Caveat Brush handwriting as board notes, plus their existing drag handle, collapse, Trash and resize controls, matching `WebNotes`, `Draft`, and `WebWarnings` (the 50 note limit and the save error states). The "Show this note when you come back? Allow" prompt and the collapsed tab match `WebNotes`. Website notes ignore the board theme: they always use full brightness paper and the Light shadows, because they sit on the host page, not on the board. They do follow "Handwriting on notes": the content script reads `settings.handwritingFont` from `chrome.storage.sync` and uses the AC-7 Inter sizes when it is off.
- **AC-24**: The handwriting font on websites is the Latin subset woff2 of Caveat Brush (`@fontsource/caveat-brush/files/caveat-brush-latin-400-normal.woff2`), bundled inside the content script and registered through the FontFace API under the private family name `SB Hand`, once per page. No font file is added to `web_accessible_resources`, no network request is made, and the font still loads on a page with a strict Content Security Policy (CSP, a site's rule list for what it may load). Note text stays hidden until the font is ready or 300 ms pass, whichever is first, so it never jumps. If the font fails, or for characters outside Latin, notes use the system font and still work.
- **AC-25**: The Allow window matches `SiteAccess`, and the right click menu entries and Chrome notifications keep the text in `PinMenu` and `Notifications`.

*No regressions*
- **AC-26**: No behaviour changes beyond AC-27 (the editor saves as you type): every existing test passes (updated only where it asserts a class name or text the design changes, or the editor's old Save and Cancel), the production zip still installs with only the "Display notifications" warning, and no new permission is added.

*Editor saving*
- **AC-27**: The note editor saves as you type. Each change to Title, Details, Checklist, Day, Due time or Remind is written 500 ms after the last change, sending through `patchNote` only the fields that differ from what the editor last saved (so a field changed in another tab is never overwritten unless you edit it here). The status beside Done reads "Saving…" while a write is waiting or running, "Saved" when everything is written (including when the editor first opens), and "Not saved" when a write failed or a field holds a value that can't be saved; it is a polite live region (`role="status"`). Done, the close button, Esc and clicking the dimmed board all send any waiting change first, then close. If that save fails, the editor stays open showing "Not saved", Done reads "Try again", and an error toast reads "Couldn't save the note. Your text is still here, try again."; pressing the close button or Esc a second time then closes without saving. An empty title is never saved: while it is empty the title shows "Give the note a title." (as in `EditorError`), the status reads "Not saved", the other fields still save, and closing keeps the last saved title. A day that is not valid works the same way with "Pick a valid day." Clearing the due time turns Remind off and saves both. Saving a new day or due time also clears `remindedAt`, as today. Empty checklist items are left out of what is saved. "Move to Trash" sends any waiting change, then trashes the note and closes. Closing or reloading the tab sends any waiting change on `pagehide`. There is no Cancel button and no way to throw away edits. The edge rules below are part of AC-27:
  - *Add item*: text typed in "Add item" and not yet added becomes a new item before any closing save (Done, close button, Esc, scrim, Move to Trash, `pagehide`). Adding an item counts as a change and restarts the 500 ms wait.
  - *Emptied checklist items*: an item whose text is emptied stays in the editor's list. A timed save leaves it out of the comparison and the patch, so the saved copy keeps its last text. Only a closing save drops empty items. The comparison uses the cleaned list (trimmed, empties left out) against the baseline.
  - *Day typed halfway*: the status reads "Not saved" at once, but "Pick a valid day." shows only after the Day field loses focus or a close is attempted.
  - *Remind*: clearing the due time sends `dueTime` (removed) and `remind: false` in the same patch. `remindedAt` is cleared only when `dateStr` or `dueTime` is in the patch, never for a Remind only change.
  - *One save at a time*: only one `patchNote` from the editor runs at a time. Changes made while it runs restart the wait. On success the baseline moves to exactly the values sent (a copy taken before the write), not to whatever the fields hold by then.
  - *Close during a save*: a close waits for the running save, then sends what is left. If either fails, the editor stays open on the failed save path.
  - *Empty title on close*: closing is allowed straight away; the old title stays and the "Give the note a title." message is the only warning (as on website notes). A title of only spaces counts as empty. The saved title is trimmed.
  - *Esc*: the editor handles Esc itself (it stops the event so the global handler in `App.tsx` does not also act), so Esc always goes through the save and the second press rule. `App.tsx` no longer closes the editor on Esc.
  - *Note removed elsewhere*: when `App.tsx` closes the editor because the note is gone, the editor clears its timer and sends nothing; only the existing "This note was removed." toast shows, no error toast.
  - *Scrim after a failure*: clicking the dimmed board behaves exactly like the close button, including the second press rule.
  - *Move to Trash after a failed save*: the note still moves to Trash and the editor closes. Unsaved text is lost, no save error toast shows, and the usual Trash toast with Undo appears.
  - *Leaving the tab*: saving on `pagehide` is best effort (the write may not finish while the page tears down). The editor also sends waiting changes when `visibilitychange` reports the page hidden.
  - *No retry loop*: after a failed save the editor does not retry by itself. The error toast shows once; the next save happens on your next edit or on "Try again". Another failure while the status already reads "Not saved" from a failure shows no new toast.

## Decision

**Chosen option**: Option 1: Restyle in place through tokens and the existing components.

Rework `src/index.css` tokens and the existing React components to the canvas, add one shared paper note look used by the board, the editor and the website notes, and ship it as one release with a one time theme migration. No new components layer, no feature flag, no data model change.

Sub decisions (each settled with the engineer or recommended here; reasoning in [rationale.md](rationale.md)):

| Decision | Choice |
|---|---|
| Default theme | Light (Wall) for new installs |
| Existing users without a saved theme | One time check (marker in `meta`) saves `dark`, writing only the theme key |
| Handwriting font | Caveat Brush only, bundled via `@fontsource/caveat-brush`; drop `@fontsource/caveat` |
| Heading font | Inter everywhere; drop `@fontsource/space-grotesk` |
| Pin colour | Derived from the note id (hash), no stored field |
| Done note | 60% opacity plus title line through, no stamp |
| Time display | Browser locale via `Intl.DateTimeFormat` |
| Website handwriting | Font bytes bundled in the content script, loaded with `FontFace` |
| Coverage | Every surface in the canvas, all themes |
| Handwriting off (recommended) | Inter 18 px semibold title, 14 px details |
| Tall editor on short windows (recommended) | `max-height: calc(100vh - 32px)` with scroll inside the sheet |
| Calendar dots (recommended) | Up to 3 squares per day, in the order notes were created |
| Paper on dark themes (recommended) | Darker paper colour variables, not a CSS filter; pin stays bright |
| Website notes and themes (recommended) | Always Light paper and shadows; follow the handwriting setting |
| Done notes vs contrast (recommended) | Exempt from the contrast rule by design |
| Shadow cost (recommended) | Pure CSS pseudo elements; `will-change: transform` only while dragging; if dragging drops below 60 fps with 50 notes, swap the blurred curl strips for plain box shadows |
| Editor saving | Save as you type, 500 ms after the last change, with a "Saving… / Saved / Not saved" status; Done replaces Save and Cancel |
| Editor colour | No colour picker; colour stays random (spec 0001 AC-12); the canvas swatch row is dropped |
| Failed save on close (recommended) | Stay open with "Try again"; a second close or Esc closes without saving |
| Empty title or invalid day (recommended) | Not saved, an inline message shows, the last saved value stays on close |

## Feature design

**Data model sketch**: no change to `Note`, `Meta` or the backup format. `Settings.theme` is unchanged in type; only `DEFAULT_SETTINGS.theme` becomes `'light'`. `Meta` gains one optional field, `themeDefaultCheckedAt?: string` (ISO time the AC-2 check ran). `SCHEMA_VERSION` stays 1, because backup import rejects any file with a higher version and older builds must still read new backups.

**State transitions**: none new.

**API surface** (internal functions and styles, no network API):

| Unit | Kind | Key inputs | Key outputs | Notes |
|---|---|---|---|---|
| `hashOf(s)` in `src/lib/board.ts` | function (extracted) | string | integer | Today's loop inside `tiltFor`: `h = (h * 31 + charCode) \| 0`, then `Math.abs(h)` |
| `pinFor(id)` in `src/lib/board.ts` | function | note id | `'red' \| 'yellow' \| 'green' \| 'blue'` | `['red','yellow','green','blue'][hashOf(id + ':pin') % 4]`; the salt keeps pin colour independent of tilt |
| `tiltFor(id)` | function (changed) | note id | degrees in [−2.5, 2.5] | `(hashOf(id) % 501) / 100 - 2.5` |
| `formatTime(hhmm)` in `src/lib/dates.ts` | function | `HH:MM` | locale string | Build `new Date(Date.UTC(2000, 0, 1, h, m))` and format with one cached `Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })`, so time zones and daylight saving cannot shift it. Used by the note chip and reminder notifications |
| `src/styles/paper.css` (new partial) | plain CSS | `--paper-<color>`, `--pin-c`, `--pin-l`, `--pin-d`, `--note-drop`, `--note-curl`, `--note-curl-side` | `.paper`, `.paper-<color>`, `.pin`, `.pin-red/yellow/green/blue`, `.paper-grain` | Plain CSS only: no Tailwind `@theme`, `@apply` or `@layer`, because the content script has no Tailwind. Variables are declared on `:root, .sb-root` with the Light values; `[data-theme]` blocks in `src/index.css` override them on the board only. Imported by `src/index.css` (outside any layer, so it wins over utilities) and by `src/pageNotes/style.css` with a relative `@import`, which Vite inlines into the `?inline` string |
| `loadHandFont()` in `src/pageNotes/font.ts` (new) | function | none | `Promise<boolean>` | Imports the Latin woff2 with Vite `?inline` (a base64 data URL string), decodes the base64 part with `atob` into a `Uint8Array`, then `new FontFace('SB Hand', bytes)`, `await face.load()`, `document.fonts.add(face)`. Runs once per page (a module level promise). Never uses `fetch`, so the page's `connect-src` and `font-src` rules do not apply |
| `settleThemeDefault()` called from `runMigrations()` | storage | raw `chrome.storage.sync.get('settings')`, `meta` | writes `{ ...raw, theme: 'dark' }` straight to sync only when needed; always sets `meta.themeDefaultCheckedAt` | Not through `settings.patch` or `flush`, which write the whole parsed object with defaults. Runs inside `onInstalled` only (install and update). If sync storage throws, it leaves the marker unset so the next update tries again |
| `Meta` type and `meta.get/patch` | type | none | new optional `themeDefaultCheckedAt?: string` | `meta` is not in backups, so backups are unaffected |
| `public/theme-boot.js` | script | `localStorage.sb_theme` | `data-theme` | Fallback becomes `'light'`. The base `:root` tokens are Light too, so a missing attribute still paints Light |
| `NoteEditor` saving | component logic | the editor's field values | `patchNote` calls with changed fields only | Keeps a baseline (the values last saved, starting from the note at open) and a 500 ms timer (the same delay as `SAVE_DELAY` in `src/pageNotes/PageNote.tsx`). A flush sends the fields that differ from the baseline, skipping an empty title or invalid day, and moves the baseline forward on success. Flushes on the timer, Done, close, Esc, the scrim, "Move to Trash", `pagehide` and `visibilitychange` (hidden), one at a time (AC-27 edge rules) |
| `patchNote(id, fields, errorMessage?)` in `src/lib/StickyBoardContext.tsx` | function (changed) | optional toast text | `boolean` (unchanged) | New optional third argument for the error toast. The editor passes "Couldn't save the note. Your text is still here, try again."; board actions keep the default "Couldn't save that change, so it was undone." |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Render note | paper colour | `note.noteColor` → `--paper-<color>` (theme specific value on the board) |
| Render note | pin colour | `pinFor(note.id)` |
| Render note | tilt | `tiltFor(note.id)` |
| Render note | font | `settings.handwritingFont` → Caveat Brush or Inter |
| Render note | due time chip text | `note.dueTime` → `formatTime` (browser locale from `Intl`) |
| Render note | link chip text | host of `note.source.url` (existing `hostOf`) |
| Render note | done look | `note.isCompleted` |
| Render note | paper shade and shadow depth | resolved theme (`data-theme` on `<html>`) → variables in **Visual values** |
| Top bar | day relation | `currentDateStr` compared with today in the resolved time zone (existing `dates.ts` helpers) |
| Top bar | count N | `boardNotes` for `currentDateStr` filtered by `isActive` (done included, website notes excluded) |
| First paint | theme | `localStorage.sb_theme`, else `'light'` |
| Settings load | theme | sync `settings.theme`, else `DEFAULT_SETTINGS.theme` (`'light'`) |
| Theme check | "already ran" signal | `meta.themeDefaultCheckedAt` present |
| Theme check | "existing user" signal | `meta.onboardedAt` present (onboarding has existed since the first release, so every earlier user has it) |
| Theme check | "never saved a theme" signal | raw `chrome.storage.sync` settings object has no `theme` key (read raw, before `parseSettings` fills defaults) |
| Calendar cell | squares | the AC-11 notes for that day, first 3 by `createdAt`, their `noteColor` |
| Pages drawer | "Shows automatically" or "On request" | `pageAccess` permission check per site (existing) |
| Website note | pin colour | `pinFor(note.id)` (same function, imported into the content script) |
| Website note | paper shade and shadows | always the Light values (the content script never reads the theme) |
| Website note | font | `settings.handwritingFont` read from `chrome.storage.sync` by the content script; when on, `loadHandFont` result, else Inter sizes; on failure the system font stack |
| Website note | text visibility | hidden until `loadHandFont` settles or 300 ms pass |
| Notification | context line | `"Due " + formatTime(note.dueTime)` in `src/lib/reminders.ts` |
| Editor save | fields to write | the editor's values (title trimmed, checklist cleaned) compared with its baseline (the values last sent successfully, starting from the note at open); empty title, invalid day and, on timed saves, emptied checklist items left out |
| Editor save | when a save runs | 500 ms after the last change, or at once on Done, close, Esc, scrim, Move to Trash, `pagehide` and `visibilitychange` (hidden); never while another editor save is running; never after a failure until the next edit or "Try again" |
| Editor | "Pick a valid day." shown | Day field invalid AND (the field has lost focus OR a close was attempted) |
| Editor | close allowed after a failure | second press of the close button, Esc or the scrim since the failure |
| Editor | status text | write waiting or running → "Saving…"; last write failed, title empty or day invalid → "Not saved"; otherwise "Saved" |
| Editor | Done label | last write failed → "Try again"; otherwise "Done" |
| Editor | error toast text | the `errorMessage` the editor passes to `patchNote` |

**Visual values** (from the canvas; the build uses these numbers directly):

*Paper* (ink `#232323` on all):

| Colour | Light, Cork | Dark | Midnight |
|---|---|---|---|
| yellow | `#FDF29B` | `#EBE190` | `#DFD588` |
| blue | `#8FCBFD` | `#85BDEB` | `#7EB3DF` |
| green | `#8FE0A6` | `#85D09A` | `#7EC592` |
| pink | `#FDBEF0` | `#EBB1DF` | `#DFA7D3` |
| purple | `#DCC0FD` | `#CDB3EB` | `#C2A9DF` |
| orange | `#FFC97A` | `#EDBB71` | `#E0B16B` |
| mint | `#86DCEE` | `#7DCDDD` | `#76C2D1` |
| cream | `#F1EEE6` | `#E0DDD6` | `#D4D1CA` |

*Paper layers* (board note, 220 px): padding `44px 18px 16px`; glue band `linear-gradient(rgba(0,0,0,.045), rgba(0,0,0,.045) 34px, transparent 34px)` (Dark and Midnight `.05`); sheen `linear-gradient(150deg, rgba(255,255,255,.25), transparent 45%, rgba(0,0,0,.05))` (Dark and Midnight `.2` and `.08`); grain an `::after` overlay of `radial-gradient(rgba(0,0,0,.05) .6px, transparent .9px)` at `3px 3px` plus `radial-gradient(rgba(255,255,255,.18) .6px, transparent .9px)` at `5px 5px`, offset `2px 1px` (CSS only, no image file).

*Shadows*:

| Part | Light | Dark, Midnight | Cork |
|---|---|---|---|
| contact and drop (`box-shadow`) | `0 1px 1px rgba(0,0,0,.1), -8px 12px 14px -10px rgba(0,0,0,.45)` | `0 1px 1px rgba(0,0,0,.4), -10px 16px 20px -10px rgba(0,0,0,.85)` | `0 1px 1px rgba(60,30,10,.15), -8px 12px 16px -8px rgba(60,30,10,.7)` |
| bottom curl (`::before`) | left `-6px`, bottom `-3px`, 72% wide, 26 px tall, `rgba(0,0,0,.3)`, blur 10 px | left `-8px`, bottom `-5px`, 76%, 30 px, `rgba(0,0,0,.65)`, blur 12 px | as Light with `rgba(60,30,10,.4)` |
| left curl (`::after` on the wrapper) | left `-7px`, top 34 px, 18 px wide, 74% tall, `rgba(0,0,0,.16)`, blur 9 px | left `-9px`, top 34 px, 20 px, 76%, `rgba(0,0,0,.4)`, blur 10 px | as Light with `rgba(60,30,10,.22)` |
| lifted (drag, draft) | `0 1px 1px rgba(0,0,0,.1), -12px 22px 26px -12px rgba(0,0,0,.5)`, `translateY(-4px)`, no tilt | same with `.9` | same with `rgba(60,30,10,.75)` |

*Pushpin* (centred, top 14 px; editor `scale(1.3)`): shadow `left -5px, top 8px, 10×48 px`, `linear-gradient(rgba(0,0,0,.42), transparent)`, blur 3 px, `rotate(38deg)` from the top (Dark `.5`); collar `18×8 px` ellipse in the dark shade; body `12×13 px`, 3 px radius, `linear-gradient(90deg, dark, colour 40%, light 58%, dark)`; head `22×18 px` ellipse, `radial-gradient(circle at 34% 30%, #fff 0, rgba(255,255,255,.9) 1.5px, light 4px, colour 45%, dark 100%)` with `inset -2px -3px 4px rgba(0,0,0,.25), 0 2px 3px rgba(0,0,0,.3)`.

| Pin | colour | light | dark |
|---|---|---|---|
| red | `#E2231A` | `#FF7A6E` | `#9E1209` |
| yellow | `#F2D60A` | `#FFF27A` | `#A88F00` |
| green | `#22C62E` | `#8CF08F` | `#0F7A18` |
| blue | `#1E6FE0` | `#7FB2FF` | `#0F449A` |

*Interface tokens*:

| Token | Light | Dark | Midnight | Cork |
|---|---|---|---|---|
| board | radial `#FDFCFA` 0%, `#F2F0EB` 62%, `#E6E2DA` 100% at 62% 38% | dot grain `radial-gradient(rgba(255,255,255,.022) 1px, transparent 1.3px) 0 0/4px 4px` over radial `#27272C`, `#18181B` 62%, `#101012` | `#000000` | `radial-gradient(rgba(70,38,14,.32) 1px, transparent 1.4px) 0 0/6px 6px, radial-gradient(rgba(255,228,190,.3) 1px, transparent 1.5px) 3px 3px/7px 7px, radial-gradient(ellipse at 50% 40%, #C4966A, #A9784C)` |
| top bar | `rgba(255,255,255,.72)`, line `rgba(0,0,0,.06)` | `rgba(22,22,25,.82)`, line `rgba(255,255,255,.07)` | `#000000`, line `rgba(255,255,255,.08)` | `rgba(255,248,238,.9)`, line `rgba(60,30,10,.15)` |
| panel, drawer | `#FBFAF7`, divider `#ECE9E2` | `#1C1C20` | `#0B0B0D` | `#FFF8EE` |
| raised row, input | `#FFFFFF` | `#26262B` | `#161619` | `#F3E6D2` |
| text | `#1F1F22` | `#EDEDF0` | `#EDEDF0` | `#2A1B0E` |
| muted text | `#5C5A55` | `#A1A1AA` | `#9A9AA3` | `#6B5440` |
| primary button | `#1F1F22` on white text | `#EDEDF0`, text `#141416` | `#8AB4F8`, text `#0B1220` | `#3A2414`, text `#FFF8EE` |
| switch off | `#D9D5CC` | `#34343B` | `#2E2E34` | `#E0CDB2` |
| scrim | `rgba(20,18,14,.28)` (editor `.32`) | `rgba(0,0,0,.5)` (editor `.55`) | `rgba(0,0,0,.6)` | `rgba(40,20,5,.35)` |
| toast | `#1F1F22`, white text, shadow `0 12px 30px -8px rgba(0,0,0,.3)` | `#EDEDF0`, text `#141416`, shadow `.8` | as Dark | as Light |
| danger text (Move to Trash, Delete forever) | `#8F1D12` | `#FF8A80` | `#FF8A80` | `#8F1D12` |
| error toast icon | `#FF7A6E` | `#D93036` | `#D93036` | `#FF7A6E` |
| focus outline | `3px solid rgba(31,31,34,.55)`, offset 5 px | `3px solid rgba(237,237,240,.6)` | `3px solid #8AB4F8` | `3px solid rgba(58,36,20,.6)` |

Values not drawn in the canvas (Midnight and Cork scrim, switch off, danger text on dark, focus outline on dark themes) are chosen here to match each theme and must pass AC-22.

**Key invariants**:
- No raw colours in components; every colour is a token in `src/index.css` or a variable in `src/styles/paper.css` (theme preview swatches stay the one exception, per `design.md`).
- Paper hue, ink and pin colour never depend on the theme; only the paper shade and shadow depth do, and only on the board.
- The same note shows the same pin and tilt everywhere.
- Nothing loads from the network; fonts are bundled.
- `noteColor` keys and the stored `dueTime` format do not change.

**Security model**: unchanged. No new permissions and no new `web_accessible_resources`. The font comes from bytes inside the content script, so no font URL exists for a site to probe. A site's scripts can still see that a font named `SB Hand` was added to the page (as they can already see the notes themselves), so this does not hide the extension from a page it runs on. The private name avoids clashing with a site's own fonts.

**Configuration required**: none. Package changes: add `@fontsource/caveat-brush`; remove `@fontsource/caveat` and `@fontsource/space-grotesk`.

**Critical test scenarios**:
- Happy path: fresh install opens on Light with Light preselected; pick nothing and skip; board is Light; add a note; it shows a pin, tilt and Caveat Brush. Verifies **AC-1**, **AC-3**, **AC-5**, **AC-6**, **AC-7**
- Theme check: with `meta.onboardedAt` set and sync settings missing `theme`, run migrations; `theme` is `'dark'`, every other stored setting is unchanged, and `themeDefaultCheckedAt` is set. With `theme: 'cork'` saved, it stays Cork. Fresh install (no `onboardedAt`): no theme written, marker set. Running migrations again changes nothing, even if the theme key was removed meanwhile. With `chrome.storage.sync.get` throwing: nothing written, marker not set. With notes stored but no `onboardedAt`: no theme written. Verifies **AC-2**
- `pinFor` and `tiltFor`: same id gives the same result every call; 1,000 random ids give all four pins and every tilt within [−2.5, 2.5]. Verifies **AC-5**, **AC-6**
- `formatTime('15:00')` gives "3:00 PM" under en-US and "15:00" under en-GB, whatever the machine's time zone. Verifies **AC-9**
- Top bar subtitle: "Today · 1 note", "Yesterday · 3 notes", "Friday" (no notes), with a done note counted and a website note not counted. Verifies **AC-11**
- Done note renders with opacity 0.6, a line through the title, and no "Done" text. Verifies **AC-8**
- Website note on a page served with `Content-Security-Policy: default-src 'none'` still shows Caveat Brush; with `FontFace.load` rejected, it shows the system font after at most 300 ms and stays usable; with handwriting off, it shows Inter. Verifies **AC-23**, **AC-24**
- Each theme × each surface screenshot against its board (manual, `/check verify`). Verifies **AC-11** to **AC-22**, **AC-25**
- Editor saving: type a title, wait 500 ms, and exactly one patch carries only `title`; the status goes "Saving…" then "Saved". Edit details and press Esc before 500 ms: the change is saved, then the editor closes. Clear the title: no title write, "Give the note a title." shows, the status reads "Not saved", details edits still save, and closing keeps the old title. Make the patch fail: the editor stays open, "Not saved", Done reads "Try again", the AC-27 toast shows; Esc again closes. Change a note's day in another tab while its editor is open and edit only the title: the day is not overwritten. No colour control and no Cancel button render. Verifies **AC-14**, **AC-27**
- Editor edge rules: type in "Add item" and press Esc, and the item is saved. Empty an existing item and wait 500 ms, and the saved checklist still has it with its old text; then close, and it is dropped. Make two edits so the second lands while the first write is still running: two writes in order, and the second carries only the second change. Press Done while a write is running: the editor closes only after both writes land. Press Esc with the global handler mounted: the waiting change is saved first (no direct close). Remove the note in another tab with a change waiting: the editor closes, no write is sent, and only "This note was removed." shows. Fail a write twice in a row while typing: one error toast. Verifies **AC-27**
- Full existing suite and the zip install check. The test setup pins the locale to en-US so time text is stable. Verifies **AC-26**

## Build plan

Tracer Bullet (the project's approach): first one thin thread end to end, a real note on the real board in the new look with the new default, then widen surface by surface.

1. Thin thread: add `src/styles/paper.css` with the Light **Visual values** (paper, glue band, contact and curl shadows, grain, pin with four colours); make Light the base `:root` tokens; `hashOf`, `pinFor` and the wider `tiltFor`; Caveat Brush swap in `package.json` and `--font-hand` with `font-display: block`; restyle `NoteCard` (pin, done look, hover tools, Inter sizes when handwriting is off); `DEFAULT_SETTINGS.theme = 'light'`; `theme-boot.js` fallback; `Meta.themeDefaultCheckedAt` and `settleThemeDefault` with its tests. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-10**
2. Board chrome: `TopBar` (64 px, subtitle with day relation and count, globe button, "New note" button), `formatTime` and the chips, `DraftNote` lifted draft with hint pill, loading, empty day, board error. Satisfies **AC-9**, **AC-11**, **AC-12**, **AC-13**
3. Editor and dialogs: `NoteEditor` as a paper sheet (with errors and short window scroll) that saves as you type (baseline, 500 ms timer, one save at a time, status, "Try again", flush on every way out, the AC-27 edge rules), the editor owning Esc instead of `App.tsx`, the optional `errorMessage` on `patchNote`, `CarryOverPrompt`, `ConfirmDialog`, `Toasts`, `WelcomeScreen` (copy change, Light preselected, sample notes), drop Space Grotesk. Satisfies **AC-14**, **AC-17**, **AC-18**, **AC-19**, **AC-27**
4. Drawers and search: `Drawer` at 440 px, `CalendarDrawer` (paper squares), `TrashDrawer`, `SettingsDrawer`, `SitesSection`, `PagesDrawer`, `SearchBox`. Satisfies **AC-15**, **AC-16**
5. Theme pass: Dark, Midnight, Cork, System token blocks and paper and shadow variables from **Visual values**; Cork backing for text on the board; contrast check of every text token on every theme. Satisfies **AC-20**, **AC-21**, **AC-22**
6. Website notes: `@import` the paper partial into `src/pageNotes/style.css` and drop its old font and colour rules; `loadHandFont` with the bundled Latin woff2, the 300 ms gate and fallback; read `handwritingFont` in the content script; restyle `PageNote`, `PageDraft`, the Allow prompt, collapsed tab and warnings; `SiteAccess` window on Light base tokens; the menu copy; `formatTime` in `src/lib/reminders.ts`. Satisfies **AC-9**, **AC-23**, **AC-24**, **AC-25**
7. Cleanup and proof: remove unused packages, the old `.paper-*` gradients and the `0.68em` rule; pin the test locale to en-US in the test setup; update tests that assert changed classes or copy (likely `PageNotesApp.test.tsx`) and rewrite the Save and Cancel cases in `NoteEditor.test.tsx` for saving as you type; update `design.md` (new canvas link, Light default, 440 px drawers, paper editor, Inter headings, Caveat Brush, `paper.css`); build the zip and confirm the install warning. Satisfies **AC-19**, **AC-26**

## Consequences

**Positive**:
- One paper look shared by the board, editor and websites, from one CSS partial, so they cannot drift apart.
- No data or backup format change, so rollback is a plain revert (the migration only writes a value the old version already understands).
- Smaller font bundle overall: Space Grotesk goes away.
- The board editor and website notes now save the same way, so there is one save model to learn and test.

**Negative / tradeoffs**:
- More paint work per note (two blurred pseudo elements and a grain layer). Fine at normal board sizes; needs a drag frame rate check at 50 notes.
- The content script grows by about 40 KB for the font bytes (base64 of the Latin woff2), loaded on every site the user allowed.
- A large visual diff touching almost every component, so review is heavy and screenshot checking is manual.
- Locale time formatting means two users can see the same note's time written differently; the editor input still uses the browser's native time field.
- The editor loses Cancel: edits can no longer be thrown away in one step, only undone by hand. Editing a note now writes to storage while you type (at most about two writes a second), which also triggers the background reminder check each time.

**Neutral**:
- `SCHEMA_VERSION` stays 1 so backups stay importable both ways; the theme check is tracked by a `meta` marker instead (meta is not part of backups).
- `design.md` must be rewritten to point at the new canvas.

## Follow-up

- [ ] Run `/check verify` against every board in the canvas, in all five themes, once built.
- [ ] Update the onboarding copy on the canvas itself (it still labels Dark as "Default") so the design and the spec agree.
- [ ] Remove the "Colour" swatch row from the `Editor` and `DarkEditor` boards on the canvas, since the editor has no colour control (AC-14).
- [ ] Measure drag smoothness with 50 notes on Dark (the heaviest shadows); apply the plain box shadow fallback only if it drops below 60 fps.
- [ ] Check the values this spec chose where the canvas has none (Midnight and Cork scrim, dark theme danger text and focus outlines) on the canvas, or adjust them during `/check verify`.
- [ ] No `AGENTS.md` exists yet; consider `/audit` so the token and paper partial conventions live there and not only in `design.md`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
