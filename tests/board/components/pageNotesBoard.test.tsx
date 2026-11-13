// Page notes on the board: Pages drawer, search, Trash and Settings.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StickyBoardProvider, useStickyBoard, type DrawerName } from '@/board/StickyBoardContext';
import { installFakeChrome, type FakeChrome } from '../../support/fakeChrome';
import { makeNote, seedNotes, storedNotes } from '../../support/notes';
import { PagesDrawer } from '@/board/components/PagesDrawer';
import { SearchBox } from '@/board/components/SearchBox';
import { SettingsDrawer } from '@/board/components/SettingsDrawer';
import { Toasts } from '@/board/components/Toasts';
import { TrashDrawer } from '@/board/components/TrashDrawer';

// The board's synthesized sounds, watched so a move can be heard.
const sounds = vi.hoisted(() => ({ playSound: vi.fn() }));
vi.mock('@/board/sounds', () => sounds);

const SHOP = { url: 'https://shop.io/a', title: 'Red shoes' };
const NEWS = { url: 'https://news.io/today?id=4', title: 'Front page' };

let ctx!: ReturnType<typeof useStickyBoard>;
const capture = (c: ReturnType<typeof useStickyBoard>) => {
  ctx = c;
};
function Open({ drawer, children }: { drawer?: DrawerName; children: React.ReactNode }) {
  const c = useStickyBoard();
  useLayoutEffect(() => capture(c));
  const { loaded, openDrawer } = c;
  useEffect(() => {
    if (loaded && drawer) openDrawer(drawer);
  }, [loaded, drawer, openDrawer]);
  return loaded ? <>{children}</> : null;
}
const mount = (ui: React.ReactNode, drawer?: DrawerName) =>
  render(
    <StickyBoardProvider>
      <Open drawer={drawer}>{ui}</Open>
    </StickyBoardProvider>,
  );

let fc: FakeChrome;
beforeEach(async () => {
  fc = installFakeChrome();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Pages drawer', () => {
  it('groups page notes by site, newest first, and opens a page in a new tab', async () => {
    await seedNotes(
      makeNote({ title: 'Old shoe note', page: SHOP, createdAt: '2026-11-01T00:00:00.000Z' }),
      makeNote({ title: 'New shoe note', page: SHOP, createdAt: '2026-11-07T00:00:00.000Z' }),
      makeNote({ title: 'News note', page: NEWS, createdAt: '2026-11-05T00:00:00.000Z' }),
      makeNote({ title: 'Board note' }),
      makeNote({ title: 'Trashed', page: SHOP, deletedAt: '2026-11-07T00:00:00.000Z' }),
    );
    mount(<PagesDrawer />);
    const shop = await screen.findByRole('region', { name: 'shop.io' });
    const titles = within(shop).getAllByRole('button', { name: /^Open/ }).map(b => b.textContent);
    expect(titles[0]).toContain('New shoe note');
    expect(titles[1]).toContain('Old shoe note');
    expect(within(shop).getAllByText('Red shoes')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'news.io' })).toBeInTheDocument();
    expect(screen.queryByText('Board note')).not.toBeInTheDocument();
    expect(screen.queryByText('Trashed')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open News note on news.io' }));
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: NEWS.url });
  });

  it('moves a page note to Trash', async () => {
    const n = makeNote({ title: 'Bye', page: SHOP });
    await seedNotes(n);
    mount(<PagesDrawer />);
    await userEvent.click(await screen.findByRole('button', { name: 'Move Bye to Trash' }));
    await waitFor(async () => expect((await storedNotes())[0]?.deletedAt).toBeDefined());
  });
});

describe('search', () => {
  it('finds page notes by checklist text, labels the site, and opens the page', async () => {
    await seedNotes(makeNote({ title: 'Shoes', page: SHOP, subtasks: [{ id: 's', title: 'check sizing chart', isCompleted: false }] }));
    mount(<SearchBox />);
    await userEvent.type(await screen.findByRole('combobox'), 'sizing');
    const result = await screen.findByRole('option', { name: /Shoes/ });
    expect(result).toHaveTextContent('shop.io');
    await userEvent.click(result);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: SHOP.url });
  });
});

describe('Trash', () => {
  it('shows the site and refuses Restore when the page has 50 notes', async () => {
    await seedNotes(
      makeNote({ title: 'Gone', page: SHOP, deletedAt: '2026-11-07T00:00:00.000Z' }),
      ...Array.from({ length: 50 }, () => makeNote({ page: SHOP })),
    );
    mount(<TrashDrawer />);
    expect(await screen.findByText('On shop.io')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(ctx.toasts.map(t => t.message)).toContain('This page already has 50 notes.'));
    expect((await storedNotes()).find(n => n.title === 'Gone')?.deletedAt).toBeDefined();
  });
});

describe('Settings sites list', () => {
  it('lists allowed sites with counts, shows broad grants as All sites, and removes access', async () => {
    fc.granted.add('*://shop.io/*');
    fc.granted.add('https://*/*');
    await seedNotes(makeNote({ page: SHOP }), makeNote({ page: SHOP }), makeNote({ page: NEWS }));
    mount(<SettingsDrawer />);
    const list = await screen.findByRole('region', { name: 'Sites with page notes' });
    await within(list).findByText('shop.io');
    expect(within(list).getByText('2 notes')).toBeInTheDocument();
    expect(within(list).getByText('All sites')).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: 'Remove shop.io' }));
    await waitFor(() => expect(within(list).queryByText('shop.io')).not.toBeInTheDocument());
    expect(chrome.permissions.remove).toHaveBeenCalledWith({ origins: ['*://shop.io/*'] });
    // The notes stay.
    expect(await storedNotes()).toHaveLength(3);
    await act(async () => undefined);
  });
});

describe('Move to today\'s board from the Pages drawer', () => {
  it('moves the note, shows the toast, and Undo puts it back', async () => {
    const meet = makeNote({ title: 'Call notes', page: { url: 'https://meet.google.com/abc', title: 'Meet' } });
    await seedNotes(meet);
    mount(
      <>
        <PagesDrawer />
        <Toasts />
      </>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));

    expect(await screen.findByText("“Call notes” moved to today's board")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Open Call notes/ })).not.toBeInTheDocument());
    const boardNote = ctx.notes.find(n => n.title === 'Call notes');
    expect(boardNote).toMatchObject({ source: { url: 'https://meet.google.com/abc' } });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: /Open Call notes/ })).toBeInTheDocument();
    const stored = await storedNotes();
    expect(stored.find(n => n.id === meet.id)).not.toHaveProperty('deletedAt');
    expect(stored.find(n => n.id === boardNote!.id)?.deletedAt).toBeDefined();
  });

  it('says the day is full and moves nothing', async () => {
    const meet = makeNote({ title: 'Call notes', page: { url: 'https://meet.google.com/abc', title: 'Meet' } });
    const today = new Date().toISOString().slice(0, 10);
    await seedNotes(meet, ...Array.from({ length: 50 }, () => makeNote({ dateStr: today })));
    mount(
      <>
        <PagesDrawer />
        <Toasts />
      </>,
    );
    await userEvent.click(await screen.findByRole('button', { name: "Move Call notes to today's board" }));
    expect(await screen.findByText(/This day already has 50 notes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Call notes/ })).toBeInTheDocument();
  });

  const drawerWithToasts = () =>
    mount(
      <>
        <PagesDrawer />
        <Toasts />
      </>,
    );

  it('gives the general Undo error, not the Trash one, when the board note no longer matches', async () => {
    await seedNotes(makeNote({ title: 'Paired', page: SHOP }));
    drawerWithToasts();
    await userEvent.click(await screen.findByRole('button', { name: "Move Paired to today's board" }));
    await screen.findByText("“Paired” moved to today's board");
    // The board note now points at another site, so it no longer pairs with the page note.
    const board = (await storedNotes()).find(n => n.title === 'Paired' && !n.page)!;
    await chrome.storage.local.set({ [`note:${board.id}`]: { ...board, source: { url: 'https://elsewhere.io/', title: '' } } });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("Couldn't undo. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't undo, the page note is no longer in Trash.")).not.toBeInTheDocument();
  });

  // A fast double click is one move, not a move plus a false "gone" error.
  it('treats a double click on Move as one move', async () => {
    await seedNotes(makeNote({ title: 'Twice', page: SHOP }));
    drawerWithToasts();
    const button = await screen.findByRole('button', { name: "Move Twice to today's board" });
    // Real storage answers after a short wait, so the second click lands while the first move runs.
    const local = chrome.storage.local;
    const set = vi.mocked(local.set);
    // The fake's set is already a mock: keep its own body, and add a short wait for the move's two note write.
    const realSet = set.getMockImplementation()!;
    const writeNow = realSet as unknown as (items: Record<string, unknown>) => Promise<void>;
    set.mockImplementation((async (items: Record<string, unknown>) => {
      if (Object.keys(items).length === 2) await new Promise(r => setTimeout(r, 50));
      return writeNow(items);
    }) as unknown as typeof realSet);
    await userEvent.dblClick(button);

    expect(await screen.findByText("“Twice” moved to today's board")).toBeInTheDocument();
    await act(() => new Promise(r => setTimeout(r, 150)));
    expect(screen.queryByText('This note was already moved or deleted.')).not.toBeInTheDocument();
    set.mockImplementation(realSet);
    expect((await storedNotes()).filter(n => n.title === 'Twice' && !n.page)).toHaveLength(1);
  });

  it('offers the button on a collapsed page note too', async () => {
    await seedNotes(makeNote({ title: 'Tucked away', page: SHOP, collapsed: true }));
    drawerWithToasts();
    expect(await screen.findByRole('button', { name: "Move Tucked away to today's board" })).toBeInTheDocument();
  });

  it('plays the pop sound on a move when sounds are on, and stays quiet when off', async () => {
    sounds.playSound.mockClear();
    await seedNotes(makeNote({ title: 'Loud', page: SHOP }), makeNote({ title: 'Quiet', page: SHOP }));
    drawerWithToasts();
    await userEvent.click(await screen.findByRole('button', { name: "Move Loud to today's board" }));
    await screen.findByText("“Loud” moved to today's board");
    expect(sounds.playSound).toHaveBeenCalledWith('pop');

    sounds.playSound.mockClear();
    act(() => ctx.updateSettings({ soundEnabled: false }));
    await userEvent.click(screen.getByRole('button', { name: "Move Quiet to today's board" }));
    await screen.findByText("“Quiet” moved to today's board");
    expect(sounds.playSound).not.toHaveBeenCalled();
  });

  it('cuts a long title to 60 characters in the toast', async () => {
    const long = 'A'.repeat(70);
    await seedNotes(makeNote({ title: long, page: SHOP }));
    drawerWithToasts();
    await userEvent.click(await screen.findByRole('button', { name: `Move ${long} to today's board` }));
    expect(await screen.findByText(`“${'A'.repeat(60)}…” moved to today's board`)).toBeInTheDocument();
  });

  it('says the note was already moved when another tab got there first', async () => {
    const n = makeNote({ title: 'Raced', page: SHOP });
    await seedNotes(n);
    drawerWithToasts();
    const button = await screen.findByRole('button', { name: "Move Raced to today's board" });
    // Another tab trashes it the moment before this move reads storage.
    const local = chrome.storage.local;
    const realGet = local.get.bind(local);
    vi.spyOn(local, 'get').mockImplementationOnce((async (...args: Parameters<typeof local.get>) => {
      await local.set({ [`note:${n.id}`]: { ...n, deletedAt: '2026-11-08T10:00:00.000Z' } });
      return realGet(...args);
    }) as typeof local.get);
    await userEvent.click(button);
    expect(await screen.findByText('This note was already moved or deleted.')).toBeInTheDocument();
    expect((await storedNotes()).filter(x => x.title === 'Raced')).toHaveLength(1);
  });

  it('says the move failed when the write fails, and changes nothing', async () => {
    const n = makeNote({ title: 'Stuck', page: SHOP });
    await seedNotes(n);
    drawerWithToasts();
    const button = await screen.findByRole('button', { name: "Move Stuck to today's board" });
    const realSet = chrome.storage.local.set;
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    await userEvent.click(button);
    expect(await screen.findByText("Couldn't move the note. Try again.")).toBeInTheDocument();
    chrome.storage.local.set = realSet;
    const stored = await storedNotes();
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toHaveProperty('deletedAt');
  });
});
