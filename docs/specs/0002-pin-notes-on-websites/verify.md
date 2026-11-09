# Verify: Pin notes on websites · spec 0002 · updated 2026-11-08
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: run `npm run build && npx wxt zip`, unzip `.output/sticky-board-0.1.0-chrome.zip`, and load it unpacked in a fresh Chrome profile (check AC-1 on the production build only; the dev build adds permissions).

## UI / manual
- [ ] Load the production zip in a fresh profile → the install dialog lists only "Display notifications"; `chrome://extensions` details show no site access → AC-1
- [ ] On `https://example.com/a?x=1` (never allowed), right click empty page space → "Pin a note here" → a blank note appears 24 px in from the visible top left with the title focused → AC-2, AC-3
- [ ] Type a title and press Enter → note saved; it shows "Show this note when you come back?" with Allow → AC-2, AC-4
- [x] Pin another, leave the title empty and click away → it disappears and nothing is saved (Pages drawer unchanged) → AC-2
- [ ] Click Allow → a small Sticky Board window opens; click "Allow on example.com" → Chrome asks for that one site only (`*://example.com/*`); accept → the window closes and the Allow line is gone → AC-4
- [ ] Reload the page, open it in a new tab, then quit and restart Chrome and revisit → the note is at the same spot, size, color and collapsed state each time → AC-4
- [x] On an allowed site, right click at a spot far down the page → "Pin a note here" → the draft appears at the right click spot → AC-2
- [ ] On a second site, pin a note, then in the Allow window click "Not now" (or decline Chrome's prompt) → note stays in the Pages drawer; reload → nothing shows; right click → "Show notes on this page" (or Alt+Shift+N) → the note shows with the Allow line → AC-5
- [x] Pin on `/a?x=1`, then visit `/a?x=1#top` (note shows), `/a?x=2` and `/b` (no note) → AC-6
- [x] Drag a note by its top bar to a new spot, scroll (it moves with the page), reload → same spot; resize from the corner down to the minimum and up to the maximum → stops at 160×120 and 480×480, size kept on reload → AC-7
- [x] Edit the title, details and add checklist items in place → saved within 1 second (open the board Search to confirm); open the same page in a second tab, edit in tab 1 → tab 2 shows it within 1 second; while typing in tab 2's title, edit the title in tab 1 → tab 2 keeps your text → AC-8
- [x] Collapse a note → a small tab in its color shows the first 20 characters of its title; click it → it opens; reload → collapsed state kept → AC-9
- [x] Delete a page note → it moves to Trash showing "On <site>"; Restore → back on its page at the same spot → AC-10
- [x] Fill a page to 50 notes, trash one, pin a new one (back to 50), then Restore the trashed one → refused with "This page already has 50 notes." → AC-10, AC-18
- [ ] Open the board's Pages drawer → notes grouped by site, newest first, each with title and page title; click one → page opens in a new tab; Move to Trash works; no page note shows on the day board, calendar dots, carry over prompt or reminders → AC-11
- [x] Board search for a word in a page note's checklist → result labelled with its site; click → page opens in a new tab → AC-12
- [x] Download a backup, delete the extension, reinstall, import → page notes return at their page spot with size and collapsed state (not moved on the board) → AC-13
- [x] On YouTube (allowed), pin a note on one video, then click another video (no reload) → within 1 second the first note goes and the second video's notes show; change only the `#part` → nothing redraws → AC-14
- [x] On a test page with `* { color: red !important } div { display: none !important }` and a `keydown` listener on `document` that logs keys → notes look normal with paper colors and dark text, the page layout doesn't shift, and typing in a note logs nothing; try with the board theme set to Light and to Cork → notes look the same → AC-15
- [ ] Settings → "Sites with page notes" lists each allowed host with its note count; in `chrome://extensions` set site access to "On all sites" → an "All sites" row appears; Remove a site → access removed, its notes stay and follow the on demand rule → AC-16
- [ ] On `chrome://settings` press Alt+Shift+N → notification "Sticky Board can't add notes on this page."; right click shows no Sticky Board page items there; on the Chrome Web Store, the items may show and clicking one shows the same notification → AC-17
- [x] On a page with 50 notes, Alt+Shift+N → the draft shows "This page already has 50 notes." and Enter creates nothing → AC-18
- [ ] `chrome://extensions/shortcuts` lists both "Open Sticky Board" (Alt+Shift+S) and "Pin a note on this page" (Alt+Shift+N) → AC-19
- [ ] With notes showing on a page, click Reload on the extension in `chrome://extensions` → within about 1 second the notes disappear; press Alt+Shift+N → they show again with a new draft → AC-20

## Value sourcing
- [x] Pin on `https://example.com/a?x=1#frag` → the saved note's page address (Pages drawer link) is `https://example.com/a?x=1`, and its page title is the tab title → page.url, page.title
- [x] Pin twice in a row on a fresh page with Alt+Shift+N without moving → second draft sits 24 px down and right of the first → shortcut spot
- [x] Set the Settings time zone to one where it's already tomorrow, pin a note, export a backup → its `dateStr` is the settings time zone's today → dateStr
- [x] Pin three notes on one page and two on another → each page's newest note is drawn on top of that page's others only → z
- [x] Move a note far right, then narrow the window and reload → it is drawn inside the page; widen again → back at its saved spot → draw clamp
- [ ] Allow a site whose address has a port (`http://localhost:3000`) → Chrome asks for `localhost`, and Settings lists `localhost` with the right count → host

## Commands
- [x] `npm test` → all tests pass (263 at build time) → AC-2 to AC-20 logic
- [x] `npm run lint` → no errors → all
- [x] `npm run build` then check `.output/chrome-mv3/manifest.json` → no `host_permissions`, no `content_scripts`, `optional_host_permissions` is `http://*/*` and `https://*/*`, commands include `pin-note` → AC-1, AC-19

## Acceptance-criteria coverage
- AC-1 setup + first step, manifest command · AC-2 pin steps · AC-3 first pin, shortcut spot · AC-4 Allow and restart · AC-5 decline · AC-6 address step · AC-7 drag and resize · AC-8 edit and two tabs · AC-9 collapse · AC-10 Trash and Restore · AC-11 Pages drawer · AC-12 search · AC-13 backup · AC-14 YouTube · AC-15 hostile CSS page · AC-16 Settings · AC-17 restricted pages · AC-18 50 limit · AC-19 shortcuts page · AC-20 extension reload
