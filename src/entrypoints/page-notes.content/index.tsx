/**
 * Page notes content script (spec 0002). Never listed in the manifest: the
 * background registers it at run time for allowed sites, and injects it on
 * demand (activeTab) when you pin or ask to see notes. Top frame only.
 *
 * The UI lives in a closed shadow root on <sticky-board-notes>, so site CSS
 * and scripts can't reach it. It reads storage directly and sends every
 * write to the background.
 */
import { createRoot, type Root } from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { PING_REPLY, type PageCommand, type PageRequest } from '../../lib/pageMessages';
import { createBridge } from '../../pageNotes/bridge';
import { PageNotesApp } from '../../pageNotes/PageNotesApp';
import css from '../../pageNotes/style.css?inline';

interface Instance {
  ctx: ContentScriptContext;
}

// Shared by every copy of this script in the tab. It holds the running copy,
// so a copy left behind by an extension update doesn't block a fresh one.
const GUARD = '__stickyBoardPageNotes';
type GuardWindow = Window & { [GUARD]?: Instance };

const VALIDITY_CHECK_MS = 1000;

export default defineContentScript({
  registration: 'runtime',
  cssInjectionMode: 'manual',
  noScriptStartedPostMessage: true,

  async main(ctx) {
    if (window.top !== window) return;
    const w = window as GuardWindow;
    const running = w[GUARD];
    if (running && running.ctx !== ctx && running.ctx.isValid) return;
    const instance: Instance = { ctx };
    w[GUARD] = instance;

    const bridge = createBridge();

    // Messages from the background. Registered before anything async, so a
    // message sent right after injection is never missed.
    const onMessage = (msg: unknown, _sender: unknown, reply: (r: unknown) => void) => {
      const m = msg as PageCommand;
      if (m?.type === 'page-notes/ping') reply(PING_REPLY);
      else if (m?.type === 'page-notes/new-draft') bridge.emit({ type: 'new-draft', via: m.via });
      else if (m?.type === 'page-notes/access') bridge.emit({ type: 'access', allowed: m.allowed });
      return false;
    };
    chrome.runtime.onMessage.addListener(onMessage);

    // The last right click spot, for "Pin a note here" on an allowed site.
    ctx.addEventListener(window, 'contextmenu', e => bridge.setContextSpot((e as MouseEvent).pageX, (e as MouseEvent).pageY), { capture: true });
    // Single page apps (AC-14) and the back button cache (fresh notes on return).
    // The event fires before location.href changes, so pass on its new address.
    ctx.addEventListener(window, 'wxt:locationchange', e => bridge.emit({ type: 'location', href: e.newUrl.href }));
    ctx.addEventListener(window, 'pageshow', e => {
      if ((e as PageTransitionEvent).persisted) bridge.emit({ type: 'reload' });
    });

    // After an update or reload of the extension this copy can't save any
    // more: notice it, remove the notes, and step aside (AC-20).
    const check = window.setInterval(() => void ctx.isInvalid, VALIDITY_CHECK_MS);
    ctx.onInvalidated(() => {
      window.clearInterval(check);
      try {
        chrome.runtime.onMessage.removeListener(onMessage);
      } catch {
        // The extension is already gone.
      }
      if (w[GUARD] === instance) delete w[GUARD];
    });

    const send = async <R,>(msg: PageRequest): Promise<R> => {
      try {
        return (await chrome.runtime.sendMessage(msg)) as R;
      } catch (e) {
        void ctx.isInvalid; // a dead extension invalidates the context, which removes the UI
        throw e;
      }
    };

    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'sticky-board-notes',
      mode: 'closed',
      position: 'inline',
      anchor: document.documentElement,
      append: 'last',
      css,
      isolateEvents: ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick'],
      onMount: container => {
        const root = createRoot(container);
        root.render(<PageNotesApp bridge={bridge} send={send} />);
        return root;
      },
      onRemove: root => root?.unmount(),
    });
    if (ctx.isInvalid) return;
    ui.mount();
  },
});
