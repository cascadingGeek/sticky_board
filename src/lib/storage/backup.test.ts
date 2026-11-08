import { describe, expect, it } from 'vitest';
import { exportBackup, importBackup, ImportError } from './backup';
import { settings } from './index';
import { makeNote, seedNotes, storedNotes } from '../../test/notes';
import type { Note } from '../../types';

const backupFile = (notes: unknown[], extra: Record<string, unknown> = {}) =>
  new File([JSON.stringify({ app: 'sticky-board', schemaVersion: 1, exportedAt: '2026-11-08T12:00:00.000Z', notes, settings: {}, ...extra })], 'backup.json', {
    type: 'application/json',
  });

describe('exportBackup', () => {
  // covers: AC-5 (every note, Trash too, and settings)
  it('includes every note, trashed ones too, and the settings', async () => {
    const active = makeNote();
    const trashed = makeNote({ deletedAt: '2026-11-08T10:00:00.000Z' });
    await seedNotes(active, trashed);
    await chrome.storage.sync.set({ settings: { theme: 'cork' } });

    const data = JSON.parse(await (await exportBackup()).text());

    expect(data).toMatchObject({ app: 'sticky-board', schemaVersion: 1 });
    expect(data.notes.map((n: Note) => n.id).sort()).toEqual([active.id, trashed.id].sort());
    expect(data.settings.theme).toBe('cork');
  });
});

describe('importBackup merge rules', () => {
  // covers: AC-5
  it('adds notes that aren\'t here yet', async () => {
    const n = makeNote();
    expect(await importBackup(backupFile([n]), false)).toEqual({ added: 1, updated: 0, skipped: 0 });
    expect(await storedNotes()).toEqual([n]);
  });

  it('keeps the local copy when it is newer (counted as already up to date)', async () => {
    const local = makeNote({ title: 'Local edit', updatedAt: '2026-11-08T12:00:00.000Z' });
    await seedNotes(local);
    const older = { ...local, title: 'Old', updatedAt: '2026-11-01T12:00:00.000Z' };
    expect(await importBackup(backupFile([older]), false)).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect((await storedNotes())[0]?.title).toBe('Local edit');
  });

  it('keeps the local copy on a tie', async () => {
    const local = makeNote({ title: 'Local' });
    await seedNotes(local);
    expect(await importBackup(backupFile([{ ...local, title: 'Same time' }]), false)).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it('replaces the local copy when the file\'s copy is newer', async () => {
    const local = makeNote({ title: 'Local', updatedAt: '2026-11-01T12:00:00.000Z' });
    await seedNotes(local);
    const newer = { ...local, title: 'Newer', updatedAt: '2026-11-08T12:00:00.000Z' };
    expect(await importBackup(backupFile([newer]), false)).toEqual({ added: 0, updated: 1, skipped: 0 });
    expect((await storedNotes())[0]?.title).toBe('Newer');
  });

  it('gives a note without a position the first free spot on its day', async () => {
    await seedNotes(makeNote({ dateStr: '2026-11-08', positionX: 24, positionY: 24, z: 4 }));
    const { positionX: _x, positionY: _y, z: _z, ...older } = makeNote({ id: 'nopos', dateStr: '2026-11-08' });
    await importBackup(backupFile([older]), false);
    expect((await storedNotes()).find(n => n.id === 'nopos')).toMatchObject({ positionX: 268, positionY: 24, z: 5 });
  });

  it('restores settings only when asked', async () => {
    await importBackup(backupFile([], { settings: { theme: 'midnight' } }), false);
    expect((await settings.get()).theme).toBe('dark');
    await importBackup(backupFile([], { settings: { theme: 'midnight' } }), true);
    expect((await settings.get()).theme).toBe('midnight');
  });
});

describe('importBackup rejects bad files and changes nothing', () => {
  const expectNothingChanged = async (file: File, message: RegExp) => {
    const existing = makeNote({ title: 'Untouched' });
    await seedNotes(existing);
    const err = await importBackup(file, true).catch(e => e);
    expect(err).toBeInstanceOf(ImportError);
    expect(err.message).toMatch(message);
    expect(await storedNotes()).toEqual([existing]);
    expect((await settings.get()).theme).toBe('dark');
  };

  // covers: AC-5 ("nothing was imported", data unchanged)
  it('rejects a whole file when one note has a javascript: source', async () => {
    const evil = { ...makeNote(), source: { url: 'javascript:alert(1)', title: 'x' } };
    await expectNothingChanged(backupFile([makeNote(), evil], { settings: { theme: 'cork' } }), /Note 2 .* nothing was imported/);
  });

  it('rejects a broken note', async () => {
    await expectNothingChanged(backupFile([{ id: 'b', title: '' }]), /Note 1 .* nothing was imported/);
  });

  it('rejects a file that isn\'t JSON', async () => {
    await expectNothingChanged(new File(['not json'], 'x.json'), /isn't valid JSON/);
  });

  it('rejects JSON from another app', async () => {
    await expectNothingChanged(new File([JSON.stringify({ app: 'other', notes: [] })], 'x.json'), /isn't a Sticky Board backup/);
  });

  it('rejects a backup from a newer version', async () => {
    await expectNothingChanged(backupFile([], { schemaVersion: 99 }), /newer version/);
  });

  it('rejects a backup without a version', async () => {
    await expectNothingChanged(backupFile([], { schemaVersion: 'one' }), /no version/);
  });

  it('rejects a backup without a notes list', async () => {
    await expectNothingChanged(backupFile([], { notes: 'none' }), /doesn't contain any notes/);
  });

  it('rejects a file over 50 MB before reading it', async () => {
    const big = new File(['x'], 'big.json');
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 + 1 });
    await expectNothingChanged(big, /larger than 50 MB/);
  });
});
