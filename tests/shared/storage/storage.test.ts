import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNote, meta, noteKey, notes, purgeTrash, runMigrations, settings } from '@/shared/storage/index';
import { makeNote, seedNotes, storedNotes } from '../../support/notes';
import { DEFAULT_SETTINGS } from '@/shared/types';

afterEach(() => {
  vi.useRealTimers();
});

describe('createNote', () => {
  it('stores a new note under note:<id> with the full shape', async () => {
    const note = await createNote({ title: 'Buy milk', dateStr: '2026-11-08' });
    const stored = await chrome.storage.local.get(noteKey(note.id));
    expect(stored[`note:${note.id}`]).toEqual(note);
    expect(note).toMatchObject({ title: 'Buy milk', description: '', isCompleted: false, subtasks: [], remind: false, z: 1, positionX: 24, positionY: 24 });
    expect(note.createdAt).toBe(note.updatedAt);
  });

  it('takes the next z and a different color from the latest note', async () => {
    const first = await createNote({ title: 'a', dateStr: '2026-11-08' });
    const second = await createNote({ title: 'b', dateStr: '2026-11-08' });
    expect(second.z).toBe(first.z + 1);
    expect(second.noteColor).not.toBe(first.noteColor);
  });

  it('never repeats colors or z even when creates race', async () => {
    // Same millisecond for all; ids rise, so "greater id wins a tie" picks the newest.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
    let i = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`);
    const created = await Promise.all(Array.from({ length: 6 }, (_, k) => createNote({ title: `n${k}`, dateStr: '2026-11-08' })));
    // The note-create lock runs them one at a time, in call order.
    for (let k = 1; k < created.length; k++) expect(created[k]?.noteColor).not.toBe(created[k - 1]?.noteColor);
    expect(created.map(n => n.z)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('places a new note in the first free spot of the given viewport', async () => {
    await seedNotes(makeNote({ dateStr: '2026-11-08', positionX: 24, positionY: 24 }));
    const note = await createNote({ title: 'x', dateStr: '2026-11-08', viewport: { top: 0, width: 1280 } });
    expect([note.positionX, note.positionY]).toEqual([268, 24]);
  });
});

describe('notes.patch', () => {
  it('merges only the changed fields and refreshes updatedAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T12:00:00Z'));
    const n = makeNote({ title: 'Old', description: 'keep me' });
    await seedNotes(n);
    const next = await notes.patch(n.id, { title: 'New' });
    expect(next).toMatchObject({ title: 'New', description: 'keep me', updatedAt: '2026-11-08T12:00:00.000Z' });
    expect((await notes.get(n.id))?.title).toBe('New');
  });

  it('removes a field when it is set to undefined', async () => {
    const n = makeNote({ dueTime: '09:00' });
    await seedNotes(n);
    await notes.patch(n.id, { dueTime: undefined });
    const raw = (await chrome.storage.local.get(`note:${n.id}`))[`note:${n.id}`];
    expect(raw).not.toHaveProperty('dueTime');
    expect((await notes.get(n.id))?.dueTime).toBeUndefined();
  });

  it('rejects when the note no longer exists', async () => {
    await expect(notes.patch('gone', { title: 'x' })).rejects.toThrow('This note no longer exists.');
    expect(await storedNotes()).toEqual([]);
  });

  it('applies two quick patches to the same note one after the other, losing neither', async () => {
    const n = makeNote({ title: 'A', description: '' });
    await seedNotes(n);
    await Promise.all([notes.patch(n.id, { title: 'B' }), notes.patch(n.id, { description: 'D' })]);
    expect(await notes.get(n.id)).toMatchObject({ title: 'B', description: 'D' });
  });

  // Regression (found by /test): the queue's cleanup step used to leave a second,
  // unhandled copy of the error, which showed up as a page error on every failed save.
  it('reports a failed save only to the caller, with no unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      await expect(notes.patch('gone', { title: 'x' })).rejects.toThrow();
      await new Promise(r => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('keeps going after a failed patch', async () => {
    const n = makeNote();
    await seedNotes(n);
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA'));
    await expect(notes.patch(n.id, { title: 'x' })).rejects.toThrow('QUOTA');
    await expect(notes.patch(n.id, { title: 'y' })).resolves.toMatchObject({ title: 'y' });
  });
});

describe('notes.getAll and get', () => {
  it('skips invalid stored values and non note keys', async () => {
    const good = makeNote();
    await chrome.storage.local.set({ [`note:${good.id}`]: good, 'note:bad': { id: 'bad' }, meta: { schemaVersion: 1 } });
    expect((await notes.getAll()).map(n => n.id)).toEqual([good.id]);
  });

  it('gives an older note without a position safe defaults', async () => {
    const { positionX: _x, positionY: _y, z: _z, ...older } = makeNote({ id: 'old' });
    await chrome.storage.local.set({ 'note:old': older });
    expect(await notes.get('old')).toMatchObject({ positionX: 24, positionY: 24, z: 1 });
  });

  it('returns null for a missing note', async () => {
    expect(await notes.get('nope')).toBeNull();
  });
});

describe('notes.subscribe', () => {
  it('reports added, changed and removed notes from any writer', async () => {
    const cb = vi.fn();
    const off = notes.subscribe(cb);
    const n = makeNote();
    await seedNotes(n);
    await chrome.storage.local.remove(`note:${n.id}`);
    off();
    expect(cb).toHaveBeenNthCalledWith(1, { upserted: [expect.objectContaining({ id: n.id })], removed: [] });
    expect(cb).toHaveBeenNthCalledWith(2, { upserted: [], removed: [n.id] });
  });

  it('ignores meta and sync changes, and stops after unsubscribe', async () => {
    const cb = vi.fn();
    const off = notes.subscribe(cb);
    await chrome.storage.local.set({ meta: { schemaVersion: 1 } });
    await chrome.storage.sync.set({ settings: {} });
    off();
    await seedNotes(makeNote());
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await settings.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when sync storage fails', async () => {
    vi.mocked(chrome.storage.sync.get).mockRejectedValueOnce(new Error('sync off'));
    expect(await settings.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('debounces quick changes into one sync write that merges them', async () => {
    vi.useFakeTimers();
    settings.patch({ theme: 'cork' });
    settings.patch({ soundEnabled: false });
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
    expect(await settings.get()).toMatchObject({ theme: 'cork', soundEnabled: false });
  });

  it('flush writes pending changes right away', async () => {
    settings.patch({ theme: 'midnight' });
    await settings.flush();
    expect((await settings.get()).theme).toBe('midnight');
  });

  it('subscribe reports the parsed settings on a sync change', async () => {
    const cb = vi.fn();
    const off = settings.subscribe(cb);
    await chrome.storage.sync.set({ settings: { theme: 'light' } });
    off();
    expect(cb).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, theme: 'light' });
  });
});

describe('purgeTrash', () => {
  it('removes notes trashed over 30 days ago and keeps the rest', async () => {
    const now = Date.parse('2026-11-08T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    const old = makeNote({ deletedAt: new Date(now - 31 * day).toISOString() });
    const recent = makeNote({ deletedAt: new Date(now - 29 * day).toISOString() });
    const active = makeNote();
    await seedNotes(old, recent, active);
    expect(await purgeTrash(now)).toBe(1);
    expect((await storedNotes()).map(n => n.id).sort()).toEqual([recent.id, active.id].sort());
  });
});

describe('meta and migrations', () => {
  it('meta.patch merges into the stored record', async () => {
    await meta.patch({ onboardedAt: '2026-11-08T09:00:00.000Z' });
    await meta.patch({ lastCarryOverPromptDate: '2026-11-08' });
    expect(await meta.get()).toEqual({ schemaVersion: 1, onboardedAt: '2026-11-08T09:00:00.000Z', lastCarryOverPromptDate: '2026-11-08' });
  });

  it('runMigrations writes the schema version on a fresh install', async () => {
    await runMigrations();
    expect((await chrome.storage.local.get('meta')).meta).toEqual({ schemaVersion: 1, themeDefaultCheckedAt: expect.any(String) });
  });

  it('runMigrations keeps existing meta fields', async () => {
    await chrome.storage.local.set({ meta: { schemaVersion: 1, onboardedAt: 'x' } });
    await runMigrations();
    expect((await chrome.storage.local.get('meta')).meta).toEqual({ schemaVersion: 1, onboardedAt: 'x', themeDefaultCheckedAt: expect.any(String) });
  });
});

describe('theme default check', () => {
  const syncSettings = async () => (await chrome.storage.sync.get('settings')).settings as Record<string, unknown> | undefined;

  it('saves dark once for an existing user who never saved a theme, touching nothing else', async () => {
    await meta.patch({ onboardedAt: '2026-10-01T00:00:00.000Z' });
    await chrome.storage.sync.set({ settings: { soundEnabled: false, timezone: 'Europe/London' } });
    await runMigrations();
    expect(await syncSettings()).toEqual({ soundEnabled: false, timezone: 'Europe/London', theme: 'dark' });
    expect((await meta.get()).themeDefaultCheckedAt).toBeTruthy();
  });

  it('saves dark when sync has no settings at all', async () => {
    await meta.patch({ onboardedAt: '2026-10-01T00:00:00.000Z' });
    await runMigrations();
    expect(await syncSettings()).toEqual({ theme: 'dark' });
  });

  it('keeps a theme the user already saved', async () => {
    await meta.patch({ onboardedAt: '2026-10-01T00:00:00.000Z' });
    await chrome.storage.sync.set({ settings: { theme: 'cork' } });
    await runMigrations();
    expect(await syncSettings()).toEqual({ theme: 'cork' });
  });

  it('writes no theme on a fresh install, but still records the check', async () => {
    await runMigrations();
    expect(await syncSettings()).toBeUndefined();
    expect((await meta.get()).themeDefaultCheckedAt).toBeTruthy();
    expect((await settings.get()).theme).toBe('light');
  });

  it('writes no theme when notes exist but onboarding never finished', async () => {
    await createNote({ title: 'a', dateStr: '2026-11-08' });
    await runMigrations();
    expect(await syncSettings()).toBeUndefined();
  });

  it('runs once only, even if the theme key is removed later', async () => {
    await meta.patch({ onboardedAt: '2026-10-01T00:00:00.000Z' });
    await runMigrations();
    await chrome.storage.sync.set({ settings: { soundEnabled: true } });
    await runMigrations();
    expect(await syncSettings()).toEqual({ soundEnabled: true });
  });

  it('writes nothing and leaves the marker unset when sync storage fails', async () => {
    await meta.patch({ onboardedAt: '2026-10-01T00:00:00.000Z' });
    vi.mocked(chrome.storage.sync.get).mockRejectedValueOnce(new Error('sync down'));
    await runMigrations();
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    expect((await meta.get()).themeDefaultCheckedAt).toBeUndefined();
  });
});
