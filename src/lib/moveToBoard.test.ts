// Spec 0004: moving a page note to today's board, and Undo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { movePageNoteToBoard, notes, undoMoveToBoard } from './storage';
import { makeNote, seedNotes, storedNotes } from '../test/notes';
import type { Note } from '../types';

const MEET = { url: 'https://meet.google.com/abc-defg-hij', title: 'Weekly sync' };
const TODAY = '2026-11-12';
const stored = async (id: string) => (await storedNotes()).find(n => n.id === id);
const moved = (r: Awaited<ReturnType<typeof movePageNoteToBoard>>) => {
  if (typeof r === 'string') throw new Error(`expected a move, got ${r}`);
  return r;
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
  await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('movePageNoteToBoard', () => {
  // covers: AC-3, AC-4, AC-8, AC-10
  it("builds a board note on today's board and trashes the page note in one write", async () => {
    const page = makeNote({
      title: 'Call notes',
      description: 'Ship Friday',
      noteColor: 'pink',
      isCompleted: true,
      dateStr: '2026-11-03',
      page: MEET,
      width: 300,
      height: 260,
      collapsed: true,
      z: 900,
      subtasks: [
        { id: 's1', title: 'Send deck', isCompleted: true },
        { id: 's2', title: '', isCompleted: false },
      ],
    });
    await seedNotes(page, makeNote({ dateStr: TODAY, z: 4, positionX: 24, positionY: 24 }), makeNote({ dateStr: TODAY, page: MEET, z: 77 }));
    const set = vi.spyOn(chrome.storage.local, 'set');
    set.mockClear(); // the fake is already a mock; count only the move's writes

    const r = moved(await movePageNoteToBoard(page.id));

    expect(set).toHaveBeenCalledTimes(1);
    expect(r.board).toMatchObject({
      title: 'Call notes',
      description: 'Ship Friday',
      noteColor: 'pink', // kept, not the no repeat color rule
      isCompleted: true,
      dateStr: TODAY,
      z: 5, // above board notes only; the page note's 77 doesn't count
      remind: false,
      source: { url: MEET.url, title: 'Weekly sync' },
    });
    expect(r.board).not.toHaveProperty('page');
    expect(r.board).not.toHaveProperty('dueTime');
    expect(r.board).not.toHaveProperty('width');
    expect(r.board).not.toHaveProperty('collapsed');
    expect(r.board.subtasks.map(s => [s.title, s.isCompleted])).toEqual([
      ['Send deck', true],
      ['', false],
    ]);
    expect(r.board.subtasks.map(s => s.id)).not.toContain('s1');
    expect({ x: r.board.positionX, y: r.board.positionY }).not.toEqual({ x: 24, y: 24 });

    expect(await stored(r.board.id)).toEqual(r.board);
    expect(await stored(page.id)).toMatchObject({ deletedAt: '2026-11-12T10:00:00.000Z', width: 300, collapsed: true, page: MEET });
  });

  it('uses the host for the link when the page had no title', async () => {
    const page = makeNote({ page: { url: MEET.url, title: '' } });
    await seedNotes(page);
    expect(moved(await movePageNoteToBoard(page.id)).board.source).toEqual({ url: MEET.url, title: 'meet.google.com' });
  });

  // covers: AC-3 (today comes from the time zone setting at call time)
  it("works out today from the time zone setting, not the caller's", async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'Pacific/Kiritimati' } }); // UTC+14: already the 13th
    const page = makeNote({ page: MEET });
    await seedNotes(page);
    expect(moved(await movePageNoteToBoard(page.id)).board.dateStr).toBe('2026-11-13');
  });

  // covers: AC-6
  it('refuses when today has 50 notes, and changes nothing', async () => {
    const page = makeNote({ page: MEET });
    await seedNotes(page, ...Array.from({ length: 50 }, () => makeNote({ dateStr: TODAY })));
    expect(await movePageNoteToBoard(page.id)).toBe('day-full');
    expect(await stored(page.id)).toEqual(page);
    expect(await storedNotes()).toHaveLength(51);
  });

  // covers: AC-7, AC-9
  it('answers gone for a trashed, missing, board, or other page note', async () => {
    const trashed = makeNote({ page: MEET, deletedAt: '2026-11-11T00:00:00.000Z' });
    const board = makeNote();
    const other = makeNote({ page: { url: 'https://evil.io/', title: '' } });
    await seedNotes(trashed, board, other);
    expect(await movePageNoteToBoard(trashed.id)).toBe('gone');
    expect(await movePageNoteToBoard('nope')).toBe('gone');
    expect(await movePageNoteToBoard(board.id)).toBe('gone');
    expect(await movePageNoteToBoard(other.id, MEET.url)).toBe('gone');
    expect(await storedNotes()).toHaveLength(3);
  });

  // covers: AC-8
  it('leaves both notes as they were when the write fails', async () => {
    const page = makeNote({ page: MEET });
    await seedNotes(page);
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('quota'));
    await expect(movePageNoteToBoard(page.id)).rejects.toThrow('quota');
    expect(await storedNotes()).toEqual([page]);
  });

  it('waits for a save already queued for the note, so the board gets the latest text', async () => {
    const page = makeNote({ page: MEET, description: 'old' });
    await seedNotes(page);
    const saving = notes.patch(page.id, { description: 'typed just now' });
    const r = moved(await movePageNoteToBoard(page.id));
    await saving;
    expect(r.board.description).toBe('typed just now');
  });
});

describe('undoMoveToBoard', () => {
  const setup = async (...extra: Note[]) => {
    const page = makeNote({ page: MEET, positionX: 300, positionY: 900, width: 280, collapsed: true });
    await seedNotes(page, ...extra);
    const r = moved(await movePageNoteToBoard(page.id));
    return { page, board: r.board };
  };

  // covers: AC-5
  it('brings the page note back as it was and sends the board note to Trash', async () => {
    const { page, board } = await setup();
    const r = await undoMoveToBoard(page.id, board.id);
    expect(r).toMatchObject({ page: { id: page.id }, board: { id: board.id } });
    const back = await stored(page.id);
    expect(back).not.toHaveProperty('deletedAt');
    expect(back).toMatchObject({ positionX: 300, positionY: 900, width: 280, collapsed: true, z: page.z });
    expect((await stored(board.id))?.deletedAt).toBeDefined(); // in Trash, not deleted for good
  });

  // covers: AC-5 (text typed into the board note is never lost)
  it('keeps an edited board note in Trash with its edit', async () => {
    const { page, board } = await setup();
    await notes.patch(board.id, { description: 'added on the board' });
    await undoMoveToBoard(page.id, board.id);
    expect(await stored(board.id)).toMatchObject({ description: 'added on the board', deletedAt: expect.any(String) });
  });

  it('still brings the page note back when the board note is gone', async () => {
    const { page, board } = await setup();
    await notes.remove([board.id]);
    expect(await undoMoveToBoard(page.id, board.id)).toMatchObject({ board: null });
    expect(await stored(page.id)).not.toHaveProperty('deletedAt');
  });

  it('only trashes the board note when the page note is already back', async () => {
    const { page, board } = await setup();
    await notes.patch(page.id, { deletedAt: undefined });
    const before = await stored(page.id);
    await undoMoveToBoard(page.id, board.id);
    expect(await stored(page.id)).toEqual(before);
    expect((await stored(board.id))?.deletedAt).toBeDefined();
  });

  // covers: AC-11
  it('refuses on a full page and keeps the board note', async () => {
    const { page, board } = await setup();
    await seedNotes(...Array.from({ length: 50 }, () => makeNote({ page: MEET })));
    expect(await undoMoveToBoard(page.id, board.id)).toBe('limit');
    expect((await stored(page.id))?.deletedAt).toBeDefined();
    expect(await stored(board.id)).not.toHaveProperty('deletedAt');
  });

  // covers: AC-11
  it('answers gone when the page note was emptied from Trash, and keeps the board note', async () => {
    const { page, board } = await setup();
    await notes.remove([page.id]);
    expect(await undoMoveToBoard(page.id, board.id)).toBe('gone');
    expect(await stored(board.id)).not.toHaveProperty('deletedAt');
  });

  // covers: AC-9
  it("refuses another page's note, and a board note from another site", async () => {
    const { page, board } = await setup();
    expect(await undoMoveToBoard(page.id, board.id, 'https://evil.io/')).toBe('gone');
    const stranger = makeNote({ source: { url: 'https://evil.io/', title: 'x' } });
    await seedNotes(stranger);
    expect(await undoMoveToBoard(page.id, stranger.id)).toBe('invalid');
    expect(await stored(stranger.id)).toEqual(stranger);
  });
});
