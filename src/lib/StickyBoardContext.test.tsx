import { useLayoutEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { StickyBoardProvider, useStickyBoard } from './StickyBoardContext';
import { makeNote, seedNotes, storedNotes } from '../test/notes';
import type { Note } from '../types';

let ctx: ReturnType<typeof useStickyBoard>;
const capture = (c: ReturnType<typeof useStickyBoard>) => {
  ctx = c;
};
// Hands the live context to the test after every render.
function Probe() {
  const c = useStickyBoard();
  useLayoutEffect(() => capture(c));
  return null;
}

const mount = async () => {
  render(
    <StickyBoardProvider>
      <Probe />
    </StickyBoardProvider>,
  );
  await waitFor(() => expect(ctx.loaded).toBe(true));
};

const shown = (id: string) => ctx.notes.find(n => n.id === id);
const toastText = () => ctx.toasts.map(t => t.message);

// The runtime.onMessage fake from src/test/fakeChrome.ts.
const sendMessage = (msg: unknown) =>
  act(() => (chrome.runtime.onMessage as unknown as { emit: (m: unknown) => Promise<void> }).emit(msg));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
  window.history.replaceState(null, '', '/newtab.html');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('no-handwriting');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('loading', () => {
  it('loads notes, meta and settings, and shows today in the settings time zone', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'Pacific/Kiritimati' } }); // already the 9th
    const n = makeNote({ title: 'Hello' });
    await seedNotes(n);
    await chrome.storage.local.set({ meta: { schemaVersion: 1, onboardedAt: '2026-11-01T00:00:00.000Z' } });

    await mount();

    expect(shown(n.id)?.title).toBe('Hello');
    expect(ctx.meta.onboardedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(ctx.today).toBe('2026-11-09');
    expect(ctx.currentDateStr).toBe('2026-11-09');
  });

  // covers: value sourcing "#date=" (that day shows once, then the hash is cleared)
  it('opens the day named in #date= and clears the hash', async () => {
    window.history.replaceState(null, '', '/newtab.html#date=2026-01-01');
    await mount();
    expect(ctx.currentDateStr).toBe('2026-01-01');
    expect(window.location.hash).toBe('');
  });

  it('ignores an invalid #date=', async () => {
    window.history.replaceState(null, '', '/newtab.html#date=2026-02-30');
    await mount();
    expect(ctx.currentDateStr).toBe('2026-11-08');
  });

  // covers: spec 0003 AC-12 (the board shows its load error state instead of a toast)
  it('marks the load as failed when storage can\'t be read', async () => {
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('broken'));
    await mount();
    expect(ctx.loaded).toBe(true);
    expect(ctx.loadFailed).toBe(true);
  });
});

describe('patchNote', () => {
  it('shows the change at once and saves it', async () => {
    const n = makeNote({ title: 'Old' });
    await seedNotes(n);
    await mount();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await ctx.patchNote(n.id, { title: 'New' });
    });

    expect(ok).toBe(true);
    expect(shown(n.id)?.title).toBe('New');
    expect((await storedNotes())[0]?.title).toBe('New');
  });

  // covers: AC-6 (an error toast shows and the screen returns to the last saved state)
  it('undoes the change on screen and says so when the save fails', async () => {
    const n = makeNote({ title: 'Saved title', positionX: 40 });
    await seedNotes(n);
    await mount();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await ctx.patchNote(n.id, { title: 'Unsaved', positionX: 400 });
    });

    expect(ok).toBe(false);
    expect(shown(n.id)).toMatchObject({ title: 'Saved title', positionX: 40 });
    expect(toastText()).toContain("Couldn't save that change, so it was undone.");
  });

  // covers: AC-6 (the note was removed elsewhere while you edited it)
  it('drops a note that was removed before the save landed', async () => {
    const n = makeNote();
    await seedNotes(n);
    await mount();
    // Remove it behind the context's back (no change event), as if another tab won the race.
    (chrome.storage.local.get as unknown as Mock).mockResolvedValueOnce({});

    await act(async () => {
      await ctx.patchNote(n.id, { title: 'x' });
    });

    expect(toastText()).toContain("Couldn't save that change, so it was undone.");
  });

  it('removes a field patched to undefined', async () => {
    const n = makeNote({ dueTime: '09:00' });
    await seedNotes(n);
    await mount();
    await act(async () => {
      await ctx.patchNote(n.id, { dueTime: undefined });
    });
    expect(shown(n.id)?.dueTime).toBeUndefined();
  });

  it('returns false for a note it doesn\'t know', async () => {
    await mount();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await ctx.patchNote('missing', { title: 'x' });
    });
    expect(ok).toBe(false);
  });
});

describe('live updates from other tabs and the worker', () => {
  // covers: AC-2 (changes show without a reload)
  it('shows notes added and changed elsewhere', async () => {
    const n = makeNote({ title: 'Mine' });
    await seedNotes(n);
    await mount();

    const other = makeNote({ title: 'From tab 2' });
    await act(async () => {
      await seedNotes(other, { ...n, title: 'Edited in tab 2', updatedAt: '2026-11-08T12:00:01.000Z' });
    });

    expect(shown(other.id)?.title).toBe('From tab 2');
    expect(shown(n.id)?.title).toBe('Edited in tab 2');
  });

  it('ignores a stale echo older than what is on screen', async () => {
    const n = makeNote({ title: 'Newest', updatedAt: '2026-11-08T12:00:00.000Z' });
    await seedNotes(n);
    await mount();
    await act(async () => {
      await seedNotes({ ...n, title: 'Stale', updatedAt: '2026-11-08T11:00:00.000Z' });
    });
    expect(shown(n.id)?.title).toBe('Newest');
  });

  it('drops notes removed elsewhere', async () => {
    const n = makeNote();
    await seedNotes(n);
    await mount();
    await act(async () => {
      await chrome.storage.local.remove(`note:${n.id}`);
    });
    expect(shown(n.id)).toBeUndefined();
  });

  it('follows settings changed elsewhere', async () => {
    await mount();
    await act(async () => {
      await chrome.storage.sync.set({ settings: { timezone: 'UTC', theme: 'cork' } });
    });
    expect(ctx.settings.theme).toBe('cork');
  });

  // covers: AC-18 / AC-20 (the worker asks an open board to show a day)
  it('switches to the day a "go-to-date" message names and closes panels', async () => {
    await mount();
    act(() => {
      ctx.openDrawer('settings');
    });
    await sendMessage({ type: 'go-to-date', dateStr: '2026-11-20' });
    expect(ctx.currentDateStr).toBe('2026-11-20');
    expect(ctx.drawer).toBeNull();
  });

  it('ignores other messages and bad dates', async () => {
    await mount();
    await sendMessage({ type: 'go-to-date', dateStr: 'tomorrow' });
    await sendMessage({ type: 'something-else', dateStr: '2026-11-20' });
    expect(ctx.currentDateStr).toBe('2026-11-08');
  });
});

describe('trash', () => {
  // covers: AC-4 (trash leaves the board; Undo puts it back)
  it('moves a note to Trash with an Undo toast that restores it', async () => {
    const n = makeNote({ title: 'Groceries' });
    await seedNotes(n);
    await mount();

    await act(async () => {
      await ctx.trashNote(n.id);
    });
    expect(shown(n.id)?.deletedAt).toBe('2026-11-08T12:00:00.000Z');
    const t = ctx.toasts.find(x => x.message === '“Groceries” moved to Trash');
    expect(t?.action?.label).toBe('Undo');

    await act(async () => {
      t?.action?.run();
      await vi.waitFor(async () => expect((await storedNotes())[0]).not.toHaveProperty('deletedAt'));
    });
    expect(shown(n.id)?.deletedAt).toBeUndefined();
  });

  it('restoreNote clears deletedAt and keeps day and position', async () => {
    const n = makeNote({ deletedAt: '2026-11-07T00:00:00.000Z', dateStr: '2026-11-03', positionX: 300, positionY: 200 });
    await seedNotes(n);
    await mount();
    await act(async () => {
      await ctx.restoreNote(n.id);
    });
    expect(shown(n.id)).toMatchObject({ dateStr: '2026-11-03', positionX: 300, positionY: 200 });
    expect(shown(n.id)?.deletedAt).toBeUndefined();
  });

  it('deleteForever removes the stored keys', async () => {
    const a = makeNote();
    const b = makeNote();
    await seedNotes(a, b);
    await mount();
    await act(async () => {
      await ctx.deleteForever([a.id]);
    });
    expect((await storedNotes()).map((n: Note) => n.id)).toEqual([b.id]);
    expect(shown(a.id)).toBeUndefined();
  });
});

describe('createNote', () => {
  it('adds the saved note to the board', async () => {
    await mount();
    let note: Note | null = null;
    await act(async () => {
      note = await ctx.createNote({ title: 'Fresh', dateStr: '2026-11-08' });
    });
    expect(note).not.toBeNull();
    expect(ctx.notes.map(n => n.title)).toEqual(['Fresh']);
  });

  it('keeps your text and shows an error when saving fails', async () => {
    await mount();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA'));
    let note: Note | null | undefined;
    await act(async () => {
      note = await ctx.createNote({ title: 'Fresh', dateStr: '2026-11-08' });
    });
    expect(note).toBeNull();
    expect(toastText()).toContain("Couldn't save the note. Your text is still here, try again.");
  });
});

describe('theme', () => {
  // covers: AC-9 (theme applies, and is cached for the next first paint)
  it('applies the theme to the page and caches it for the next new tab', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'UTC', theme: 'midnight', handwritingFont: false } });
    await mount();
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(localStorage.getItem('sb_theme')).toBe('midnight');
    expect(document.documentElement.classList.contains('no-handwriting')).toBe(true);
  });

  it('previews a theme without caching it', async () => {
    await mount();
    act(() => ctx.setThemeOverride('cork'));
    expect(document.documentElement.dataset.theme).toBe('cork');
    expect(localStorage.getItem('sb_theme')).toBe('light');
  });

  // covers: AC-9 (System follows the OS appearance without reload)
  it('follows the OS appearance live when set to System', async () => {
    let dark = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    }));
    await chrome.storage.sync.set({ settings: { timezone: 'UTC', theme: 'system' } });
    await mount();
    expect(document.documentElement.dataset.theme).toBe('dark');

    dark = false;
    act(() => listeners.forEach(l => l()));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  // covers: AC-3 (settings are written to chrome.storage.sync)
  it('saves settings changes to sync storage', async () => {
    await mount();
    act(() => ctx.updateSettings({ theme: 'cork' }));
    expect(ctx.settings.theme).toBe('cork');
    await act(async () => {
      window.dispatchEvent(new Event('pagehide')); // flushes the debounced write
      await vi.waitFor(async () => expect((await chrome.storage.sync.get('settings')).settings).toMatchObject({ theme: 'cork' }));
    });
  });
});

describe('midnight', () => {
  // covers: AC-13 (a board left open across midnight switches to the new day)
  it('moves to the new day at midnight when you were on today', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-11-08T23:59:30Z'));
    render(
      <StickyBoardProvider>
        <Probe />
      </StickyBoardProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(ctx.currentDateStr).toBe('2026-11-08');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(ctx.today).toBe('2026-11-09');
    expect(ctx.currentDateStr).toBe('2026-11-09');
  });

  it('keeps the day you were browsing', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date('2026-11-08T23:59:30Z'));
    render(
      <StickyBoardProvider>
        <Probe />
      </StickyBoardProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    act(() => ctx.setCurrentDateStr('2026-11-02'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(ctx.today).toBe('2026-11-09');
    expect(ctx.currentDateStr).toBe('2026-11-02');
  });
});
