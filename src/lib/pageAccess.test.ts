import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  CANT_NOTE_MESSAGE,
  handlePageRequest,
  pageMessageListener,
  pinOnTab,
  splitOrigins,
  syncRegistration,
} from './pageAccess';
import { PING_REPLY } from './pageMessages';
import { installFakeChrome, type FakeChrome } from '../test/fakeChrome';
import { makeNote, seedNotes, storedNotes } from '../test/notes';

const PAGE_URL = 'https://shop.io/a?x=1';
const sender = (fields: Partial<chrome.runtime.MessageSender> = {}): chrome.runtime.MessageSender => ({
  id: 'test-id',
  frameId: 0,
  tab: { id: 7, url: `${PAGE_URL}#reviews`, title: 'Shop page' } as chrome.tabs.Tab,
  ...fields,
});

let fc: FakeChrome;
beforeEach(async () => {
  fc = installFakeChrome();
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
});

describe('sender checks', () => {
  it('refuses messages from another extension, a frame, or a non web tab', async () => {
    const create = { type: 'page-notes/create', x: 1, y: 1, title: 'Hi' } as const;
    expect(await handlePageRequest(create, sender({ id: 'other' }))).toEqual({ error: 'invalid' });
    expect(await handlePageRequest(create, sender({ frameId: 3 }))).toEqual({ error: 'invalid' });
    expect(await handlePageRequest(create, sender({ tab: { id: 7, url: 'chrome://settings' } as chrome.tabs.Tab }))).toEqual({ error: 'invalid' });
    expect(await storedNotes()).toEqual([]);
  });
});

describe('create', () => {
  // covers: AC-2, AC-6 (page comes from the sender tab without #part, never from the message)
  it('saves a note on the sender page with its title', async () => {
    const r = await handlePageRequest({ type: 'page-notes/create', x: 40, y: 900, title: '  Buy later ', color: 'blue' }, sender());
    expect(r).toMatchObject({ note: { title: 'Buy later', page: { url: PAGE_URL, title: 'Shop page' }, positionX: 40, positionY: 900, noteColor: 'blue' } });
    expect(await storedNotes()).toHaveLength(1);
  });

  // covers: AC-18
  it('answers limit when the page has 50 notes', async () => {
    await seedNotes(...Array.from({ length: 50 }, () => makeNote({ page: { url: PAGE_URL, title: '' } })));
    expect(await handlePageRequest({ type: 'page-notes/create', x: 1, y: 1, title: 'x' }, sender())).toEqual({ error: 'limit' });
  });
});

describe('patch and trash', () => {
  // covers: AC-7, AC-9
  it('saves a move, a resize and the collapsed state, raising the note to the front', async () => {
    const n = makeNote({ page: { url: PAGE_URL, title: '' }, z: 3 });
    await seedNotes(n, makeNote({ page: { url: PAGE_URL, title: '' }, z: 9 }));
    const r = await handlePageRequest({ type: 'page-notes/patch', id: n.id, fields: { positionX: 500, positionY: 2000, width: 1000, collapsed: true } }, sender());
    expect(r).toMatchObject({ note: { positionX: 500, positionY: 2000, width: 480, collapsed: true, z: 10 } });
  });

  it('refuses to change a note that belongs to another page', async () => {
    const n = makeNote({ page: { url: 'https://shop.io/b', title: '' } });
    await seedNotes(n);
    expect(await handlePageRequest({ type: 'page-notes/patch', id: n.id, fields: { title: 'Hacked' } }, sender())).toEqual({ error: 'gone' });
    expect(await handlePageRequest({ type: 'page-notes/trash', id: n.id }, sender())).toEqual({ error: 'gone' });
    expect((await storedNotes())[0]).toMatchObject({ title: n.title });
  });

  // covers: AC-10
  it('moves a page note to Trash', async () => {
    const n = makeNote({ page: { url: PAGE_URL, title: '' } });
    await seedNotes(n);
    await handlePageRequest({ type: 'page-notes/trash', id: n.id }, sender());
    expect((await storedNotes())[0]?.deletedAt).toBeDefined();
  });

  it('drops fields a page may not change', async () => {
    const n = makeNote({ page: { url: PAGE_URL, title: '' } });
    await seedNotes(n);
    await handlePageRequest({ type: 'page-notes/patch', id: n.id, fields: { title: 'New', page: { url: 'https://evil.io' } } as never }, sender());
    expect((await storedNotes())[0]).toMatchObject({ title: 'New', page: { url: PAGE_URL } });
  });
});

describe('site access', () => {
  // covers: AC-4
  it('says whether the sender site is allowed', async () => {
    expect(await handlePageRequest({ type: 'page-notes/hello' }, sender())).toEqual({ allowed: false });
    fc.granted.add('*://shop.io/*');
    expect(await handlePageRequest({ type: 'page-notes/hello' }, sender())).toEqual({ allowed: true });
  });

  // covers: AC-4
  it('opens the Allow window only for the sender host', async () => {
    expect(await handlePageRequest({ type: 'page-notes/open-access', host: 'evil.io' }, sender())).toEqual({ ok: false });
    expect(await handlePageRequest({ type: 'page-notes/open-access', host: 'shop.io' }, sender())).toEqual({ ok: true });
    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'chrome-extension://test-id/site-access.html?host=shop.io&tab=7', type: 'popup' }),
    );
  });

  // covers: AC-1, AC-16
  it('registers the content script for exactly the allowed sites, and none when there are none', async () => {
    await syncRegistration();
    expect(fc.registered.size).toBe(0);
    expect(chrome.scripting.registerContentScripts).not.toHaveBeenCalled();

    fc.granted.add('*://shop.io/*');
    await syncRegistration();
    expect(fc.registered.get('page-notes')).toMatchObject({ matches: ['*://shop.io/*'], js: ['content-scripts/page-notes.js'], persistAcrossSessions: true });

    fc.granted.add('*://news.io/*');
    await syncRegistration();
    expect(fc.registered.get('page-notes')?.matches).toEqual(['*://shop.io/*', '*://news.io/*']);

    fc.granted.clear();
    await syncRegistration();
    expect(fc.registered.size).toBe(0);
  });

  // covers: AC-16
  it('lists single sites and shows broad grants as all sites', () => {
    expect(splitOrigins(['*://b.io/*', '*://a.io/*', 'https://*/*'])).toEqual({ hosts: ['a.io', 'b.io'], allSites: ['https://*/*'] });
  });

  it('only trusts a grant message from the Allow window', async () => {
    const reply = vi.fn();
    expect(pageMessageListener({ type: 'site-access/granted', tabId: 7 }, sender(), reply)).toBe(false);
    expect(pageMessageListener({ type: 'site-access/granted', tabId: 7 }, { id: 'test-id', url: 'chrome-extension://test-id/site-access.html?host=shop.io' }, reply)).toBe(true);
  });
});

describe('pin from the menu or shortcut', () => {
  // covers: AC-2, AC-3
  it('injects the script when it is not running, then asks for a draft', async () => {
    await pinOnTab({ id: 7, url: PAGE_URL } as chrome.tabs.Tab, 'shortcut');
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ['content-scripts/page-notes.js'] });
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(7, { type: 'page-notes/new-draft', via: 'shortcut' }, { frameId: 0 });
  });

  it('keeps a running script instead of injecting a second one', async () => {
    (chrome.tabs.sendMessage as Mock).mockImplementation(async (_t: number, m: { type: string }) => (m.type === 'page-notes/ping' ? PING_REPLY : undefined));
    await pinOnTab({ id: 7, url: PAGE_URL } as chrome.tabs.Tab, 'menu');
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  // covers: AC-17
  it('shows a notification on pages that cannot take notes', async () => {
    await pinOnTab({ id: 7, url: 'chrome://extensions' } as chrome.tabs.Tab, 'shortcut');
    (chrome.scripting.executeScript as Mock).mockRejectedValue(new Error('The extensions gallery cannot be scripted.'));
    await pinOnTab({ id: 8, url: 'https://chromewebstore.google.com/detail/x' } as chrome.tabs.Tab, 'menu');
    const calls = (chrome.notifications.create as Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.every(c => (c.at(-1) as { message: string }).message === CANT_NOTE_MESSAGE)).toBe(true);
  });

  it('retries once while the tab is still loading', async () => {
    (chrome.tabs.get as Mock).mockResolvedValue({ id: 7, status: 'loading' });
    (chrome.scripting.executeScript as Mock).mockRejectedValueOnce(new Error('not ready')).mockResolvedValueOnce([]);
    await pinOnTab({ id: 7, url: PAGE_URL } as chrome.tabs.Tab, 'show');
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });
});
