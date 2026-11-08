# 0001. Rationale: Sticky Board as a Chrome extension

## Context

> ⚠️ Premise note: The original idea list (rich text and images, notes pinned to URLs, a side panel, cloud sync, archive) spans more decisions than one first release can carry well. Notes pinned to URLs alone need access to every website, which shows the install warning "Read and change all your data on all websites" and hurts installs. This umbrella settles the foundation and a deliberately small first release; the rest are recommended as separate specs (see index Follow-up).

Sticky Board today is a React 19 + Vite web app (about 3,300 lines) that saves a mocked user session in `localStorage`. It was waiting for an Express backend with email and OAuth login that was never built. All data access goes through one file, `src/lib/StickyBoardContext.tsx`, with function signatures shaped like an API.

The goal is a Chrome extension that people install and keep. The closest comparable product, Balance (a new tab todo list, about 40K users and 4.5 stars per search snippets; listing not directly readable), wins on a small daily loop: a fresh list each day, on every new tab, with very little UI. Its install also switches the user's search engine to Bing. Other new tab note extensions store notes in `chrome.storage.sync` and are criticized when its roughly 100 KB limit stops syncing. Momentum style dashboards need an account for sync.

Forces: a solo developer, no backend, an existing working UI, a strong visual identity (corkboard, paper notes, sounds), a wish to keep things simple with dark as the default theme, and Chrome Web Store review, where fewer permissions and no data collection make approval and user trust easier.

## Options considered

### Option 1: Local first extension on WXT, new tab only (chosen)

**Pros**: no server, no login; one storage layer for page and worker; WXT handles the manifest, reload and zip, and makes later surfaces cheap.
**Cons**: notes don't move between computers; uninstall deletes data; WXT is before version 1.0 and you have to adopt its folder layout.

### Option 2: Local first extension on the CRXJS Vite plugin

**Pros**: smallest change to today's Vite setup; v3.0 released Sept 2026.
**Cons**: you hand write the manifest and all background wiring; adding a side panel or a Firefox build later costs more.

### Option 3: Extension with optional sign in and a cloud backend

**Pros**: notes on every computer from day one; a path to paid features.
**Cons**: you build and operate a backend and auth before the first release; a privacy policy and a heavier store review; months before anything ships.

### Option 4: Keep the web app and wrap it as an extension too (both targets)

**Pros**: one codebase reaches web and Chrome.
**Cons**: every feature needs two storage paths and two capability checks; landing and auth stay alive; slower first release for an unproven second channel.

## Rationale

The forces favor shipping fast with no infrastructure: a solo developer, a UI that already works, and a product whose value is the daily new tab loop, which needs no server at all. Option 1 delivers that and keeps a clean seam (the storage layer) where cloud sync can attach later without touching the UI. Option 3 solves a problem (multiple computers) that users only feel after they already like the product, so it waits. Option 4 doubles the work for a channel nobody has asked for.

WXT over CRXJS: both are current, but the roadmap already names a side panel and possibly Firefox, and WXT turns each into a new entrypoint file rather than hand wiring. Plasmo was excluded (no release since May 2025). Plain Vite has no extension reload during development.

Storage: one key per note in `chrome.storage.local` with `unlimitedStorage` avoids the cross tab overwrite problem of a single array and the 100 KB ceiling that hurts sync based competitors (basis: Chrome storage quotas: local 10 MB, sync 100 KB total and 8 KB per item, 120 writes per minute). Settings are tiny, so syncing them gives a "follows me" feel for free.

Differentiation versus Balance: a visual freeform board instead of two lists, a calendar, search across days, carry over offered as a choice rather than forced, right click capture, reminders, themes, and no search engine hijack.

### Update, 2026-10-23: a simpler board

After seeing the first design, you asked for a much calmer screen, closer to Balance. The sidebar became a slim top bar of icons, with Calendar, Trash and Settings in drawers from the right. Filters, quick add and the Tidy button were removed. Notes now share one fixed size and scroll inside, their colors are picked automatically, and the editor keeps only title, details, checklist, day and due time. Priority, category, pin, favorite and accent color went too, since nothing left on screen used them. The local first architecture, storage, capture and reminders are unchanged. Runner ups weighed: a centered modal for the panels (rejected, because long Settings pages would scroll inside a box), and opening the editor for every new note (rejected as slower than typing straight onto a blank note).

## References

**Project sources**
- `src/lib/StickyBoardContext.tsx` (single data layer with API shaped signatures), `src/types.ts`, `README.md`
- `package.json` (React 19, Vite 6.2, Tailwind 4, motion, lucide-react)
- npm registry, checked 2026-10-23: `wxt` 0.21.4 (peer `vite ^6.3.4 || ^7 || ^8`), `@crxjs/vite-plugin` 3.0.0, `plasmo` 0.90.5 (last published May 2025)

**Practices & standards**
- Least privilege permissions for browser extensions (no host permissions, `activeTab` over `tabs`)
- Local first software (data on the device, sync as an optional add on)
- Tracer Bullet delivery (a thin slice working end to end first)
- Balance Chrome Web Store listing (search snippet only, listing not directly verified)

**Links** (web verified)
- chrome.storage API reference: https://developer.chrome.com/docs/extensions/reference/api/storage
- Permissions list and warnings: https://developer.chrome.com/docs/extensions/reference/permissions-list
- Override Chrome pages: https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages
- WXT latest on npm: https://registry.npmjs.org/wxt/latest
