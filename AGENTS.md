# Sticky Board

A Chrome extension: today's sticky notes on every new tab, plus notes pinned on websites. Everything stays in the browser (no account, no server, no network calls).

## Stack

- **Language / Runtime**: TypeScript (strict), Chrome Manifest V3, Chrome 116 or later
- **Framework**: WXT `^0.21` with `@wxt-dev/module-react` (on Vite)
- **Key dependencies**: React 19, Tailwind CSS 4 (`@tailwindcss/vite`), `lucide-react`, `@fontsource` fonts bundled locally
- **Tests**: Vitest, Testing Library, jsdom
- **Package manager**: npm

## Build approach

**Tracer Bullet** (assumed default): vertical end to end slices, thin but complete through every layer.

## Commands

```bash
npm install
npm run dev     # Chrome with the extension loaded and hot reload
npm run build   # type check + production build in .output/chrome-mv3
npm test        # Vitest, once
npm run lint    # ESLint + type check
npm run zip     # store ready zip
```

## Specs

Stored in `docs/specs/NNNN-<feature>/` (`index.md`, `rationale.md`, `verify.md`). The scope is `docs/scope/scope.md`. The code map is [`docs/architecture.md`](docs/architecture.md), the visual rules are [`design.md`](design.md).

## Rules

- Code is grouped by surface: `src/background/`, `src/board/`, `src/pageNotes/`, `src/siteAccess/`. They import from `src/shared/` and never from each other. `src/entrypoints/` only mounts a surface.
- Only `src/shared/storage/` calls `chrome.storage`. Change a note with `notes.patch`; create with `createNote` / `createPageNote`. Creates, moves and restores share the `note-create` lock.
- Settings live in `chrome.storage.sync`, notes and meta in `chrome.storage.local` (one key per note, `note:<id>`).
- Websites never write storage: the content script sends a message and `src/background/pageNotes.ts` checks and writes it. The page address comes from the sender, never the message.
- Days are `YYYY-MM-DD` in the resolved timezone: `todayInTz(resolveTz(settings.timezone))`, never `toISOString()`.
- Style with theme tokens (`bg-panel`, `text-ink`, `border-line`, `bg-accent`), never raw colors.
- Tests live in `tests/`, mirroring `src/`, and import source through `@/` (for example `@/shared/dates`).
- Comments are short (1 to 3 lines) and explain why, not what. No spec or AC numbers in code or tests.
- No network requests, remote code or `eval` anywhere.

## Agent skills

- [chrome-extensions](.agents/skills/chrome-extensions/): `googlechrome/modern-web-guidance`, Manifest V3 APIs, service workers, content scripts, Web Store rules
- [wxt-browser-extensions](.agents/skills/wxt-browser-extensions/): `pproenca/dot-skills`, WXT entrypoints, messaging and performance
- [vitest](.agents/skills/vitest/): `paulrberg/agent-skills`, writing and debugging Vitest unit and component tests
- [tailwind-css](.agents/skills/tailwind-css/): `paulrberg/agent-skills`, Tailwind v4 classes and CSS first config

## Git

- integration: on
- branch prefix: `feat/` for features, `chore/` for cleanup
- commit: manual (the engineer commits, pushes and opens PRs; hand them a ready message)
- No AI attribution in commits or PRs (no `Co-Authored-By` trailer, no "Generated with" line).

## Context files

- [src/shared/storage/AGENTS.md](src/shared/storage/AGENTS.md): locks, save queues, limits and migrations for all storage
- [src/pageNotes/AGENTS.md](src/pageNotes/AGENTS.md): the sealed UI drawn on websites (shadow root, plain CSS, message only writes)
- [tests/AGENTS.md](tests/AGENTS.md): the fake Chrome, test helpers and mocking gotchas

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
