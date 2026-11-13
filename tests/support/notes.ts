import type { Note } from '@/shared/types';

let seq = 0;

/** A valid stored note with sensible defaults; override any field. */
export const makeNote = (fields: Partial<Note> = {}): Note => {
  seq += 1;
  const ts = fields.createdAt ?? new Date(Date.UTC(2026, 10, 8, 9, 0, seq)).toISOString();
  return {
    id: `n${seq}`,
    title: `Note ${seq}`,
    description: '',
    isCompleted: false,
    dateStr: '2026-11-08',
    noteColor: 'yellow',
    subtasks: [],
    positionX: 24,
    positionY: 24,
    z: 1,
    remind: false,
    createdAt: ts,
    updatedAt: ts,
    ...fields,
  };
};

/** Puts notes straight into fake storage under their `note:<id>` keys. */
export const seedNotes = async (...notes: Note[]) =>
  chrome.storage.local.set(Object.fromEntries(notes.map(n => [`note:${n.id}`, n])));

/** Reads every stored note back out of fake storage. */
export const storedNotes = async (): Promise<Note[]> => {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith('note:'))
    .map(([, v]) => v as Note);
};
