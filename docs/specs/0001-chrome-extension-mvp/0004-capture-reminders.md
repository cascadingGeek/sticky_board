# 0004. Right click capture, reminders and the toolbar icon

## Summary

The background worker adds two right click menu items, "Send selection to Sticky Board" and "Save link to Sticky Board", which put a note on today's board with a link back to the page. Notes with a due time can have a bell turned on, and Chrome then shows a notification at that time. Reminders missed while Chrome was closed come back as one summary. Clicking the toolbar icon, or pressing Alt+Shift+S, opens or focuses the board.

## Requirements

**User stories**
- As a researcher, I want to send highlighted text or a link to my board from any site so that I capture it without leaving the page.
- As a planner, I want a notification when a timed note is due so that I don't miss it.

**Acceptance criteria**
- **AC-16**: Right clicking selected text shows "Send selection to Sticky Board". Clicking it creates a note on today's board: title is the first non empty line of the selection (whitespace collapsed) cut to 80 characters, description is the full selection cut to 5,000 characters, `source` is the page URL and title, color per the random rule in 0003. It works with no board tab open, and open board tabs show the note live.
- **AC-17**: Right clicking a link shows "Save link to Sticky Board". Clicking it creates a note on today's board: title is the selected text if any, otherwise the link's host plus path cut to 80 characters (or "Saved link" when the link isn't http or https); description is the link URL; `source` is the page it was found on; color per the random rule in 0003.
- **AC-18**: A note with a `dueTime` shows a bell toggle. With the bell on and Chrome running, a notification appears at `dateStr` + `dueTime` in the resolved timezone (within about 30 seconds) showing the note title, and it stays on screen until dismissed or clicked. Clicking it opens or focuses the board on that note's day. Completing, deleting, or turning off the bell stops it; changing the date or time reschedules it.
- **AC-19**: Reminders that came due while Chrome was closed (due within the last 7 days, not completed, not deleted, bell on, not yet reminded) produce exactly one summary notification when Chrome next runs ("You missed 2 reminders", listing up to 3 titles; "1 reminder" when singular). Clicking it opens today's board. Each reminder is reported once, never both individually and in the summary.
- **AC-20**: Clicking the toolbar icon, or pressing Alt+Shift+S, focuses an open board tab if one exists, otherwise opens a new one.
- **AC-21**: Installing the production zip shows no warning other than "Display notifications", and its manifest has no host permissions.

## Decision

All of this lives in `src/entrypoints/background.ts`, writing notes only through the storage layer (0002). Reminders use **one alarm, set for the next due reminder**, plus a single reminder check that handles on time and missed reminders alike.

## Design

**Context menus** (registered on `onInstalled` with `removeAll` first)

| id | contexts | Title |
|---|---|---|
| `send-selection` | `selection` | Send selection to Sticky Board |
| `save-link` | `link` | Save link to Sticky Board |

**Captured note defaults**: `id` from `crypto.randomUUID()`; `dateStr` today; `isCompleted` false; `subtasks` []; `remind` false; no `dueTime`; position = the first free cell scanning from the board's top left with a 1280 px assumed width (the worker can't see a screen), and `z` = the day's highest + 1; the whole creation runs inside the `note-create` lock (Web Locks work in service workers); `createdAt` and `updatedAt` now. If the selection trims to nothing, the title is the page's host.

**Alarms**

| Name | When | Purpose |
|---|---|---|
| `reminders` | The earliest future due time among reminder notes; cleared when there is none | Wakes the worker to run the reminder check. |
| `purge-trash` | Every 24 h (`periodInMinutes: 1440`) | Trash purge (0002). |

**Reminder notes** = active notes with `remind` on, `dueTime` set, `!isCompleted`, and no `remindedAt`. Due time = `zonedToEpoch(dateStr, dueTime, resolveTz(settings.timezone))`.

**Reminder check** (one function; runs every time the worker starts, when the `reminders` alarm fires, and when notes or settings change through `onChanged`):
1. Load reminder notes. Split them: **missed** = due more than 2 minutes ago and within the last 7 days; **due now** = due in the last 2 minutes or exactly now; older than 7 days = ignored.
2. Set `remindedAt = now` on all missed and due now notes in one `putMany` **before** showing anything, so a second run can't announce them again.
3. One notification per due now note (id `remind:<noteId>`). If any are missed, one summary notification (id `missed`).
4. Reset the `reminders` alarm to the next future due time (or clear it).

Because this runs on every worker start, it covers Chrome starting, the extension being installed, updated or reloaded, and the computer waking from sleep. On each start the worker also makes sure the `purge-trash` alarm exists. All listeners are registered at the top level of the worker file, so Chrome can wake it for any event. On a `notes` change the check reads only what it needs: it can skip work when the changed keys contain no reminder related fields.

Changing `dateStr` or `dueTime` in the UI also clears `remindedAt` (in the same `patch`), so an edited note can remind again. The board never touches alarms.

**Notifications**: `type: 'basic'`, `iconUrl` the packaged 128 px icon, title "Sticky Board", message = the note title (or the summary text), `requireInteraction: true`. On click: clear the notification, then open the board. `soundEnabled` does not apply to notifications.

**Opening the board** (icon click, shortcut, notification click):
1. `chrome.runtime.getContexts({ contextTypes: ['TAB'] })`, keeping contexts whose `documentUrl` starts with `chrome.runtime.getURL('newtab.html')`. (The address bar shows `chrome://newtab/` but `documentUrl` is the extension URL; confirm this during the build.)
2. If there is one or more, take the first, call `tabs.update(tabId, { active: true })` and `windows.update(windowId, { focused: true })`, then `tabs.sendMessage(tabId, { type: 'go-to-date', dateStr })`, catching the "Receiving end does not exist" error.
3. Otherwise `tabs.create({ url: chrome.runtime.getURL('newtab.html') + '#date=' + dateStr })`.
For a notification click the date is the note's `dateStr` (today if the note no longer exists); for the summary, the icon and the shortcut, it's today.

**Value sourcing**

| Action | Value | Source |
|---|---|---|
| Capture | note `dateStr` | `todayInTz(resolveTz(settings.timezone))`, settings read from `chrome.storage.sync` in the worker |
| Capture | selection text | `info.selectionText` |
| Capture | link URL | `info.linkUrl` |
| Capture | source URL | `info.pageUrl` (the top page, not `info.frameUrl`), kept only if http or https |
| Capture | source title | `tab.title`, readable because of `activeTab` on menu click; `tab` can be missing (for example in the PDF viewer), then the URL's host |
| Capture | color | Random rule in 0003, reading the latest created note's color from storage in the worker |
| Capture | position | unset, so the board auto places it (0003) |
| Reminder | due time | `zonedToEpoch(dateStr, dueTime, tz)`, a new helper in `src/lib/dates.ts` using `Intl.DateTimeFormat` offsets. A time skipped by a daylight saving change moves forward to the next valid minute; a repeated time uses the first occurrence. (Runner up: `date-fns-tz`, not worth a dependency for one function.) |
| Summary | text | count of missed notes, plus up to 3 titles |
| Notification click | target day | `notificationId` → note id → `note.dateStr`; `missed` → today |

**Key invariants**
- The worker keeps no state in variables between events (Chrome stops idle MV3 workers). Everything is read from storage on each event.
- `remindedAt` is written only by the reminder check, always before the notification is shown.
- At most two alarms exist: `reminders` and `purge-trash`.

**Failure cases**
- Selection longer than 5,000 characters: cut, and the description ends with "…".
- Storage write fails in the worker: show a notification "Couldn't save to Sticky Board".
- Notifications turned off in the OS: nothing to detect; no errors are thrown.
- Timezone setting changed: the `settings` change runs the reminder check, which resets the alarm.
- Packed extensions can't fire alarms sooner than 30 seconds ahead, so a reminder set less than 30 seconds out may arrive up to 30 seconds late.

**Critical test scenarios**
- Capture with no board open, then open a new tab: the note is on today with its source link, verifies **AC-16**.
- Set a reminder 2 minutes ahead, wait: notification stays up; click it: board focused on that day, verifies **AC-18**.
- Set a reminder, quit Chrome past the due time, restart: one summary and no separate notification; restart again: nothing, verifies **AC-19**.
- Install the zip from `wxt zip`: only "Display notifications" is listed, verifies **AC-21**.

## Rationale (short)

One alarm for the next due reminder replaced the earlier design of one alarm per note. A single check now covers on time reminders, missed ones, timezone changes and worker restarts, and it can't announce a reminder twice. The bell is opt in per note so a due time can be a plain label. Missed reminders are grouped so a long break doesn't flood notifications. Capture uses `info.pageUrl` and `activeTab` instead of the `tabs` permission, so installing never shows "Read your browsing history".
