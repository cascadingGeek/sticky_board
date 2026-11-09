// Spec 0002 on the board: Pages drawer, search, Trash and Settings.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StickyBoardProvider, useStickyBoard, type DrawerName } from '../lib/StickyBoardContext';
import { installFakeChrome, type FakeChrome } from '../test/fakeChrome';
import { makeNote, seedNotes, storedNotes } from '../test/notes';
import { PagesDrawer } from './PagesDrawer';
import { SearchBox } from './SearchBox';
import { SettingsDrawer } from './SettingsDrawer';
import { TrashDrawer } from './TrashDrawer';

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
  // covers: AC-11
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

  // covers: AC-11
  it('moves a page note to Trash', async () => {
    const n = makeNote({ title: 'Bye', page: SHOP });
    await seedNotes(n);
    mount(<PagesDrawer />);
    await userEvent.click(await screen.findByRole('button', { name: 'Move Bye to Trash' }));
    await waitFor(async () => expect((await storedNotes())[0]?.deletedAt).toBeDefined());
  });
});

describe('search', () => {
  // covers: AC-12
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
  // covers: AC-10
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
  // covers: AC-16
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
