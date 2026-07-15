# StickyBoard — Backend Handoff & API Specification

> **Purpose of this document:** This repo is now a **frontend-only** React application running on dummy data. This file is the complete contract for building the **Node.js / Express** backend in a separate codebase. It describes what the app does, every data model, every API endpoint the frontend expects, the auth flow, business rules, and exactly where the frontend must be re-wired once the backend exists. Treat the request/response shapes here as the source of truth — the frontend types in [`src/types.ts`](src/types.ts) mirror them.

---

## 1. What StickyBoard Is

StickyBoard is a **tactile daily planner / todo SaaS**. Tasks are rendered as physical-feeling sticky notes pinned to a virtual corkboard, with push-pin drop/pop animations, confetti on completion, and synthesized interaction sounds.

### Core product concepts

1. **Daily isolation** — Every todo belongs to exactly one calendar date (`dateStr`, format `YYYY-MM-DD`, in the user's local timezone). Each day is an isolated board; past days stay frozen and are browsable via the Calendar view. The board "resets" at midnight simply because the frontend fetches todos filtered by the current date.
2. **The Board** — Sticky-note CRUD: create (manual form or AI natural-language parse), inline edit (double-click), complete, delete, duplicate, pin, favorite, subtasks, priorities (`low | medium | high | critical`), categories (`Personal | Work | Health | Finance | Urgent`), 8 note colors, optional due time and estimated minutes. Two layout modes: **freeform** (drag notes anywhere; `positionX`/`positionY` persisted per note) and **grid** (drag-to-reorder; order persisted via a reorder endpoint).
3. **Calendar** — Month grid showing per-day task density (completed vs pending); clicking a day navigates the board to that date.
4. **Analytics** — Completion rate, totals, daily habit streak (current + longest), category distribution, weekly activity bars, completion heatmap.
5. **Focus Mode** — Client-side Pomodoro timer (25/50 min work, 5/15 min break) with ambient synth audio. **No backend involvement.**
6. **Settings** — User preferences (accent color, handwriting font toggle, sound toggle, timezone, start of week, default priority, sticky color mode). Persisted per user.
7. **AI assistance (Gemini, proxied through the backend)** — (a) parse a natural-language sentence into a structured todo; (b) generate a short motivational morning briefing / evening reflection based on the day's tasks.
8. **Auth** — Email/password register + login, Google OAuth, GitHub OAuth (popup flow), guest demo mode (frontend-only, no backend).

---

## 2. Architecture (target state)

```
┌──────────────────────────┐        ┌───────────────────────────────┐
│  Frontend (this repo)    │        │  Backend (new repo)           │
│  React 19 + Vite + TW v4 │  HTTP  │  Node.js + Express            │
│  - StickyBoardContext    │──────► │  - REST API under /api/*      │
│    owns ALL server calls │        │  - Auth (tokens/JWT)          │
│  - localStorage token    │        │  - DB (your choice)           │
│  - optimistic updates    │        │  - Gemini proxy (@google/genai)│
└──────────────────────────┘        │  - Google/GitHub OAuth        │
                                    └───────────────────────────────┘
```

- The frontend calls **relative paths** (`/api/...`). During development, add a Vite proxy in `vite.config.ts`:
  ```ts
  server: { proxy: { '/api': 'http://localhost:3000' } }
  ```
  (or enable CORS on the backend and use an absolute base URL). The proxy approach is recommended — it matches the original same-origin design and keeps OAuth redirect handling simple.
- **All state flows through one file:** [`src/lib/StickyBoardContext.tsx`](src/lib/StickyBoardContext.tsx). Every function that currently mutates local dummy state is marked with `// TODO(backend):` and lists the exact endpoint to call. No component talks to the network directly — re-integration means editing only this file (plus the OAuth handlers in `AuthModal.tsx`).

### Auth/session mechanics the frontend expects

- On login/register the backend returns `{ token, user }`. The frontend stores the token in `localStorage` under the key **`stickyboard_token`** and sends it on every request as `Authorization: Bearer <token>`.
- On app load, the frontend calls `GET /api/auth/me` with the stored token; `200 → { user }` restores the session, `401/403` clears the token.
- Error responses are always `{ "error": "<human readable message>" }` with an appropriate 4xx/5xx status.

---

## 3. Data Models

These mirror [`src/types.ts`](src/types.ts). The backend owns `id`, `userId`, `createdAt`, `updatedAt` and any private fields (password hash, salt, session tokens) — private fields must **never** be returned to the client.

### User (public shape returned to client)
```jsonc
{
  "id": "uuid",
  "email": "user@example.com",     // stored lowercase, unique
  "name": "Sarah Miller",
  "createdAt": "ISO-8601",
  "preferences": { /* UserPreferences */ }
}
```

### UserPreferences (defaults shown)
```jsonc
{
  "theme": "dark",                 // 'dark' | 'light'
  "accentColor": "#f43f5e",        // hex string
  "handwritingFont": true,
  "soundEnabled": true,
  "timezone": "America/New_York",  // IANA tz — better default: derive from client
  "startOfWeek": 1,                // 0 = Sunday, 1 = Monday
  "defaultPriority": "medium",     // Priority
  "stickyColorMode": "auto"        // 'auto' | 'manual'
}
```

### Todo
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "title": "string (required)",
  "description": "string ('' allowed)",
  "isCompleted": false,
  "dateStr": "YYYY-MM-DD",         // the day this note belongs to (user-local)
  "priority": "low|medium|high|critical",
  "category": "Personal|Work|Health|Finance|Urgent", // free string, these are the presets
  "noteColor": "yellow|blue|green|pink|purple|orange|mint|cream",
  "subtasks": [ { "id": "uuid", "title": "string", "isCompleted": false } ],
  "dueTime": "HH:MM",              // optional
  "estimatedMinutes": 60,          // optional number
  "isPinned": false,
  "isFavorite": false,
  "positionX": 40,                 // optional — freeform board coordinates (px)
  "positionY": 40,                 // optional
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### StreakStats
```jsonc
{ "currentStreak": 0, "longestStreak": 0, "lastCompletedDate": "YYYY-MM-DD | null" }
```

### ActivityLog (internal; original app wrote these on create/delete but never exposed them — an endpoint like `GET /api/activity` is a nice-to-have)
```jsonc
{ "id": "uuid", "userId": "uuid", "action": "create_todo|delete_todo|...", "details": "string", "createdAt": "ISO-8601" }
```

---

## 4. API Contract

All endpoints are JSON. All except registration/login/OAuth require `Authorization: Bearer <token>`; missing token → `401 { error }`, invalid token → `403 { error }`.

### 4.1 Auth

| # | Method & Path | Body / Query | Success response |
|---|---|---|---|
| 1 | `POST /api/auth/register` | `{ email, password, name }` | `201 { token, user }` |
| 2 | `POST /api/auth/login` | `{ email, password }` | `200 { token, user }` |
| 3 | `GET /api/auth/me` | — | `200 { user }` |
| 4 | `PUT /api/auth/preferences` | partial `UserPreferences` | `200 { preferences }` (full merged object) |

Rules:
- Register: 400 if any field missing; 400 `"Email is already registered"` on duplicate (case-insensitive).
- On register, **seed the new user** with: an initialized streak record and two starter todos dated today (a "Welcome to StickyBoard!" high-priority yellow pinned note with 2 subtasks, and a "Complete this task to see the pin animation" critical pink favorite note). Same seeding applies to first-time OAuth users.
- Login: 401 `"Invalid email or password"` for both unknown email and bad password (don't leak which).
- Preferences update in the original blindly merged `req.body` — the new backend should **whitelist** the known preference keys.

### 4.2 OAuth (Google & GitHub — popup flow)

| # | Method & Path | Notes |
|---|---|---|
| 5 | `GET /api/auth/google/url?origin=<window.location.origin>` | Returns `{ url }` — the Google consent URL with `redirect_uri = <origin>/api/auth/google/callback`, scope `openid email profile` |
| 6 | `GET /api/auth/google/callback?code=...` | Exchanges code, fetches userinfo, upserts user, returns an **HTML page** that runs `window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token }, '<expected frontend origin>')` then `window.close()` |
| 7 | `GET /api/auth/github/url?origin=...` | Same pattern; scope `read:user user:email`, include a `state` param (and **verify it** in the callback — the original generated but never validated it) |
| 8 | `GET /api/auth/github/callback?code=...` | GitHub emails may be private → fall back to `GET /api/github/user/emails` and pick primary+verified |

Frontend side of the flow (to restore in `AuthModal.tsx`, currently mocked): open the returned `url` in a centered popup, listen for the `message` event, validate `event.origin`, then call `loginWithOAuthToken(token)` which stores the token and triggers `GET /api/auth/me`.

> ⚠️ The original implementation posted the token with target origin `'*'` and the frontend accepted messages from any `*.run.app` origin. The new backend must post to the **exact** app origin, and the frontend listener should compare `event.origin === window.location.origin`.

### 4.3 Todos

| # | Method & Path | Body / Query | Success response |
|---|---|---|---|
| 9 | `GET /api/todos` | query: `dateStr`, `category`, `priority`, `status` (`completed`\|`pending`), `search` (title+description, case-insensitive), `isPinned`, `isFavorite` (booleans as `"true"/"false"`) — all optional, ANDed | `200 { todos: Todo[] }` |
| 10 | `POST /api/todos` | `{ title*, description?, dateStr?, priority?, category?, noteColor?, dueTime?, estimatedMinutes?, subtasks?: [{title, isCompleted}], positionX?, positionY? }` | `201 { todo }` |
| 11 | `PUT /api/todos/reorder` | `{ orderedIds: string[] }` — persist this as the user's todo ordering; ids not in the list keep relative order at the end | `200 { success: true }` |
| 12 | `PUT /api/todos/:id` | any subset of: `title, description, priority, category, noteColor, dueTime, estimatedMinutes, isPinned, isFavorite, isCompleted, dateStr, positionX, positionY, subtasks` | `200 { todo }` (full updated object) |
| 13 | `DELETE /api/todos/:id` | — | `200 { success: true, message }` |
| 14 | `POST /api/todos/:id/duplicate` | — | `201 { todo }` — copy with new id, title suffixed `" (Copy)"`, `isCompleted: false`, fresh subtask ids all unchecked. (Improvement: offset `positionX/Y` slightly so the copy doesn't stack exactly on the original.) |

Rules:
- **Ownership isolation is mandatory**: every query/update/delete must be scoped to the authenticated `userId`. `:id` not found *for this user* → `404 { error: "Sticky note not found" }`.
- `POST` defaults: `description: ''`, `dateStr: today`, `priority: 'medium'`, `category: 'Personal'`, `isPinned/isFavorite: false`.
- **Auto color assignment**: if `noteColor` is missing or not one of the 8 presets, derive from priority: `critical → pink`, `high → orange`, `medium → yellow`, else `green`.
- On `PUT` with `subtasks`, incoming subtasks keep their `id` if provided, otherwise get a new uuid.
- When a todo transitions to `isCompleted: true`, update the user's **streak** (see §5) and bump `updatedAt`.
- **Important ordering note:** the frontend appends the `PUT /api/todos/reorder` order and also saves freeform coordinates via `PUT /api/todos/:id { positionX, positionY }`. `GET /api/todos` must return todos in the persisted order.

### 4.4 Analytics

| # | Method & Path | Success response |
|---|---|---|
| 15 | `GET /api/analytics/summary` | `200` with the `DashboardStats` shape below |

```jsonc
{
  "completionRate": 62,                       // % across ALL of the user's todos
  "totalCompleted": 31,
  "totalPending": 19,
  "streak": { "currentStreak": 3, "longestStreak": 7, "lastCompletedDate": "2026-07-15" },
  "categoryDistribution": [                   // count per category, with display color
    { "name": "Work", "value": 12, "color": "#3b82f6" }
  ],
  "weeklyActivity": [                         // 7 entries, Sun..Sat
    { "day": "Mon", "completed": 3, "pending": 1 }
  ],
  "heatmap": { "2026-07-14": 2, "2026-07-15": 4 }  // completed count per dateStr
}
```

Category display colors: `Work #3b82f6`, `Urgent/Critical #ef4444`, `Finance #f59e0b`, `Health #ec4899`, everything else `#10b981`.

> The original computed `weeklyActivity` from `createdAt` day-of-week (and admitted in a comment it was mock-ish). The correct implementation should bucket by `dateStr` for the **current week**, respecting the user's `startOfWeek` preference.

### 4.5 AI (Gemini proxy)

The backend holds the `GEMINI_API_KEY` (env var) and uses `@google/genai`. The key is never exposed to the client. If no key is configured: `parse` → `503 { error: "AI service currently offline..." }`; `briefing` → `200` with a friendly static fallback string.

| # | Method & Path | Body | Success response |
|---|---|---|---|
| 16 | `POST /api/gemini/parse` | `{ prompt, timezone }` | `200 { result: { title, description?, priority, category, dueTime?, estimatedMinutes?, dateOffset } }` |
| 17 | `POST /api/gemini/briefing` | `{ dateStr, type: 'morning' \| 'evening' }` | `200 { briefing: "string" }` |

**Parse** (model used originally: `gemini-3.5-flash`, JSON-schema constrained output): extract `title` (polished, emojis ok), `description`, `priority` (infer from urgency words), `category` (one of the 5 presets, default Personal), `dueTime` `HH:MM` 24h, `estimatedMinutes`, and `dateOffset` (integer days from today; "tomorrow" = 1). Required: `title, priority, category, dateOffset`. The frontend converts `dateOffset` into a target `dateStr` before creating the todo.

**Briefing**: build a checklist string of the day's todos (`- [x] Title (priority, category)`), ask for a warm 3–4 sentence first-person morning briefing or evening reflection, 1–2 emojis, no markdown headers. On Gemini error return `200` with a static fallback message (the UI just renders the string).

---

## 5. Business Rules

### Streak calculation
Kept per user: `{ currentStreak, longestStreak, lastCompletedDate }`. On each todo completion with date `dateStr`:
- First ever completion → streak = 1.
- If `dateStr` is exactly 1 day after `lastCompletedDate` → increment `currentStreak`, update `longestStreak = max(...)`.
- If the gap is > 1 day → reset `currentStreak = 1`.
- Same-day completions don't increment.

> ⚠️ Original bug to avoid: it used `Math.abs(diff)` + `Math.ceil`, so completing a todo on a **past** date (or un/re-checking) could bump the streak. Compare calendar dates directionally and ignore non-forward completions.

### Dates & timezones
`dateStr` is a plain `YYYY-MM-DD` in the **user's local timezone** — the backend should treat it as an opaque day key and never convert it through UTC. (Original bug: both client and server used `new Date().toISOString().split('T')[0]`, which is the UTC date and is wrong for users west of UTC after ~evening. The frontend now computes local dates correctly; the backend should let the client supply `dateStr` and only fall back to server-side "today" when absent.)

---

## 6. Recommended Backend Stack & Hardening

The user has chosen **Node.js + Express**. Recommendations beyond parity with the original:

- **DB**: anything with a per-user index on todos (`userId + dateStr`). SQLite/Postgres via Prisma or Drizzle is a good fit; the original was a single `data/db.json` file — do not replicate that.
- **Auth**: JWT (or opaque tokens in a sessions table) **with expiry + refresh**. Original used a single non-expiring random token stored in plaintext on the user record — a second login invalidated all other devices and any DB leak leaked live sessions.
- **Passwords**: bcrypt/argon2. Original used PBKDF2 with only 1,000 iterations (far too low).
- **Validation**: zod/express-validator on every body/query (original had almost none — e.g. preferences mass-assignment, unvalidated subtask shapes).
- **Security middleware**: helmet, CORS locked to the app origin, rate limiting on auth + AI endpoints (Gemini calls cost money), request size limits.
- **OAuth**: validate `state`, use exact-match redirect URIs, post tokens to the exact origin (see §4.2 warning).
- Never seed/echo secrets in HTML responses; escape anything interpolated into the OAuth callback page.

---

## 7. Frontend Re-integration Checklist (for this repo, once the backend is live)

1. Add the Vite dev proxy (`/api` → backend) or a `VITE_API_BASE_URL`.
2. In [`src/lib/StickyBoardContext.tsx`](src/lib/StickyBoardContext.tsx), replace each `// TODO(backend):`-marked mock mutation with the corresponding `fetch` call from §4 (the original fetch implementations are documented inline). Restore the token bootstrap: read `stickyboard_token`, call `GET /api/auth/me` on mount.
3. In [`src/components/AuthModal.tsx`](src/components/AuthModal.tsx), replace the mocked Google/GitHub handlers with the popup + `postMessage` flow (§4.2) and re-add the origin-validated `message` listener.
4. Keep the optimistic-update pattern: update/delete/reorder mutate local state first and roll back if the request fails.
5. Keep guest demo mode as-is (pure client-side, no network).

---

## 8. Known Issues / Things That Were Not Well Done (carried over from the original codebase)

These were found during the review; fix them in the backend (and a few remain as frontend polish items):

**Security (backend — must fix, do not replicate):**
1. `firebase-applet-config.json` with a live Google API key + OAuth client id was committed to git history — **rotate those credentials**; the file has been deleted.
2. Plaintext session tokens with no expiry stored on the user record (see §6).
3. PBKDF2 @ 1,000 iterations; OAuth `state` never validated; `postMessage(…, '*')`; preferences mass-assignment; no rate limiting/validation anywhere; Gemini errors leaked internal `err.message` to clients.

**Correctness bugs in the original logic:**
4. UTC/local date mismatch everywhere (`toISOString().split('T')[0]`) — fixed on the frontend in this pass; keep the backend timezone-safe (§5).
5. Streak logic increments on past-dated or repeated completions (§5).
6. `weeklyActivity` computed from `createdAt` weekday over **all time**, not the current week's `dateStr` (§4.4), and ignores `startOfWeek`.
7. Duplicated notes copy exact `positionX/Y` and stack invisibly on the original.
8. Un-completing a todo never decremented any stats/streak.

**Frontend polish / not yet implemented (candidates for future work):**
9. Preferences `theme`, `accentColor`, `timezone`, `startOfWeek`, `defaultPriority`, and `stickyColorMode` are persisted but **not actually applied** anywhere in the UI (the app is dark-only, accent is hardcoded indigo, calendar always starts Sunday).
10. Landing page FAQ promises features that don't exist: Cmd/Ctrl+K command palette, keyboard navigation, offline persistence for guest mode.
11. Calendar shows **hash-generated fake densities** for any day other than the currently loaded one (only the active day uses real data) — with a real backend, drive it from `GET /api/analytics/summary` heatmap + a ranged todos query.
12. `estimatedMinutes` is captured by the form/AI parse but never displayed on notes; Focus Mode is not linked to todos.
13. `activityLogs` were written on create/delete but no endpoint ever exposed them.
14. `AnalyticsView` heatmap data is returned by the API but never rendered.