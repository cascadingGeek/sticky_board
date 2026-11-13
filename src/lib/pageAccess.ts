/** Background side of page notes: site access, the content script, and every page write. */
import { resolveTz, todayInTz } from './dates';
import { isPageRequest, PING_REPLY, type HelloReply, type MoveReply, type PageCommand, type PageRequest, type UndoMoveReply, type WriteReply } from './pageMessages';
import { nextPageZ, normalizePageUrl, pageTitleFrom, sanitizePagePatch } from './pageNotes';
import { createPageNote, movePageNoteToBoard, notes, settings, undoMoveToBoard } from './storage';
import { NOTE_COLORS, TITLE_MAX, type NoteColor } from '../types';

const PAGE_SCRIPT_ID = 'page-notes';
const PAGE_SCRIPT_FILE = 'content-scripts/page-notes.js';
export const CANT_NOTE_MESSAGE = "Sticky Board can't add notes on this page.";

/** The access pattern for one site: one exact host (no port), http and https. */
export const siteOrigin = (hostname: string) => `*://${hostname}/*`;

/** The host part used in access patterns (match patterns can't hold a port). */
export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const WEB_ORIGIN = /^(\*|https?):\/\//;

/** Origins Sticky Board may run on, from what Chrome says is granted. */
export const grantedWebOrigins = async (): Promise<string[]> => {
  const { origins = [] } = await chrome.permissions.getAll();
  return origins.filter(o => WEB_ORIGIN.test(o));
};

export interface SiteAccess {
  hosts: string[]; // sites allowed one at a time
  allSites: string[]; // broad grants made in Chrome (shown as "All sites")
}

/** Splits granted origins into single sites and broad grants. */
export const splitOrigins = (origins: string[]): SiteAccess => {
  const hosts: string[] = [];
  const allSites: string[] = [];
  for (const o of origins) {
    const m = o.match(/^\*:\/\/([^/*]+)\/\*$/);
    if (m?.[1]) hosts.push(m[1]);
    else if (WEB_ORIGIN.test(o)) allSites.push(o);
  }
  return { hosts: [...new Set(hosts)].sort(), allSites };
};

// Registration changes run one at a time, so overlapping events can't race.
let registrationChain: Promise<void> = Promise.resolve();

const doSync = async () => {
  const matches = await grantedWebOrigins();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [PAGE_SCRIPT_ID] });
  if (!matches.length) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [PAGE_SCRIPT_ID] });
    return;
  }
  const script = {
    id: PAGE_SCRIPT_ID,
    js: [PAGE_SCRIPT_FILE],
    matches,
    runAt: 'document_idle' as const,
    allFrames: false,
    persistAcrossSessions: true,
  };
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
};

/** Registers the content script for exactly the allowed sites; never with an empty list. */
export const syncRegistration = (): Promise<void> => {
  const run = registrationChain.catch(() => undefined).then(doSync);
  registrationChain = run;
  return run;
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const isRunning = async (tabId: number): Promise<boolean> => {
  try {
    return (await chrome.tabs.sendMessage(tabId, { type: 'page-notes/ping' } satisfies PageCommand, { frameId: 0 })) === PING_REPLY;
  } catch {
    return false;
  }
};

const execute = (tabId: number) =>
  chrome.scripting.executeScript({ target: { tabId }, files: [PAGE_SCRIPT_FILE] });

/**
 * Makes sure the content script runs in the tab's top frame. A running copy is
 * kept so unsaved typing survives. Throws when the page can't take notes.
 */
const ensureScript = async (tabId: number): Promise<void> => {
  if (await isRunning(tabId)) return;
  try {
    await execute(tabId);
  } catch (e) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.status !== 'loading') throw e;
    await delay(500);
    await execute(tabId);
  }
};

const notifyCantNote = () =>
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: 'Sticky Board',
    message: CANT_NOTE_MESSAGE,
  });

/** Right click "Pin a note here" or Alt+Shift+N: show the page's notes plus a new draft. */
export const pinOnTab = async (tab: chrome.tabs.Tab | undefined, via: 'menu' | 'shortcut' | 'show'): Promise<void> => {
  const tabId = tab?.id;
  if (tabId === undefined || tabId < 0 || (tab?.url !== undefined && !normalizePageUrl(tab.url))) {
    notifyCantNote();
    return;
  }
  try {
    await ensureScript(tabId);
    if (via !== 'show') await chrome.tabs.sendMessage(tabId, { type: 'page-notes/new-draft', via } satisfies PageCommand, { frameId: 0 });
  } catch {
    notifyCantNote();
  }
};

/** After a grant in the site access window: register, then draw in the tab that asked. */
const onAccessGranted = async (tabId: number): Promise<void> => {
  await syncRegistration();
  try {
    await ensureScript(tabId);
    await chrome.tabs.sendMessage(tabId, { type: 'page-notes/access', allowed: true } satisfies PageCommand, { frameId: 0 });
  } catch {
    // The tab was closed or moved to a page that can't take notes.
  }
};

/** The page a message came from, checked: our own content script, top frame, an http(s) tab. */
const senderPage = (sender: chrome.runtime.MessageSender): { url: string; title: string; tabId: number } | null => {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.tab.id === undefined || sender.frameId !== 0) return null;
  const url = normalizePageUrl(sender.tab.url ?? sender.url);
  if (!url) return null;
  return { url, title: pageTitleFrom(sender.tab.title), tabId: sender.tab.id };
};

const today = async () => todayInTz(resolveTz((await settings.get()).timezone));

/** Applies one request from a page. The page's address always comes from the sender, never the message. */
export const handlePageRequest = async (msg: PageRequest, sender: chrome.runtime.MessageSender): Promise<HelloReply | WriteReply | MoveReply | UndoMoveReply | { ok: boolean }> => {
  const page = senderPage(sender);
  if (!page) return { error: 'invalid' };

  switch (msg.type) {
    case 'page-notes/hello': {
      const origin = `${new URL(page.url).protocol}//${hostnameOf(page.url)}/*`;
      return { allowed: await chrome.permissions.contains({ origins: [origin] }) };
    }
    case 'page-notes/create': {
      const title = typeof msg.title === 'string' ? msg.title.trim() : '';
      if (!title || title.length > TITLE_MAX || !Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return { error: 'invalid' };
      const color = NOTE_COLORS.includes(msg.color as NoteColor) ? msg.color : undefined;
      const r = await createPageNote({ title, page: { url: page.url, title: page.title }, x: msg.x, y: msg.y, dateStr: await today(), preferredColor: color });
      return r === 'limit' ? { error: 'limit' } : { note: r };
    }
    case 'page-notes/patch':
    case 'page-notes/trash': {
      const current = typeof msg.id === 'string' ? await notes.get(msg.id) : null;
      if (!current || current.deletedAt || current.page?.url !== page.url) return { error: 'gone' };
      let fields: Parameters<typeof notes.patch>[1];
      if (msg.type === 'page-notes/trash') {
        fields = { deletedAt: new Date().toISOString() };
      } else {
        const clean = sanitizePagePatch(msg.fields);
        if (!clean) return { error: 'invalid' };
        fields = clean;
        // A moved note comes to the front of its page.
        if ('positionX' in clean || 'positionY' in clean) fields = { ...clean, z: nextPageZ(await notes.getAll(), page.url) };
      }
      try {
        return { note: await notes.patch(current.id, fields) };
      } catch {
        return { error: 'gone' };
      }
    }
    case 'page-notes/move-to-board': {
      if (typeof msg.id !== 'string' || !msg.id) return { error: 'invalid' };
      try {
        const r = await movePageNoteToBoard(msg.id, page.url);
        return typeof r === 'string' ? { error: r } : { pageId: r.page.id, boardId: r.board.id };
      } catch {
        return { error: 'failed' };
      }
    }
    case 'page-notes/undo-move': {
      if (typeof msg.pageId !== 'string' || !msg.pageId || typeof msg.boardId !== 'string' || !msg.boardId) return { error: 'invalid' };
      try {
        const r = await undoMoveToBoard(msg.pageId, msg.boardId, page.url);
        return typeof r === 'string' ? { error: r } : { ok: true };
      } catch {
        return { error: 'failed' };
      }
    }
    case 'page-notes/open-access': {
      if (msg.host !== hostnameOf(page.url)) return { ok: false };
      const url = chrome.runtime.getURL(`/site-access.html?host=${encodeURIComponent(msg.host)}&tab=${page.tabId}`);
      await chrome.windows.create({ url, type: 'popup', width: 420, height: 460, focused: true });
      return { ok: true };
    }
    default:
      return { error: 'invalid' };
  }
};

/** The background's onMessage listener for page requests and the site access window. */
export const pageMessageListener = (
  msg: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (r: unknown) => void,
): boolean => {
  const m = msg as { type?: string; tabId?: unknown };
  if (m?.type === 'site-access/granted') {
    // Only our own extension page may say a grant happened.
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('/site-access.html')) || typeof m.tabId !== 'number') return false;
    void onAccessGranted(m.tabId).finally(() => sendResponse({ ok: true }));
    return true;
  }
  if (!isPageRequest(msg)) return false;
  handlePageRequest(msg, sender).then(sendResponse, () => sendResponse({ error: 'failed' }));
  return true;
};
