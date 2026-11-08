# 0001. Extension platform: Manifest V3 on WXT

## Summary

The React app is rebuilt as a Chrome extension using WXT, a tool built on Vite that writes the extension manifest (the file telling Chrome what the extension is and may do) from the project's folders. There are two entrypoints: the new tab page, and a background worker for menus, alarms and notifications. The extension asks only for permissions that show at most one install warning, "Display notifications".

## Decision

Manifest V3 (Chrome's current extension format), built with **WXT 0.21.x** and its React module. Chrome only for the first release.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Extension format | Manifest V3 | The only format the Chrome Web Store accepts for new extensions. |
| Build tool | WXT `^0.21.4` + `@wxt-dev/module-react` | Actively maintained (Aug 2026), runs on Vite, generates the manifest, reloads while you code, makes the store zip; a side panel or Firefox build later is a new file, not a rework. |
| UI | React 19 + TypeScript strict + Tailwind v4 + `motion` + `lucide-react` (unchanged) | Already in the repo and working. Tailwind is added through WXT's `vite` config hook with `@tailwindcss/vite`. |
| Bundler | Vite, raised to at least `6.3.4` | WXT's peer requirement. |
| Fonts | Bundled locally with `@fontsource` packages (Inter, Space Grotesk, Caveat, Kalam, JetBrains Mono) | The "no network calls" privacy promise rules out Google Fonts links. Runner up: system fonts only, which loses the handwriting identity. |
| Persistence | `chrome.storage.local` + `chrome.storage.sync` | See 0002. |
| Background | One MV3 service worker (`src/entrypoints/background.ts`) | Context menus, alarms, notifications, trash purge and migrations need code that runs without a page open. |
| Observability | None shipped; `console` warnings only | No tracking was chosen, so nothing leaves the browser. Errors show to the user as toasts. |

**Surfaces**

| Entrypoint | Path | Role |
|---|---|---|
| New tab | `src/entrypoints/newtab/` (`index.html`, `main.tsx`) | The whole app. WXT maps it to `chrome_url_overrides.newtab`. Page `<title>` is "Sticky Board". |
| Background | `src/entrypoints/background.ts` | Registers menus and alarms on `runtime.onInstalled` and `runtime.onStartup`; handles clicks, alarms, notification clicks and the action click. |

No popup, no side panel, no content scripts in this release.

**Manifest permissions** (exactly these)

| Permission | Why | Install warning |
|---|---|---|
| `storage` | Notes, meta, settings | none |
| `unlimitedStorage` | Remove the 10 MB local cap so heavy users never hit it | none |
| `contextMenus` | Right click capture | none |
| `activeTab` | Read the clicked tab's title for a capture's source | none |
| `alarms` | Reminders and the daily trash purge | none |
| `notifications` | Reminder notifications | "Display notifications" |

This list applies to the production build (`wxt build` / `wxt zip`); WXT's dev server adds permissions for hot reload, which is expected. No host permissions and no `tabs` permission. Finding an open board tab uses `chrome.runtime.getContexts` (Chrome 116 or later), which lists the extension's own pages without extra permission. Set `minimum_chrome_version` to `"116"`.

**Manifest identity** (set in `wxt.config.ts` `manifest`): `name` "Sticky Board", a one line `description`, `icons` at 16, 32, 48 and 128 px (from `public/icon/`), and `action: { default_title: "Open Sticky Board" }` with no popup. The `action` key must be declared explicitly, because WXT emits it only for a popup entrypoint, and both the icon click and the shortcut need it.

**Incognito**: not supported (`incognito` left at its default); the new tab override does not apply there.

**Commands**: `_execute_action` with suggested key `Alt+Shift+S` (the user can change it at `chrome://extensions/shortcuts`).

**Project layout**: WXT `srcDir: 'src'`. Existing `src/components`, `src/lib`, `src/types.ts` and `src/index.css` stay where they are. The root `index.html`, `src/main.tsx` and `vite.config.ts` are replaced by the entrypoint and `wxt.config.ts`. Scripts: `dev` → `wxt`, `build` → `tsc --noEmit && wxt build`, `zip` → `wxt zip`, `lint` unchanged.

**Security**: the default MV3 content security policy (scripts only from the extension itself). No remote code, no `eval`, no network requests anywhere.

## Rationale (short)

WXT over the CRXJS plugin (the runner up, v3.0, Sept 2026): CRXJS keeps today's Vite config, but you write and maintain the manifest and the background wiring yourself, and the planned side panel and possible Firefox build cost more later. Plasmo was ruled out because it has had no release since May 2025. Plain Vite has no extension reload while developing. Full comparison in [rationale.md](rationale.md).
