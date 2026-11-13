import { describe, expect, it } from 'vitest';
import { boardNotes, drawnSpot, normalizePageUrl, notesOnPage, sanitizePagePatch, stackedSpot } from '@/shared/pageNotes';
import { runReminderCheck } from '@/background/reminders';
import { createNote, createPageNote, restoreNote } from '@/shared/storage';
import { importBackup } from '@/shared/storage/backup';
import { parseNote } from '@/shared/storage/validate';
import { makeNote, seedNotes, storedNotes } from '../support/notes';

const PAGE = { url: 'https://shop.io/a?x=1', title: 'Shop' };

describe('normalizePageUrl', () => {
  it('drops only the #part and keeps path and query as given', () => {
    expect(normalizePageUrl('https://shop.io/a?x=1#top')).toBe('https://shop.io/a?x=1');
    expect(normalizePageUrl('https://shop.io/a?x=1')).toBe('https://shop.io/a?x=1');
    expect(normalizePageUrl('http://Shop.io/a')).toBe('http://Shop.io/a');
  });

  it('refuses addresses that are not http or https, or are too long', () => {
    expect(normalizePageUrl('chrome://extensions')).toBeNull();
    expect(normalizePageUrl('file:///tmp/a.html')).toBeNull();
    expect(normalizePageUrl(`https://a.io/${'x'.repeat(2050)}`)).toBeNull();
    expect(normalizePageUrl(undefined)).toBeNull();
  });

  it('matches a note only on its exact address', () => {
    const n = makeNote({ page: PAGE });
    const on = (u: string) => notesOnPage([n], normalizePageUrl(u)!).length;
    expect(on('https://shop.io/a?x=1')).toBe(1);
    expect(on('https://shop.io/a?x=1#top')).toBe(1);
    expect(on('https://shop.io/a?x=2')).toBe(0);
    expect(on('https://shop.io/b')).toBe(0);
  });
});

describe('parseNote with a page', () => {
  it('keeps page, size and collapsed, and drops board only fields', () => {
    const n = parseNote({
      ...makeNote(),
      page: { url: 'https://a.io/p#h', title: 't'.repeat(300) },
      width: 900,
      height: 50,
      collapsed: true,
      dueTime: '09:00',
      remind: true,
      source: { url: 'https://b.io', title: 'B' },
      carriedFromId: 'x',
    });
    expect(n).toMatchObject({ page: { url: 'https://a.io/p' }, width: 480, height: 120, collapsed: true, remind: false });
    expect(n?.page?.title).toHaveLength(200);
    expect(n).not.toHaveProperty('dueTime');
    expect(n).not.toHaveProperty('source');
    expect(n).not.toHaveProperty('carriedFromId');
  });

  it('rejects a page note whose address is not http or https', () => {
    expect(parseNote({ ...makeNote(), page: { url: 'javascript:alert(1)', title: '' } })).toBeNull();
  });
});

describe('board guard', () => {
  it('keeps page notes out of the board list', () => {
    const board = makeNote();
    const page = makeNote({ page: PAGE });
    expect(boardNotes([board, page]).map(n => n.id)).toEqual([board.id]);
  });

  it('never reminds about a page note', async () => {
    await chrome.storage.sync.set({ settings: { timezone: 'UTC' } });
    await seedNotes({ ...makeNote({ page: PAGE }), dueTime: '00:00', remind: true });
    await runReminderCheck();
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  it('places a new board note ignoring page notes on the same day', async () => {
    await seedNotes(makeNote({ page: PAGE, positionX: 24, positionY: 24, z: 40 }));
    const n = await createNote({ title: 'Board', dateStr: '2026-11-08' });
    expect(n).toMatchObject({ positionX: 24, positionY: 24, z: 1 });
  });
});

describe('createPageNote and restore', () => {
  it('refuses a 51st note on a page', async () => {
    await seedNotes(...Array.from({ length: 50 }, () => makeNote({ page: PAGE })));
    expect(await createPageNote({ title: 'One more', page: PAGE, x: 1, y: 1, dateStr: '2026-11-08' })).toBe('limit');
    expect(await storedNotes()).toHaveLength(50);
  });

  it('stacks z above the other notes on the same page only', async () => {
    await seedNotes(makeNote({ page: PAGE, z: 7 }), makeNote({ z: 99 }));
    const n = await createPageNote({ title: 'Hi', page: PAGE, x: 10, y: 20, dateStr: '2026-11-08' });
    expect(n).toMatchObject({ z: 8, positionX: 10, positionY: 20, page: PAGE });
  });

  it('refuses Restore when the page is full', async () => {
    const trashed = makeNote({ page: PAGE, deletedAt: '2026-11-08T00:00:00.000Z' });
    await seedNotes(trashed, ...Array.from({ length: 50 }, () => makeNote({ page: PAGE })));
    expect(await restoreNote(trashed.id)).toBe('limit');
  });

  it('restores a page note at the same spot when there is room', async () => {
    const trashed = makeNote({ page: PAGE, positionX: 300, positionY: 900, deletedAt: '2026-11-08T00:00:00.000Z' });
    await seedNotes(trashed);
    const r = await restoreNote(trashed.id);
    expect(r).toMatchObject({ positionX: 300, positionY: 900 });
    expect(r).not.toHaveProperty('deletedAt');
  });
});

describe('import', () => {
  it('keeps a page note at its saved page spot', async () => {
    const n = { ...makeNote({ page: PAGE, positionX: 1500, positionY: 4000, width: 300, height: 200, collapsed: true }) };
    const file = new File([JSON.stringify({ app: 'sticky-board', schemaVersion: 1, notes: [n], settings: {} })], 'b.json');
    await importBackup(file, false);
    expect((await storedNotes())[0]).toMatchObject({ positionX: 1500, positionY: 4000, width: 300, height: 200, collapsed: true, page: PAGE });
  });
});

describe('spots', () => {
  it('puts a shortcut note 24 px in, stepping 24 px past notes within 12 px', () => {
    const notes = [makeNote({ page: PAGE, positionX: 130, positionY: 530 }), makeNote({ page: PAGE, positionX: 148, positionY: 548 })];
    expect(stackedSpot([], 100, 500)).toEqual({ x: 124, y: 524 });
    expect(stackedSpot(notes, 100, 500)).toEqual({ x: 172, y: 572 });
  });

  it('draws a note inside the page without changing its saved spot', () => {
    const n = makeNote({ page: PAGE, positionX: 5000, positionY: 9000, width: 200 });
    expect(drawnSpot(n, 1200, 3000)).toEqual({ x: 992, y: 2960 });
  });
});

describe('sanitizePagePatch', () => {
  it('keeps allowed fields, clamps sizes, and drops the rest', () => {
    expect(sanitizePagePatch({ width: 10, height: 999, collapsed: true, deletedAt: 'x', page: {} })).toEqual({ width: 160, height: 480, collapsed: true });
  });

  it('refuses an empty title or a long description', () => {
    expect(sanitizePagePatch({ title: '  ' })).toBeNull();
    expect(sanitizePagePatch({ description: 'x'.repeat(10001) })).toBeNull();
    expect(sanitizePagePatch({ description: 'x'.repeat(10000) })).not.toBeNull();
  });
});
