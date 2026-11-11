// A day's board holds at most 50 notes (DAY_NOTE_LIMIT). Every way a note
// lands on a day goes through the storage checks below.
import { describe, expect, it } from 'vitest';
import { createNote, DayFullError, restoreNote } from './storage';
import { makeNote, seedNotes, storedNotes } from '../test/notes';
import { DAY_NOTE_LIMIT, DESCRIPTION_MAX } from '../types';

const DAY = '2026-11-08';
const fill = (n: number, dateStr = DAY) => Array.from({ length: n }, () => makeNote({ dateStr }));

describe('day note limit', () => {
  it('is 50', () => {
    expect(DAY_NOTE_LIMIT).toBe(50);
  });

  it('creates the 50th note and refuses the 51st', async () => {
    await seedNotes(...fill(49));
    await expect(createNote({ title: 'Fiftieth', dateStr: DAY })).resolves.toMatchObject({ title: 'Fiftieth' });
    await expect(createNote({ title: 'One too many', dateStr: DAY })).rejects.toBeInstanceOf(DayFullError);
    expect((await storedNotes()).filter(n => n.title === 'One too many')).toHaveLength(0);
  });

  it('does not count trashed notes, page notes or other days', async () => {
    await seedNotes(
      ...fill(49),
      makeNote({ dateStr: DAY, deletedAt: '2026-11-08T01:00:00.000Z' }),
      makeNote({ dateStr: DAY, page: { url: 'https://meet.google.com/abc', title: 'Meet' } }),
      ...fill(50, '2026-11-09'),
    );
    await expect(createNote({ title: 'Still fits', dateStr: DAY })).resolves.toMatchObject({ title: 'Still fits' });
  });

  it('refuses Restore into a full day and allows it when there is room', async () => {
    const trashed = makeNote({ dateStr: DAY, deletedAt: '2026-11-08T01:00:00.000Z' });
    await seedNotes(trashed, ...fill(50));
    expect(await restoreNote(trashed.id)).toBe('day-full');

    const other = makeNote({ dateStr: '2026-11-09', deletedAt: '2026-11-08T01:00:00.000Z' });
    await seedNotes(other);
    expect(await restoreNote(other.id)).toMatchObject({ id: other.id });
  });
});

describe('description limit', () => {
  it('allows 10,000 characters, counting spaces, punctuation and line breaks', () => {
    expect(DESCRIPTION_MAX).toBe(10000);
  });
});
