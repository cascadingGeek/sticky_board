# 📌 StickyBoard

A **tactile daily planner** — your todos are sticky notes pinned to a virtual corkboard, complete with push-pin drop/pop animations, paper-fold shadows, confetti bursts, and synthesized interaction sounds.

## Features

- **Daily-isolated boards** — every note belongs to one calendar date (`YYYY-MM-DD`, local timezone). Each day is a fresh board; past days stay frozen and browsable.
- **The Board** — create notes via a form or a natural-language AI bar ("Review budget tomorrow at 2pm high priority"), double-click to edit inline, complete/delete/duplicate/pin/favorite, subtasks, 4 priorities, 5 category presets, 8 paper colors. Two layouts: **Freeform** (drag notes anywhere, positions persist) and **Grid** (drag to reorder).
- **Calendar** — month view with real per-day completed/pending density; click any day to open its board.
- **Analytics** — completion rate, habit streaks (current/longest), category distribution, weekly activity, all computed from board data.
- **Focus Mode** — Pomodoro timer (25/50 work, 5/15 break) with ambient synth audio, optionally linked to a note from today's board (complete it right from the timer). Fully client-side.
- **Command palette & keyboard shortcuts** — `⌘/Ctrl+K` opens a palette (navigate views, run actions, or type a title to instantly create a note). On the board: `←`/`→` move between days, `T` jumps to today, `N` opens the new-note form.
- **Settings that actually apply** — dark/light theme, accent color (drives the whole accent scale via CSS variables), timezone (controls when "Today" rolls over), week start day (Calendar + weekly analytics), default priority, automatic-vs-manual note colors, handwriting font, and sound effects.
- **Auth screens** — email/password + Google/GitHub buttons (currently mocked; any credentials sign you into a local dummy workspace), plus a guest demo mode.

## Tech Stack

| Layer     | Choice                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| UI        | React 19 + TypeScript (strict)                                                                                          |
| Build     | Vite 6                                                                                                                  |
| Styling   | Tailwind CSS v4 (via `@tailwindcss/vite`) + custom CSS for paper/corkboard textures in [`src/index.css`](src/index.css) |
| Animation | `motion` (Framer Motion successor)                                                                                      |
| Icons     | `lucide-react`                                                                                                          |
| Sound     | Web Audio API (synthesized — no audio assets)                                                                           |

## Getting Started

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

Other scripts: `npm run build` (type-check + production build), `npm run preview`, `npm run lint` (ESLint + tsc).

No environment variables are needed — the app is self-contained until the backend lands.

## Project Structure

```
src/
├── main.tsx                  # Entry point
├── App.tsx                   # Landing page vs dashboard shell + tab routing
├── types.ts                  # Shared domain types (mirror of the API contract)
├── index.css                 # Tailwind theme + sticky-note/corkboard styling
├── lib/
│   ├── StickyBoardContext.tsx  # ⭐ THE data layer. All state, auth, CRUD, stats.
│   │                           #   Every former API call is a local mutation
│   │                           #   marked `TODO(backend)` with its endpoint.
│   ├── mockData.ts             # Dummy user/todos used while the backend is WIP
│   └── dates.ts                # Local-timezone-safe YYYY-MM-DD helpers
└── components/
    ├── LandingPage.tsx       # Marketing page w/ interactive sandbox board
    ├── AuthModal.tsx         # Sign in/up + (mocked) OAuth buttons
    ├── Sidebar.tsx           # Desktop sidebar + mobile bottom nav
    ├── CommandPalette.tsx    # ⌘K palette + global keyboard shortcuts
    ├── DailyBoard.tsx        # The corkboard: notes, filters, AI bar, form modal
    ├── CalendarView.tsx      # Month grid with task densities
    ├── AnalyticsView.tsx     # Stats dashboard
    ├── FocusView.tsx         # Pomodoro timer (linkable to a note)
    └── SettingsView.tsx      # Preferences
```

## Architecture Notes for Developers

1. **Single data layer.** No component makes network calls. Everything goes through `useStickyBoard()` from [`src/lib/StickyBoardContext.tsx`](src/lib/StickyBoardContext.tsx). To integrate the backend, replace the `TODO(backend)`-marked bodies in that file (and the OAuth handlers in `AuthModal.tsx`) — the function signatures are already API-shaped (`Promise<boolean>`, optimistic-update friendly).
2. **API contract.** The full REST spec (endpoints, shapes, auth flow, business rules like streaks and auto note-coloring) lives in [`STICKY_BOARD_REVIEW.md`](STICKY_BOARD_REVIEW.md). The frontend expects the API under the relative path `/api/*` — add a Vite proxy (see the TODO in [`vite.config.ts`](vite.config.ts)) when the backend is running.
3. **Dates are local.** Board dates are plain `YYYY-MM-DD` strings in the user's local timezone. Always use the helpers in [`src/lib/dates.ts`](src/lib/dates.ts) — never `toISOString().split('T')[0]`, which returns the UTC date.
4. **Dummy-data persistence.** The mock session lives in `localStorage` (`stickyboard_user`, `stickyboard_todos`). "Exit Workspace" (logout) clears it. Any email/password signs you in.
5. **Fonts** are loaded from Google Fonts in [`index.html`](index.html) (Inter, Space Grotesk, Caveat, Kalam, JetBrains Mono).

## Theming

The dashboard is themed through semantic color tokens defined in [`src/index.css`](src/index.css) (`bg-app`, `bg-surface`, `bg-panel`, `text-ink`, `border-line`, `bg-accent`, …). Dark values are the defaults; the `light` class on `<html>` (set from the user's `theme` preference) flips them, and `--sb-accent` (set from `accentColor`) drives the whole accent scale via `color-mix`. When adding UI, use the tokens — not hardcoded zinc/indigo classes — so both themes and custom accents keep working. The landing page and auth modal are intentionally dark-only (pre-login, no preferences yet).

## Roadmap

- [ ] Node.js/Express backend (separate repo) — auth, todos, analytics, Gemini proxy, Google/GitHub OAuth
- [ ] Re-wire this frontend to the live API (checklist in `STICKY_BOARD_REVIEW.md` §7)
