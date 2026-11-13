import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  CANT_NOTE_MESSAGE,
  handlePageRequest,
  pageMessageListener,
  pinOnTab,
  syncRegistration,
} from '@/background/pageNotes';
import { splitOrigins } from '@/shared/siteAccess';
import { PING_REPLY } from '@/shared/messages';
import { installFakeChrome, type FakeChrome } from '../support/fakeChrome';
import { makeNote, seedNotes, storedNotes } from '../support/notes';

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
  it('saves a note on the sender page with its title', async () => {
    const r = await handlePageRequest({ type: 'page-notes/create', x: 40, y: 900, title: '  Buy later ', color: 'blue' }, sender());
    expect(r).toMatchObject({ note: { title: 'Buy later', page: { url: PAGE_URL, title: 'Shop page' }, positionX: 40, positionY: 900, noteColor: 'blue' } });
    expect(await storedNotes()).toHaveLength(1);
  });

  it('answers limit when the page has 50 notes', async () => {
    await seedNotes(...Array.from({ length: 50 }, () => makeNote({ page: { url: PAGE_URL, title: '' } })));
    expect(await handlePageRequest({ type: 'page-notes/create', x: 1, y: 1, title: 'x' }, sender())).toEqual({ error: 'limit' });
  });
});

describe('patch and trash', () => {
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
  it('says whether the sender site is allowed', async () => {
    expect(await handlePageRequest({ type: 'page-notes/hello' }, sender())).toEqual({ allowed: false });
    fc.granted.add('*://shop.io/*');
    expect(await handlePageRequest({ type: 'page-notes/hello' }, sender())).toEqual({ allowed: true });
  });

  it('opens the Allow window only for the sender host', async () => {
    expect(await handlePageRequest({ type: 'page-notes/open-access', host: 'evil.io' }, sender())).toEqual({ ok: false });
    expect(await handlePageRequest({ type: 'page-notes/open-access', host: 'shop.io' }, sender())).toEqual({ ok: true });
    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'chrome-extension://test-id/site-access.html?host=shop.io&tab=7', type: 'popup' }),
    );
  });

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

describe('move to board requests', () => {
  it("moves a note on the sender's page and refuses one from another page", async () => {
    const mine = makeNote({ page: { url: PAGE_URL, title: 'Shop page' } });
    const theirs = makeNote({ page: { url: 'https://other.io/', title: '' } });
    await seedNotes(mine, theirs);

    const r = await handlePageRequest({ type: 'page-notes/move-to-board', id: mine.id }, sender());
    expect(r).toEqual({ pageId: mine.id, boardId: expect.any(String) });
    expect(await handlePageRequest({ type: 'page-notes/move-to-board', id: theirs.id }, sender())).toEqual({ error: 'gone' });
    expect((await storedNotes()).find(n => n.id === theirs.id)).not.toHaveProperty('deletedAt');

    const { boardId } = r as { boardId: string };
    expect(await handlePageRequest({ type: 'page-notes/undo-move', pageId: mine.id, boardId }, sender())).toEqual({ ok: true });
    expect((await storedNotes()).find(n => n.id === mine.id)).not.toHaveProperty('deletedAt');
  });

  it('refuses ids that are not text', async () => {
    const bad = (m: unknown) => handlePageRequest(m as Parameters<typeof handlePageRequest>[0], sender());
    expect(await bad({ type: 'page-notes/move-to-board', id: 42 })).toEqual({ error: 'invalid' });
    expect(await bad({ type: 'page-notes/move-to-board', id: '' })).toEqual({ error: 'invalid' });
    expect(await bad({ type: 'page-notes/undo-move', pageId: 'a' })).toEqual({ error: 'invalid' });
  });

  it('passes on a full day', async () => {
    const mine = makeNote({ page: { url: PAGE_URL, title: '' } });
    const day = new Date().toISOString().slice(0, 10);
    await seedNotes(mine, ...Array.from({ length: 50 }, () => makeNote({ dateStr: day })));
    expect(await handlePageRequest({ type: 'page-notes/move-to-board', id: mine.id }, sender())).toEqual({ error: 'day-full' });
  });

  it("refuses an Undo about another page's note, and changes nothing", async () => {
    const theirs = makeNote({ page: { url: 'https://other.io/', title: '' } });
    await seedNotes(theirs);
    const moved = await handlePageRequest({ type: 'page-notes/move-to-board', id: theirs.id }, sender({ url: 'https://other.io/', tab: { ...sender().tab!, url: 'https://other.io/' } }));
    const { boardId } = moved as { boardId: string };
    const before = await storedNotes();

    expect(await handlePageRequest({ type: 'page-notes/undo-move', pageId: theirs.id, boardId }, sender())).toEqual({ error: 'gone' });
    expect(await storedNotes()).toEqual(before);
  });

  it('refuses move requests from a frame inside the page', async () => {
    const mine = makeNote({ page: { url: PAGE_URL, title: '' } });
    await seedNotes(mine);
    expect(await handlePageRequest({ type: 'page-notes/move-to-board', id: mine.id }, sender({ frameId: 3 }))).toEqual({ error: 'invalid' });
    expect((await storedNotes())[0]).not.toHaveProperty('deletedAt');
  });
});
