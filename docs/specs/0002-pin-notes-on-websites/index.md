# 0002. Pin sticky notes on web pages with per site access

**Date**: 2026-11-08
**Status**: Proposed

## Summary

You can pin a sticky note on any normal web page (right click or Alt+Shift+N), and it comes back at the same spot whenever you return to that exact page. Sticky Board still installs with only the "Display notifications" warning; after your first pin on a site, the note offers an Allow button that asks Chrome for access to that one site. Page notes are ordinary notes with a `page` field, so search, Trash and backups cover them, and a new Pages drawer on the board lists them by site. The note UI lives inside a Shadow DOM (a sealed box in the page) so a site's styles and shortcuts can't break it.

## Requirements

**User stories**:
- As a reader, I want to pin a note next to what I'm reading so that my thought stays with its source.
- As a shopper, I want my note to be there when I come back to a product page so that I don't have to remember it.
- As a careful user, I want Sticky Board to touch only the sites I choose so that I can trust it.
- As a board user, I want to find all my page notes in one place so that I don't forget them.

**Acceptance criteria**:
- **AC-1**: Installing the production zip still shows only "Display notifications". The manifest has no `host_permissions`; website access is only in `optional_host_permissions` and asked for at run time.
- **AC-2**: On an `http` or `https` page, right click, "Pin a note here" places a new blank note with the title focused: at the spot you right clicked on a site you've allowed, and at the AC-3 spot otherwise. Typing a title and pressing Enter or clicking away saves it to that page. A new note left with an empty title is discarded.
- **AC-3**: Pressing Alt+Shift+N on an `http` or `https` page places a new blank note 24 px in from the top left of the visible area, moved down and right 24 px for each active note (open or collapsed) whose saved spot is within 12 px of that spot.
- **AC-4**: After your first pin on a site you haven't allowed, the note shows "Show this note when you come back?" with an **Allow** button. Allow opens a small Sticky Board window whose button asks Chrome for access to that site only (`*://<host>/*`). If you allow it, the note shows again at the same spot, size, color and collapsed state when you reload, revisit, or come back after restarting Chrome.
- **AC-5**: If you decline or ignore Allow, the note is still saved and listed in the Pages drawer. On a later visit it shows only after you choose "Show notes on this page" from the right click menu, or press Alt+Shift+N. Notes shown this way carry the same Allow line.
- **AC-6**: A note belongs to its exact page address without the `#part`. A note pinned on `/a?x=1` shows on `/a?x=1` and `/a?x=1#top`, but not on `/a?x=2` or `/b`.
- **AC-7**: You can drag a note by its top bar to any spot on the page. It scrolls with the page, and its spot is saved when you drop it. You can resize it from the corner handle between 160×120 and 480×480 px, and the size is saved.
- **AC-8**: Title, details and checklist edit right in the note, with the same limits as board notes (title 1 to 200 characters, details up to 5,000, checklist up to 50 items). Changes save within 1 second of when you stop typing. The same page open in a second tab shows the change within 1 second, except in a field you're typing in at that moment, which keeps your text.
- **AC-9**: A collapse button shrinks the note to a small tab in its color, showing the first 20 characters of its title. Clicking the tab opens it again. The collapsed state is saved.
- **AC-10**: Delete moves a page note to the existing 30 day Trash. Trash shows it with its site, and Restore puts it back on its page at the same spot. Restore is refused with "This page already has 50 notes." when the page is full.
- **AC-11**: A Pages drawer on the board lists page notes grouped by site, newest first (by when they were created), each with its title and the page title saved when it was pinned. Clicking one opens its page in a new tab, and each has Move to Trash. Page notes never appear on the day board or in calendar counts, the carry over prompt or reminders.
- **AC-12**: Board search finds page notes by title, details or checklist text. Each result is labelled with its site, and clicking one opens its page in a new tab.
- **AC-13**: Export includes page notes with their page, size and collapsed state, and import restores them at their saved page spot (never moved to a board spot). An imported note whose page address isn't `http` or `https` is skipped like any other invalid note.
- **AC-14**: When a site changes its address without reloading (YouTube, Gmail, X), within 1 second the old address's notes are removed and the new address's notes are shown. A change to only the `#part` redraws nothing.
- **AC-15**: Site CSS can't change how notes look or hide them (rules like `* { color: red !important }` or `div { display: none !important }` have no effect), notes don't shift the site's layout, and typing in a note doesn't trigger the site's keyboard shortcuts. Notes use the board's paper colors with dark text on every site, whatever the board theme.
- **AC-16**: Settings has a "Sites with page notes" list showing each allowed site (its host) and how many notes it has; a broad grant made in Chrome shows as "All sites". Remove takes away Sticky Board's access to that site; its notes stay and follow AC-5.
- **AC-17**: On pages that can't take notes, Alt+Shift+N and the right click items show the notification "Sticky Board can't add notes on this page." The right click items never appear on non `http`/`https` pages; on the Chrome Web Store and Chrome's PDF viewer they may appear, and clicking them shows the notification.
- **AC-18**: A page holds at most 50 active notes. Trying to add a 51st shows "This page already has 50 notes." on the page and creates nothing.
- **AC-19**: Alt+Shift+N and Alt+Shift+S are both declared in the manifest commands and both appear in `chrome://extensions/shortcuts`.
- **AC-20**: After Sticky Board updates or reloads, notes already drawn on an open page are removed instead of left unable to save, and using the right click item or shortcut on that page draws them again.

## Decision

**Chosen option**: Option 2: optional per site access, asked for from a small extension window, a content script registered at run time for allowed sites, and `activeTab` for on demand use.

Page notes are ordinary `Note` records with a `page` field. A WXT content script with `registration: 'runtime'` draws them with React in a closed Shadow DOM. The background worker registers that script only for allowed sites, injects it once into the current tab through `activeTab` when you pin or ask to see notes, and handles every write from a page.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch** (no new entities; optional fields added to `Note`, stored as `note:<id>` in `chrome.storage.local`; `schemaVersion` stays 1):

| Field | Type | Rule |
|---|---|---|
| `page` | `{ url: string; title: string }`, optional | Present means page note. `url` is `http` or `https`, no `#part`, at most 2048 chars. `title` is the tab title when pinned, cut to 200 chars, never refreshed. |
| `width`, `height` | number, optional | Page notes only. Clamped to 160 to 480 (width) and 120 to 480 (height). Missing means 220×220. |
| `collapsed` | boolean, optional | Page notes only. Missing means false. |
| `positionX`, `positionY` | number | For page notes: page coordinates in CSS px from the top left of the document. Never clamped when saved or imported. |
| `z` | number | For page notes: 1 more than the highest `z` among active notes on the same `page.url`. |
| `dateStr` | string | The day it was pinned (settings time zone). Not shown anywhere for page notes. |
| `dueTime`, `remind`, `remindedAt`, `source`, `carriedFromId`, `carriedToDate` | | Never set on page notes; validation drops them if a page note carries them. |

All other fields (title, description, subtasks, noteColor, isCompleted, deletedAt, createdAt, updatedAt) keep their spec 0001 rules. Relationship: a page has 0 to 50 active notes; a note has at most one page.

**State transitions** (page note):
`draft` (on page, not stored) → `active` (stored, first title saved) → `trashed` (`deletedAt` set) → `active` (Restore, if the page has room) or `purged` (30 days, existing purge). `collapsed` toggles within `active`. A draft with an empty title is discarded, never stored; a draft whose create is refused (limit) stays on screen with the message until you discard it.

Site access, per host: `not asked` → `allowed` (Allow window accepted) → `not allowed` (Remove in Settings, or removed in Chrome). `not asked` or `not allowed` → shown on demand only. Only `allowed` makes notes show by themselves.

**API surface** (extension messages and Chrome APIs; all inside the extension):

| Surface | Kind | Key inputs | Key outputs | Access | Key errors |
|---|---|---|---|---|---|
| Menu `pin-note` "Pin a note here" | `contextMenus`, contexts `page`, `documentUrlPatterns` `http://*/*`, `https://*/*` | tab, `pageUrl` | page's notes drawn, plus a draft | `activeTab` from the click | injection fails → notification (AC-17) |
| Menu `show-page-notes` "Show notes on this page" | same | tab | page's notes drawn | `activeTab` | same |
| Command `pin-note` (Alt+Shift+N) | `commands.onCommand` | active tab | page's notes drawn, plus a draft | `activeTab` from the shortcut | non http(s) URL or injection fails → notification |
| `inject(tabId)` | background, `scripting.executeScript({ target: { tabId }, files: [<WXT output path of page-notes>] })`, top frame only | tabId | script running | `scripting` + `activeTab` or site access | throws on restricted pages; retried once after 500 ms if the tab is still loading |
| `{ type: 'page-notes/new-draft', at?: {x, y} }` | background → content script | spot or none | draft shown, title focused | n/a | none |
| `{ type: 'page-notes/create', x, y, title }` | content script → background | spot, title | saved `Note`, or `{ error: 'limit' }` | sender checks | limit (AC-18) |
| `{ type: 'page-notes/patch', id, fields }` and `{ type: 'page-notes/trash', id }` | content script → background | id, allowed fields (title, description, subtasks, positionX/Y, width, height, collapsed) | updated `Note` or `{ error }` | sender checks; the note must have `page.url` equal to the sender tab's normalized URL | note gone → note removed from page |
| `{ type: 'page-notes/open-access', host }` | content script → background | host | opens `site-access.html?host=<host>` as a small popup window | sender checks | none |
| `site-access.html` | extension page | `host` | button calls `permissions.request({ origins: ['*://<host>/*'] })`, then closes; on grant the background injects into the opener tab if needed | user click (a real gesture) | declined → window says notes still save |
| `syncRegistration()` | background | `permissions.getAll().origins`, filtered | content script `page-notes` registered for exactly those origins (`persistAcrossSessions: true`, `runAt: 'document_idle'`, `allFrames: false`), unregistered when none | `scripting` | serialized; safe to run twice |
| Settings "Sites with page notes" | new tab page | none | allowed hosts with counts; Remove → `permissions.remove` | user click | none |

Sender checks for every content script message: `sender.id === chrome.runtime.id`, `sender.tab` present, `sender.frameId === 0`. The background builds `page` from `normalizePageUrl(sender.tab.url)` and `sender.tab.title`; it never trusts a page or URL sent in the message.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Pin | `page.url` | `normalizePageUrl(sender.tab.url)` (drop `#part`, keep scheme, host, path and query as is) |
| Pin | `page.title` | `sender.tab.title`, cut to 200 chars, empty string if missing |
| Pin by right click, allowed site | spot | the content script's last `contextmenu` event `pageX`/`pageY` (the registered script is already listening) |
| Pin by right click, not allowed | spot | the AC-3 spot (no script was running to see the click) |
| Pin by shortcut | spot | `scrollX + 24`, `scrollY + 24`, plus 24 px per active note within 12 px of that spot on this page |
| Pin | `noteColor` | existing `pickColor(allNotes)` |
| Pin | `z` | highest `z` among active notes with the same `page.url`, plus 1 |
| Pin | `dateStr` | today in the settings time zone (`todayInTz`) |
| Allow window | host | `new URL(page.url).host` of the note showing the line |
| Show on a page | which notes | active notes where `page.url === normalizePageUrl(location.href)` |
| Address change | new page | WXT `wxt:locationchange` on the content script context (covers `pushState` and `replaceState`); skipped when only the `#part` changed |
| Back button return | fresh notes | `pageshow` with `persisted` true reads notes again |
| Live updates | changed notes | `chrome.storage.onChanged` in the content script; the focused field keeps your text |
| Pages drawer, search, Trash | site label | `new URL(page.url).host`, as is (keeps `www.`) |
| Pages drawer | order | `createdAt`, newest first |
| Settings sites list | allowed hosts | `permissions.getAll().origins` that match `*://<host>/*`; any broader pattern shows as "All sites" |
| Settings sites list | note count | active notes whose `page.url` host equals the host |
| Collapsed tab | label | first 20 chars of `title` |
| Draw | clamped spot | x limited to `scrollWidth - width - 8`, y limited to `scrollHeight - 40`; drawn only, not saved |

**Key invariants**:
- The manifest never has `host_permissions`; site access exists only after you allow a host in `site-access.html`. `permissions.request` is never called from the background worker.
- A "site" is one exact host for both `http` and `https`: `*://www.example.com/*`. `www.example.com` and `example.com` are separate sites.
- `syncRegistration()` runs on `onInstalled`, `onStartup`, `permissions.onAdded` and `permissions.onRemoved` (listeners at top level), one run at a time (a promise chain), reads `getRegisteredContentScripts` first, then updates, registers or unregisters. It never registers with an empty origin list.
- After a grant, `syncRegistration()` runs, and if the opener tab has no running script, the background injects it there.
- Every write from a page goes through the background, so the board and all tabs share one save queue and one `note-create` lock. The content script reads storage directly but never writes it.
- The 50 note check runs in the background inside the `note-create` lock, for create and for Restore.
- One selector keeps page notes off the board: `boardNotes(all) = all.filter(n => !n.page)` is applied where the board context loads and subscribes, and in the background reminder check. `Board`, `CalendarDrawer`, `CarryOverPrompt`, `nextZ`, `firstFreeSpot` and import placement read only board notes. A test checks that every board view excludes a page note. Search, Trash, backup and `pickColor` read all notes.
- The UI is a custom element `<sticky-board-notes>` appended to `document.documentElement`, with `all: initial` on the host and `z-index: 2147483647`. Styles load inside the shadow root (`cssInjectionMode: 'ui'`), sizes use px, not rem, and text uses the system font stack (web fonts don't load inside a shadow root). Keyboard and pointer events are stopped at the host (`isolateEvents`), so site shortcuts don't fire while you type.
- Each script instance is tied to WXT's `ContentScriptContext`. When it becomes invalid (update or reload), it removes its UI and clears the guard, so a fresh injection can draw the notes again. The guard flag stores the extension instance, not just `true`.
- Top frame only. Notes in frames inside a page are out of scope.
- Note text is only ever set as text (React), never as HTML.

**Security model**:
- Sticky Board reads only the page address and title, never page content. Notes stay in `chrome.storage.local`; nothing leaves the device.
- The Shadow DOM is `closed`, so page scripts can't reach the note text through `shadowRoot`. A determined page could still read what's on screen; Settings states that page notes are visible to the page they sit on.
- Access is per host, shown and removable in Settings, and also removable through Chrome.
- Only the extension's own content scripts can message the background (no `externally_connectable`), and the sender checks above tie every write to the tab's real address.
- Incognito is not supported; the extension stays off there unless the user turns it on, and nothing is tested there.

**Configuration required**: none (no keys or services). Manifest changes in `wxt.config.ts`: add `scripting` to `permissions` (no install warning); add `optional_host_permissions: ['http://*/*', 'https://*/*']`; add command `pin-note` with `suggested_key` `Alt+Shift+N`; add the `site-access` page entrypoint.

**Critical test scenarios**:
- Happy path: right click "Pin a note here", type a title, click Allow, accept in the window, reload, restart Chrome, and the note is at the same spot. Verifies **AC-2**, **AC-4**.
- Failure case: decline in the window, and the note stays in the Pages drawer and shows only on demand. Verifies **AC-5**.
- Failure case: the board and a page edit the same note at the same time, and no field is lost. Verifies **AC-8**.
- Failure case: reload the extension with notes on an open page, and they disappear, then come back with the shortcut. Verifies **AC-20**.
- Failure case: a single page app address change swaps the notes without a reload. Verifies **AC-14**.
- Permission: the production zip installs with only "Display notifications", and a site never allowed gets no registered content script. Verifies **AC-1**, **AC-16**.
- Isolation: a test page with hostile CSS and a global keydown handler doesn't change a note's look or receive its keystrokes. Verifies **AC-15**.

## Build plan

Ordered as Tracer Bullet slices: one thin note working end to end on a real page first, then each slice thickens it.

1. **Data and board guard**: add `page`, `width`, `height`, `collapsed` to `Note` and `validate.ts` (http and https only, size clamps, drop board only fields); add `normalizePageUrl` and `boardNotes`; use `boardNotes` in the board context and the reminder check; import keeps page note spots. Unit tests, including one that each board view excludes a page note. Satisfies **AC-6**, **AC-11**, **AC-13**.
2. **Thin thread on a real page**: manifest changes; the `page-notes` content script (`registration: 'runtime'`, closed shadow root, `<sticky-board-notes>` host, `cssInjectionMode: 'ui'`, px sizes, system fonts, `isolateEvents`, paper palette); "Pin a note here" injects it through `activeTab` at the AC-3 spot, the draft takes a title, and the background creates the note with sender checks. Satisfies **AC-1**, **AC-2**, **AC-15**.
3. **Coming back**: the Allow line, `site-access.html` and its permission request; `syncRegistration()` on the four events; inject into the opener tab after a grant; draw a page's notes on load; right click spot on allowed sites; "Show notes on this page"; context invalidation cleanup. Satisfies **AC-2**, **AC-4**, **AC-5**, **AC-20**.
4. **Shortcut, limits, blocked pages**: the `pin-note` command with the stacked spot; the 50 note limit with the on page message; the notification for restricted pages and failed injection, with one retry while loading. Satisfies **AC-3**, **AC-17**, **AC-18**, **AC-19**.
5. **A full note**: drag by the top bar with page coordinates and draw clamps; corner resize; details and checklist edit in place with a short save delay, all through `page-notes/patch`; collapse to a tab; delete through `page-notes/trash`; live updates that spare the focused field; address changes and `pageshow`. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-14**.
6. **Board side**: the Pages drawer in the top bar; page notes in search results opening their page; site label in Trash and Restore with the 50 note check; "Sites with page notes" in Settings with counts, "All sites" and Remove. Satisfies **AC-10**, **AC-11**, **AC-12**, **AC-16**.

## Consequences

**Positive**:
- Install stays as clean as today, and access grows only where you choose.
- Search, Trash, backup, validation and the single save queue cover page notes with little new code.
- One React and Tailwind codebase serves both the board and the page notes.

**Negative / tradeoffs**:
- Allowing a site takes an extra click and a small window, and some people will ignore it; their notes then show only on demand.
- A content script now runs on allowed sites, so a site's own scripts and layout become a new source of bugs (transformed or positioned `html`, very tall pages, pages that rebuild the DOM). Expect a stream of small site fixes.
- Every page edit is a message round trip to the background, a little slower than writing directly.
- The content script reads all notes on each page load of an allowed site (`chrome.storage.local.get(null)`). That is fine for thousands of notes, but needs an index by address if it ever shows up as slow.
- Page notes use the system font, not the board's handwriting font.

**Neutral**:
- Spec 0001 AC-21 ("no host permissions") is refined to "no `host_permissions` at install"; optional access asked for at run time is allowed.
- New permission `scripting` (no warning). The dev build adds extra permissions; check AC-1 on the production zip only.
- Alt+Shift+N may be taken by another extension on some machines; Chrome then leaves it unset, and people set it in `chrome://extensions/shortcuts`.
- Right click inside a frame on a page (for example an embedded document) pins to the top page at the AC-3 spot.

## Follow-up

- [ ] Slice 2 confirms the WXT output path for the runtime content script and that `cssInjectionMode: 'ui'` works with runtime registration and Tailwind 4 inside a closed shadow root (Tailwind 4 theme variables may need to be set on `:host`).
- [ ] Later slices from the research, each its own decision: "pin on screen" (fixed to the window), Google Drive sync, and filters by color in the Pages drawer.
- [ ] Measure page load cost on a profile with 2,000 notes; add an address index only if it's slow.
