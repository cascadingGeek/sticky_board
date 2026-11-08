/**
 * The storage layer (spec 0001 child 0002). It is the ONLY code that calls
 * chrome.storage. The new tab page and the background worker both use it.
 *
 * Notes: one key per note in chrome.storage.local (`note:<id>`).
 * Meta: `meta` in chrome.storage.local. Settings: `settings` in chrome.storage.sync.
 */
import { firstFreeSpot, isActive, nextZ, pickColor, type Viewport } from '../board';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type Meta, type Note, type NoteColor, type Settings } from '../../types';
import { parseNote, parseSettings } from './validate';

const NOTE_PREFIX = 'note:';
const META_KEY = 'meta';
const SETTINGS_KEY = 'settings';

export const noteKey = (id: string) => `${NOTE_PREFIX}${id}`;
const nowIso = () => new Date().toISOString();

/** A stored note always has a position and z; older data gets safe defaults. */
const normalize = (raw: unknown): Note | null => {
  const n = parseNote(raw);
  if (!n) return null;
  return { ...n, positionX: n.positionX ?? 24, positionY: n.positionY ?? 24, z: n.z ?? 1 };
};

/** Applies a partial update; `undefined` values remove the field. */
const merge = (note: Note, fields: Partial<Note>): Note => {
  const next: Record<string, unknown> = { ...note };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return next as unknown as Note;
};

// Saves for the same note run one at a time, so they can't land out of order.
const queues = new Map<string, Promise<unknown>>();
const enqueue = <T>(id: string, task: () => Promise<T>): Promise<T> => {
  const prev = queues.get(id) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(task);
  queues.set(id, run);
  run.finally(() => {
    if (queues.get(id) === run) queues.delete(id);
  });
  return run;
};

export const notes = {
  async getAll(): Promise<Note[]> {
    const all = await chrome.storage.local.get(null);
    const out: Note[] = [];
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith(NOTE_PREFIX)) continue;
      const n = normalize(value);
      if (n) out.push(n);
    }
    return out;
  },

  async get(id: string): Promise<Note | null> {
    const key = noteKey(id);
    const res = await chrome.storage.local.get(key);
    return normalize(res[key]);
  },

  /**
   * The only way to change an existing note: reads the latest stored copy,
   * merges only `fields`, sets updatedAt, writes. Rejects if the note is gone.
   */
  patch(id: string, fields: Partial<Note>): Promise<Note> {
    return enqueue(id, async () => {
      const current = await notes.get(id);
      if (!current) throw new Error('This note no longer exists.');
      const next = merge(current, { ...fields, updatedAt: nowIso() });
      await chrome.storage.local.set({ [noteKey(id)]: next });
      return next;
    });
  },

  async putMany(list: Note[]): Promise<void> {
    if (!list.length) return;
    await chrome.storage.local.set(Object.fromEntries(list.map(n => [noteKey(n.id), n])));
  },

  async remove(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await chrome.storage.local.remove(ids.map(noteKey));
  },

  /** Reports notes added or changed (`upserted`) and removed, from any tab or the worker. */
  subscribe(cb: (change: { upserted: Note[]; removed: string[] }) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      const upserted: Note[] = [];
      const removed: string[] = [];
      for (const [key, change] of Object.entries(changes)) {
        if (!key.startsWith(NOTE_PREFIX)) continue;
        if (change.newValue === undefined) removed.push(key.slice(NOTE_PREFIX.length));
        else {
          const n = normalize(change.newValue);
          if (n) upserted.push(n);
        }
      }
      if (upserted.length || removed.length) cb({ upserted, removed });
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};

export interface NewNoteInput {
  title: string;
  dateStr: string;
  description?: string;
  subtasks?: Note['subtasks'];
  source?: Note['source'];
  position?: { x: number; y: number }; // omitted: first free spot in `viewport`
  viewport?: Viewport;
  preferredColor?: NoteColor;
}

/**
 * Creates a note inside the `note-create` lock shared by every tab and the
 * background worker, so the color rule and z never race.
 */
export const createNote = (input: NewNoteInput): Promise<Note> =>
  navigator.locks.request('note-create', async () => {
    const all = await notes.getAll();
    const day = all.filter(n => n.dateStr === input.dateStr && isActive(n));
    const pos = input.position ?? firstFreeSpot(day, input.viewport ?? { top: 0, width: 1280 });
    const ts = nowIso();
    const note: Note = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? '',
      isCompleted: false,
      dateStr: input.dateStr,
      noteColor: pickColor(all, input.preferredColor),
      subtasks: input.subtasks ?? [],
      positionX: Math.round(pos.x),
      positionY: Math.round(pos.y),
      z: nextZ(all, input.dateStr),
      remind: false,
      ...(input.source ? { source: input.source } : {}),
      createdAt: ts,
      updatedAt: ts,
    };
    await chrome.storage.local.set({ [noteKey(note.id)]: note });
    return note;
  });

export const meta = {
  async get(): Promise<Meta> {
    const res = await chrome.storage.local.get(META_KEY);
    const m = res[META_KEY] as Partial<Meta> | undefined;
    return { schemaVersion: SCHEMA_VERSION, ...(m ?? {}) };
  },
  async patch(fields: Partial<Meta>): Promise<Meta> {
    const next = { ...(await meta.get()), ...fields };
    await chrome.storage.local.set({ [META_KEY]: next });
    return next;
  },
};

// Settings: debounced writes (sync allows 120 writes per minute), flushed on page hide.
let pendingSettings: Partial<Settings> | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | null = null;

export const settings = {
  async get(): Promise<Settings> {
    try {
      const res = await chrome.storage.sync.get(SETTINGS_KEY);
      return parseSettings(res[SETTINGS_KEY]);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  patch(fields: Partial<Settings>): void {
    pendingSettings = { ...(pendingSettings ?? {}), ...fields };
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => void settings.flush(), 500);
  },

  async flush(): Promise<void> {
    if (settingsTimer) clearTimeout(settingsTimer);
    settingsTimer = null;
    if (!pendingSettings) return;
    const fields = pendingSettings;
    pendingSettings = null;
    const current = await settings.get();
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...current, ...fields } });
  },

  async replace(next: Settings): Promise<void> {
    pendingSettings = null;
    await chrome.storage.sync.set({ [SETTINGS_KEY]: parseSettings(next) });
  },

  subscribe(cb: (s: Settings) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes[SETTINGS_KEY]) cb(parseSettings(changes[SETTINGS_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
};

/** Removes notes that have been in Trash for more than 30 days. */
export const purgeTrash = async (now = Date.now()): Promise<number> => {
  const all = await notes.getAll();
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  const old = all.filter(n => n.deletedAt && Date.parse(n.deletedAt) < cutoff).map(n => n.id);
  await notes.remove(old);
  return old.length;
};

/** Migrations run in order by the background worker. None yet beyond version 1. */
export const runMigrations = async (): Promise<void> => {
  const m = await meta.get();
  if (m.schemaVersion < SCHEMA_VERSION) await meta.patch({ schemaVersion: SCHEMA_VERSION });
  else if (!(await chrome.storage.local.get(META_KEY))[META_KEY]) await meta.patch({ schemaVersion: SCHEMA_VERSION });
};
