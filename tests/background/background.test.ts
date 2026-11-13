// Lives outside src/entrypoints/ on purpose: WXT treats every file there as an entrypoint.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { makeNote, seedNotes, storedNotes } from '../support/notes';
import type { makeEvent } from '../support/fakeChrome';

// WXT normally provides defineBackground; here it just hands back the main function.
vi.stubGlobal('defineBackground', (main: () => void) => ({ main }));

type Ev<A extends unknown[]> = ReturnType<typeof makeEvent<A>>;
const ev = <A extends unknown[]>(e: unknown) => e as Ev<A>;

let main: () => void;
beforeAll(async () => {
  ({ main } = (await import('@/entrypoints/background')).default as unknown as { main: () => void });
});

const BOARD = 'chrome-extension://test-id/newtab.html';
const settle = () => new Promise(r => setTimeout(r, 0));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
  main();
  await settle();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('install and start', () => {
  it('creates the two right click menu items on install', async () => {
    await ev<[{ reason: string }]>(chrome.runtime.onInstalled).emit({ reason: 'install' });
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({ id: 'send-selection', title: 'Send selection to Sticky Board', contexts: ['selection'] });
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({ id: 'save-link', title: 'Save link to Sticky Board', contexts: ['link'] });
  });

  it('records the schema version on install', async () => {
    await ev<[{ reason: string }]>(chrome.runtime.onInstalled).emit({ reason: 'install' });
    expect((await chrome.storage.local.get('meta')).meta).toMatchObject({ schemaVersion: 1 });
  });

  it('keeps a daily trash purge alarm', async () => {
    expect(await chrome.alarms.get('purge-trash')).toBeDefined();
  });

  it('purges old trash when the browser starts', async () => {
    const old = makeNote({ deletedAt: '2026-10-01T00:00:00.000Z' });
    const kept = makeNote();
    await seedNotes(old, kept);
    await ev<[]>(chrome.runtime.onStartup).emit();
    expect((await storedNotes()).map(n => n.id)).toEqual([kept.id]);
  });

  it('purges old trash when the daily alarm fires', async () => {
    const old = makeNote({ deletedAt: '2026-10-01T00:00:00.000Z' });
    await seedNotes(old);
    await ev<[{ name: string }]>(chrome.alarms.onAlarm).emit({ name: 'purge-trash' });
    expect(await storedNotes()).toEqual([]);
  });
});

describe('right click capture', () => {
  type Info = { menuItemId: string; selectionText?: string; linkUrl?: string; pageUrl?: string };
  const click = (info: Info, tab?: { title?: string }) => ev<[Info, { title?: string } | undefined]>(chrome.contextMenus.onClicked).emit(info, tab);

  it('saves selected text as a note on today with a link back to the page', async () => {
    await click({ menuItemId: 'send-selection', selectionText: 'Big idea\nwith details', pageUrl: 'https://blog.io/post' }, { title: 'A post' });
    const [n] = await storedNotes();
    expect(n).toMatchObject({ title: 'Big idea', dateStr: '2026-11-08', source: { url: 'https://blog.io/post', title: 'A post' } });
  });

  it('saves a link with its host and path as the title', async () => {
    await click({ menuItemId: 'save-link', linkUrl: 'https://docs.io/guide/start', pageUrl: 'https://blog.io' }, { title: 'Blog' });
    const [n] = await storedNotes();
    expect(n).toMatchObject({ title: 'docs.io/guide/start', description: 'https://docs.io/guide/start' });
  });

  it('ignores a click with nothing selected', async () => {
    await click({ menuItemId: 'send-selection' });
    expect(await storedNotes()).toEqual([]);
  });

  it('shows a notification when the note can\'t be saved', async () => {
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA'));
    await click({ menuItemId: 'send-selection', selectionText: 'x', pageUrl: 'https://a.io' });
    expect(chrome.notifications.create).toHaveBeenCalledWith(expect.objectContaining({ message: "Couldn't save to Sticky Board. Please try again." }));
  });
});

describe('reminders', () => {
  it('shows a due reminder when the reminder alarm fires', async () => {
    const n = makeNote({ dueTime: '12:00', remind: true });
    await seedNotes(n);
    vi.mocked(chrome.notifications.create).mockClear();
    await ev<[{ name: string }]>(chrome.alarms.onAlarm).emit({ name: 'reminders' });
    expect(chrome.notifications.create).toHaveBeenCalledWith(`remind:${n.id}`, expect.objectContaining({ requireInteraction: true }));
  });

  it('reschedules the alarm when a note changes anywhere', async () => {
    const n = makeNote({ dueTime: '15:00', remind: true });
    await seedNotes(n);
    await vi.waitFor(async () => expect((await chrome.alarms.get('reminders'))?.scheduledTime).toBe(Date.parse('2026-11-08T15:00:00Z')));

    await seedNotes({ ...n, dueTime: '14:00', updatedAt: '2026-11-08T12:00:01.000Z' });
    await vi.waitFor(async () => expect((await chrome.alarms.get('reminders'))?.scheduledTime).toBe(Date.parse('2026-11-08T14:00:00Z')));
  });
});

describe('opening the board', () => {
  const clickNotification = (id: string) => ev<[string]>(chrome.notifications.onClicked).emit(id);

  it('opens a new board tab on the note\'s day when none is open', async () => {
    const n = makeNote({ dateStr: '2026-11-05' });
    await seedNotes(n);
    await clickNotification(`remind:${n.id}`);
    expect(chrome.notifications.clear).toHaveBeenCalledWith(`remind:${n.id}`);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: `${BOARD}#date=2026-11-05` });
  });

  it('focuses an open board tab and tells it which day to show', async () => {
    const n = makeNote({ dateStr: '2026-11-05' });
    await seedNotes(n);
    (chrome.runtime.getContexts as unknown as Mock).mockResolvedValueOnce([{ documentUrl: BOARD, tabId: 7, windowId: 3 }]);
    await clickNotification(`remind:${n.id}`);
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chrome.windows.update).toHaveBeenCalledWith(3, { focused: true });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'go-to-date', dateStr: '2026-11-05' });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('still focuses the tab when the page isn\'t ready for messages yet', async () => {
    (chrome.runtime.getContexts as unknown as Mock).mockResolvedValueOnce([{ documentUrl: BOARD, tabId: 7, windowId: 3 }]);
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(new Error('Receiving end does not exist.'));
    await expect(clickNotification('missed')).resolves.toBeUndefined();
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
  });

  it('opens today for the missed summary or a trashed note', async () => {
    const trashed = makeNote({ dateStr: '2026-11-01', deletedAt: '2026-11-07T00:00:00.000Z' });
    await seedNotes(trashed);
    await clickNotification('missed');
    await clickNotification(`remind:${trashed.id}`);
    expect(vi.mocked(chrome.tabs.create).mock.calls).toEqual([[{ url: `${BOARD}#date=2026-11-08` }], [{ url: `${BOARD}#date=2026-11-08` }]]);
  });

  it('opens the board on today from the toolbar icon or shortcut', async () => {
    await ev<[]>(chrome.action.onClicked).emit();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: `${BOARD}#date=2026-11-08` });
  });

  it('ignores tabs that aren\'t the board', async () => {
    (chrome.runtime.getContexts as unknown as Mock).mockResolvedValueOnce([{ documentUrl: 'chrome-extension://test-id/other.html', tabId: 2, windowId: 1 }]);
    await ev<[]>(chrome.action.onClicked).emit();
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    expect(chrome.tabs.create).toHaveBeenCalled();
  });
});

describe('page notes wiring', () => {
  it('adds "Pin a note here" and "Show notes on this page" for web pages only', async () => {
    await ev<[{ reason: string }]>(chrome.runtime.onInstalled).emit({ reason: 'install' });
    const pages = ['http://*/*', 'https://*/*'];
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({ id: 'pin-note', title: 'Pin a note here', contexts: ['page'], documentUrlPatterns: pages });
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({ id: 'show-page-notes', title: 'Show notes on this page', contexts: ['page'], documentUrlPatterns: pages });
  });

  it('Alt+Shift+N injects the page script and asks for a draft', async () => {
    await ev<[string, { id?: number; url?: string }]>(chrome.commands.onCommand).emit('pin-note', { id: 4, url: 'https://a.io/' });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 4 }, files: ['content-scripts/page-notes.js'] });
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(4, { type: 'page-notes/new-draft', via: 'shortcut' }, { frameId: 0 });
  });

  it('"Show notes on this page" draws the notes without a draft', async () => {
    await ev<[{ menuItemId: string }, { id?: number; url?: string }]>(chrome.contextMenus.onClicked).emit({ menuItemId: 'show-page-notes' }, { id: 5, url: 'https://a.io/' });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 5 }, files: ['content-scripts/page-notes.js'] });
    expect((chrome.tabs.sendMessage as Mock).mock.calls.some(c => (c[1] as { type: string }).type === 'page-notes/new-draft')).toBe(false);
  });

  it('re-registers the page script when site access changes', async () => {
    await chrome.permissions.request({ origins: ['*://a.io/*'] });
    await ev<[unknown]>(chrome.permissions.onAdded).emit({ origins: ['*://a.io/*'] });
    await settle();
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([expect.objectContaining({ id: 'page-notes', matches: ['*://a.io/*'] })]);
  });
});
