# 0001. Ship Sticky Board as a local first Chrome extension

**Date**: 2026-10-23 (UI simplified the same day)
**Status**: In Progress

## Summary

Sticky Board becomes a Chrome extension that replaces the new tab page with your sticky note board, so your day's notes greet you on every new tab. Everything is saved in the browser (no login, no server, no tracking), and only your settings follow you to other computers through Chrome sync. The screen is kept as calm as Balance: same size notes you drag anywhere, colors picked for you, and a slim top bar whose icons open Calendar, Trash and Settings as drawers. The first release adds themes (dark by default), search, trash, backup files, a right click "send to board" menu, and due time reminders; sidebar, filters, quick add, grid layout, login, focus timer and analytics are removed.

## Structure

| Child spec | What it decides |
|---|---|
| [0001-extension-platform.md](0001-extension-platform.md) | The extension stack: Manifest V3 on WXT, which surfaces exist (new tab page plus a background worker), and the exact permissions. |
| [0002-local-storage-data.md](0002-local-storage-data.md) | Where data lives (one `chrome.storage.local` key per note, settings in `chrome.storage.sync`), the storage layer, live updates across tabs, trash, export and import. |
| [0003-new-tab-board.md](0003-new-tab-board.md) | What the new tab page does: the minimal top bar and drawers, fixed size freeform notes, note creation and random colors, themes, welcome screen, carry over prompt, search, and what gets deleted. |
| [0004-capture-reminders.md](0004-capture-reminders.md) | Background features: right click capture of text and links, due time reminders, missed reminder summary, toolbar icon and keyboard shortcut. |

Each child holds its own acceptance criteria. IDs are numbered across the whole umbrella (AC-1 to AC-21) so none repeat.

## Requirements

**User stories** (details and acceptance criteria live in each child):
- As a busy person, I want my notes for today on every new tab so that I never forget what matters today. (0003)
- As a user, I want my notes kept safely in my browser with a backup file so that I trust the extension with my data. (0002)
- As a researcher, I want to send highlighted text or a link to my board from any website so that I capture ideas without switching tabs. (0004)
- As a planner, I want a reminder when a note's due time arrives so that timed tasks aren't missed. (0004)

**Acceptance criteria index**: AC-1 to AC-6 in 0002 · AC-7 to AC-15 in 0003 · AC-16 to AC-21 in 0004.

## Decision

**Chosen option**: a local first Manifest V3 extension built with WXT, with the new tab page as the only UI surface and a background service worker (a script Chrome runs on demand, without a visible page) for capture, reminders and cleanup.

## Cross child contract: data model

This is the confirmed target model. Every child reads and writes only these shapes, and only through the storage layer in 0002.

**`chrome.storage.local`**

| Key | Entity | Fields |
|---|---|---|
| `note:<id>` | **Note** | `id` (string, `crypto.randomUUID()`) · `title` (string, required, 1 to 200 chars) · `description` (string, max 5,000 chars, default `''`) · `isCompleted` (bool) · `dateStr` (`YYYY-MM-DD`, in the settings timezone) · `noteColor` (one of the 8 presets, picked at random on creation, see 0003) · `subtasks` (array of `{ id, title, isCompleted }`, max 50) · `dueTime?` (`HH:MM`) · `positionX`, `positionY` (px on the board; set when the note is created) · `z` (number, stacking order; raised only when the note is created or moved) · `remind` (bool, default false; only acts when `dueTime` is set) · `remindedAt?` (ISO; set when its reminder or missed summary fired) · `source?` (`{ url, title }`, http or https only) · `carriedFromId?` (id of the note this is a carry over copy of) · `carriedToDate?` (`YYYY-MM-DD` the note was carried to) · `deletedAt?` (ISO; set means it's in Trash) · `createdAt`, `updatedAt` (ISO) |
| `meta` | **Meta** (one record) | `schemaVersion` (number, starts at 1) · `onboardedAt?` (ISO) · `lastCarryOverPromptDate?` (`YYYY-MM-DD`) |

**`chrome.storage.sync`**

| Key | Entity | Fields |
|---|---|---|
| `settings` | **Settings** | `theme` (`dark` default \| `light` \| `midnight` \| `cork` \| `system`) · `handwritingFont` · `soundEnabled` (default true; page sounds only, never notifications) · `timezone` (`'auto'` default, resolved on each computer from `Intl.DateTimeFormat().resolvedOptions().timeZone`, or an IANA zone the user picked; never a resolved zone stored on the user's behalf, so a synced value can't shift another computer's "today") · `startOfWeek` (0 \| 1) |

**Relationships**: a Note embeds many Subtasks (1:N, stored inside the note). A Note may point to one earlier Note through `carriedFromId` (N:1). A "day" is not stored; it is the set of notes sharing a `dateStr`.

**Changes from today's `Todo` type**: removed `userId`, the grid order, `priority`, `category`, `estimatedMinutes`, `isPinned` and `isFavorite`, and the `boardLayout`, `accentColor`, `defaultPriority` and `stickyColorMode` settings (the UI simplification removed everything that set or used them). Every note is a fixed 220 × 220 px, so there is no size field. Added `z`, `remind`, `remindedAt`, `source`, `carriedFromId`, `carriedToDate`, `deletedAt`. `remindedAt` was added while writing this spec so a reminder is never announced twice (see 0004). `User`, `ActivityLog`, `DashboardStats` and `StreakStats` are deleted.

**Shared invariants**
- Only the storage layer (`src/lib/storage/`) calls `chrome.storage`. The new tab page and the background worker both import it.
- "Active note" means `deletedAt` is unset. Every view except Trash shows active notes only.
- "Today" is always `todayInTz(resolveTz(settings.timezone))`, in the page and in the background worker alike. Changing the timezone moves "today" but never rewrites stored `dateStr` values.
- Every write goes through `notes.patch` (read the latest copy, merge only the changed fields) and sets `updatedAt` to now. `remindedAt` is written only by the background worker; `carriedToDate` only by the carry over action.
- Note text is rendered as text, never as HTML. Only `http:` and `https:` URLs become links.

## Build plan

Build approach: none recorded in the project, so this follows **Tracer Bullet** (a thin version working end to end through every layer first, then thickened). Each slice ends with a loadable unpacked extension.

1. [x] **Thread through every layer**: move the app onto WXT with a `newtab` entrypoint and an empty `background` entrypoint, per 0001. Build the storage layer (notes, meta, settings) per 0002 and rewire `StickyBoardContext` onto it, keeping its function signatures. Replace the sidebar with the top bar and the shared drawer shell, and delete everything on 0003's deleted list (landing, auth, sidebar, filters, quick add, Tidy, grid, focus, analytics, mock data, AI briefing). Satisfies **AC-1**, **AC-7**, **AC-15**.
2. [x] **Live and safe storage**: `notes.patch` (read, merge changed fields, write), storage change subscriptions across tabs that ignore stale echoes, the last saved snapshot per note, and an error toast that rolls back a failed write. Satisfies **AC-2**, **AC-6**.
3. [x] **Settings and themes**: settings in `chrome.storage.sync` with a debounced write, the five themes as token sets, follow system, and the no flash first paint. Satisfies **AC-3**, **AC-9**.
4. [x] **Welcome screen**. Satisfies **AC-8**.
5. [x] **Notes**: the fixed 220 × 220 card with inner scrolling, drag from the body, stacking by `updatedAt`, clamping, blank note creation with the first free spot and the random color rule, the simplified editor modal, clickable links and the source link. Satisfies **AC-10**, **AC-11**, **AC-12**.
6. [x] **Trash**: soft delete, the Trash drawer, restore, delete forever, empty trash, and the background purge alarm. Satisfies **AC-4**.
7. [x] **Carry over prompt and midnight rollover** (lock across tabs, copy rules, midnight timer). Satisfies **AC-13**.
8. [x] **Search** across all days, from the top bar icon and ⌘K, plus the Calendar drawer. Satisfies **AC-14**, **AC-15**.
9. [x] **Export and import**. Satisfies **AC-5**.
10. [x] **Right click capture** for selected text and links. Satisfies **AC-16**, **AC-17**.
11. [x] **Reminders**: the single next due alarm, the reminder check, notifications, click through, and the missed summary. Satisfies **AC-18**, **AC-19**.
12. [x] **Toolbar icon and keyboard shortcut**, then a store ready build: icons, manifest description, a privacy declaration of "no data collected", and `wxt zip`. Check the install prompt warnings on the production zip (dev builds add extra permissions). Satisfies **AC-20**, **AC-21**.

## Consequences

**Positive**
- Zero friction: install, open a new tab, start writing. No server to run or pay for.
- A strong privacy story ("nothing leaves your browser") that sets it apart from account based new tab apps.
- One storage layer serves both the page and the background worker, so later features (side panel, cloud sync) plug into one place.

**Negative / tradeoffs**
- Notes don't follow you to another computer. Export and import is the only way to move them until cloud sync exists.
- Uninstalling the extension deletes all notes. Chrome removes extension storage on uninstall, so the welcome screen and Settings should nudge users toward export.
- Only one extension can own the new tab. Users with Momentum or similar installed get whichever Chrome picks, which can confuse them.
- Fewer controls means fewer ways to organize: no priority, category, color choice or filters. Users who want those must rely on search and their own note placement.
- Deleting focus, analytics, grid, quick add and the sidebar loses working code. Bringing it back means recovering it from git history.
- WXT is still before version 1.0, so minor releases may need small config changes.

**Neutral**
- Vite must move to at least 6.3.4 (WXT's minimum).
- `meta.schemaVersion` starts the migration habit: every future change to stored shapes ships a migration in the background worker's `onInstalled` (update) handler.

## Follow-up

- [ ] No `AGENTS.md` exists yet. Running `/audit` after the WXT move would record the stack and the "only the storage layer touches `chrome.storage`" rule for future builds.
- [ ] Specs for the deferred features, each its own decision: side panel, notes pinned to a URL (needs host permission, which shows a scary install warning), optional cloud sync, rich text and images, archive, and bringing back focus and analytics.
- [ ] Before release, check how Chrome behaves when two extensions both override the new tab page (not confirmed by the research).
- [ ] Rewrite `README.md` for the extension (it still describes the web app, backend roadmap and `STICKY_BOARD_REVIEW.md`, which was deleted).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
