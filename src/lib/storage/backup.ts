import { firstFreeSpot, isActive, nextZ } from '../board';
import { boardNotes, nextPageZ } from '../pageNotes';
import { SCHEMA_VERSION, type Note } from '../../types';
import { notes, settings } from './index';
import { parseNote, parseSettings } from './validate';

const MAX_BYTES = 50 * 1024 * 1024;

export interface BackupFile {
  app: 'sticky-board';
  schemaVersion: number;
  exportedAt: string;
  notes: Note[];
  settings: unknown;
}

export const exportBackup = async (): Promise<Blob> => {
  const data: BackupFile = {
    app: 'sticky-board',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    notes: await notes.getAll(),
    settings: await settings.get(),
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
};

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export class ImportError extends Error {}

/** Older backup files would be upgraded here, version by version. */
const migrateFile = (file: Record<string, unknown>): Record<string, unknown> => file;

/**
 * Validates the whole file first, so nothing is half imported, then merges by
 * id: new notes are added and the newer copy wins (local on a tie).
 */
export const importBackup = async (file: File, restoreSettings: boolean): Promise<ImportResult> => {
  if (file.size > MAX_BYTES) throw new ImportError('That file is larger than 50 MB.');
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new ImportError("That file isn't a Sticky Board backup (it isn't valid JSON).");
  }
  if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).app !== 'sticky-board') {
    throw new ImportError("That file isn't a Sticky Board backup.");
  }
  const version = Number((raw as Record<string, unknown>).schemaVersion);
  if (!Number.isFinite(version)) throw new ImportError("That backup has no version, so it can't be read safely.");
  if (version > SCHEMA_VERSION) throw new ImportError('This backup is from a newer version of Sticky Board. Update the extension first.');

  const data = migrateFile(raw as Record<string, unknown>);
  if (!Array.isArray(data.notes)) throw new ImportError("That backup doesn't contain any notes.");

  const parsed = data.notes.map(parseNote);
  const bad = parsed.findIndex(n => n === null);
  if (bad !== -1) throw new ImportError(`Note ${bad + 1} in that file is damaged, so nothing was imported.`);

  const local = await notes.getAll();
  const byId = new Map(local.map(n => [n.id, n]));
  const working = [...local];
  const toWrite: Note[] = [];
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };

  for (const p of parsed) {
    if (!p) continue;
    // Older files may lack a position or z: give them the first free cell.
    let note: Note;
    if (p.page) {
      // Page notes keep their saved page spot; never moved to a board spot.
      note = { ...p, positionX: p.positionX ?? 24, positionY: p.positionY ?? 24, z: p.z ?? nextPageZ(working, p.page.url) };
    } else if (p.positionX === undefined || p.positionY === undefined || p.z === undefined) {
      const board = boardNotes(working);
      const day = board.filter(n => n.dateStr === p.dateStr && isActive(n));
      const pos = firstFreeSpot(day, { top: 0, width: 1280 });
      note = { ...p, positionX: p.positionX ?? pos.x, positionY: p.positionY ?? pos.y, z: p.z ?? nextZ(board, p.dateStr) };
    } else {
      note = p as Note;
    }
    const existing = byId.get(note.id);
    if (!existing) {
      result.added++;
    } else if (note.updatedAt > existing.updatedAt) {
      result.updated++;
    } else {
      result.skipped++;
      continue;
    }
    toWrite.push(note);
    working.push(note);
  }

  await notes.putMany(toWrite);
  if (restoreSettings && data.settings) await settings.replace(parseSettings(data.settings));
  return result;
};
