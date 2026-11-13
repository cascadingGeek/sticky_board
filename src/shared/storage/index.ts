/**
 * The only code that calls chrome.storage. Notes live one per key in local
 * (`note:<id>`), meta under `meta` in local, and settings in sync.
 */
import { firstFreeSpot, hostOf, isActive, nextZ, pickColor, type Viewport } from '../notes';
import { resolveTz, todayInTz } from '../dates';
import { boardNotes, nextPageZ, notesOnPage } from '../pageNotes';
import { DAY_FULL_MESSAGE, DAY_NOTE_LIMIT, DEFAULT_SETTINGS, PAGE_NOTE_LIMIT, SCHEMA_VERSION, type Meta, type Note, type NoteColor, type PageRef, type Settings } from '../types';
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
  // Cleanup only. The caller handles `run`'s error; this copy must not report it again.
  run
    .finally(() => {
      if (queues.get(id) === run) queues.delete(id);
    })
    .catch(() => undefined);
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

  /** Merges `fields` into the latest stored copy. Rejects if the note is gone. */
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

export class DayFullError extends Error {
  constructor() {
    super(DAY_FULL_MESSAGE);
    this.name = 'DayFullError';
  }
}

export const countOnDay = (all: Note[], dateStr: string, exceptId?: string) =>
  boardNotes(all).filter(n => n.dateStr === dateStr && isActive(n) && n.id !== exceptId).length;

/**
 * Runs inside the `note-create` lock shared by every tab and the background,
 * so the color rule, z and the day limit never race.
 */
export const createNote = (input: NewNoteInput): Promise<Note> =>
  navigator.locks.request('note-create', async () => {
    const all = await notes.getAll();
    const board = boardNotes(all);
    const day = board.filter(n => n.dateStr === input.dateStr && isActive(n));
    if (day.length >= DAY_NOTE_LIMIT) throw new DayFullError();
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
      z: nextZ(board, input.dateStr),
      remind: false,
      ...(input.source ? { source: input.source } : {}),
      createdAt: ts,
      updatedAt: ts,
    };
    await chrome.storage.local.set({ [noteKey(note.id)]: note });
    return note;
  });

export interface NewPageNoteInput {
  title: string;
  page: PageRef; // from the sender tab, never from the page's message
  x: number;
  y: number;
  dateStr: string;
  preferredColor?: NoteColor;
}

/** Refuses with 'limit' when the page already has 50 active notes. */
export const createPageNote = (input: NewPageNoteInput): Promise<Note | 'limit'> =>
  navigator.locks.request('note-create', async () => {
    const all = await notes.getAll();
    if (notesOnPage(all, input.page.url).length >= PAGE_NOTE_LIMIT) return 'limit';
    const ts = nowIso();
    const note: Note = {
      id: crypto.randomUUID(),
      title: input.title,
      description: '',
      isCompleted: false,
      dateStr: input.dateStr,
      noteColor: pickColor(all, input.preferredColor),
      subtasks: [],
      positionX: Math.round(input.x),
      positionY: Math.round(input.y),
      z: nextPageZ(all, input.page.url),
      remind: false,
      page: input.page,
      createdAt: ts,
      updatedAt: ts,
    };
    await chrome.storage.local.set({ [noteKey(note.id)]: note });
    return note;
  });

/**
 * A page note needs room on its page and a board note room on its day,
 * checked inside the same `note-create` lock as creating.
 */
export const restoreNote = (id: string): Promise<Note | 'limit' | 'day-full' | null> =>
  navigator.locks.request('note-create', async () => {
    const note = await notes.get(id);
    if (!note) return null;
    if (note.deletedAt) {
      const all = await notes.getAll();
      if (note.page) {
        if (notesOnPage(all, note.page.url).length >= PAGE_NOTE_LIMIT) return 'limit';
      } else if (countOnDay(all, note.dateStr) >= DAY_NOTE_LIMIT) return 'day-full';
    }
    return notes.patch(id, { deletedAt: undefined });
  });

export type MoveResult = { board: Note; page: Note } | 'day-full' | 'gone';

/**
 * Moves a page note to today's board in one write inside `note-create`.
 * `pageUrl` comes from the sender, so a site can only move its own notes.
 */
export const movePageNoteToBoard = async (id: string, pageUrl?: string): Promise<MoveResult> => {
  // Let saves already queued for this note land first, so the move reads its latest text.
  await (queues.get(id) ?? Promise.resolve()).catch(() => undefined);
  return navigator.locks.request('note-create', async () => {
    const all = await notes.getAll();
    const from = all.find(n => n.id === id);
    if (!from?.page || from.deletedAt || (pageUrl !== undefined && from.page.url !== pageUrl)) return 'gone';
    const dateStr = todayInTz(resolveTz((await settings.get()).timezone));
    const board = boardNotes(all);
    const day = board.filter(n => n.dateStr === dateStr && isActive(n));
    if (day.length >= DAY_NOTE_LIMIT) return 'day-full';
    const pos = firstFreeSpot(day, { top: 0, width: 1280 });
    const ts = nowIso();
    const moved: Note = {
      id: crypto.randomUUID(),
      title: from.title,
      description: from.description,
      isCompleted: from.isCompleted,
      dateStr,
      noteColor: from.noteColor, // the no repeat color rule doesn't apply to moves
      subtasks: from.subtasks.map(s => ({ ...s, id: crypto.randomUUID() })),
      positionX: Math.round(pos.x),
      positionY: Math.round(pos.y),
      z: nextZ(board, dateStr),
      remind: false,
      source: { url: from.page.url, title: (from.page.title || hostOf(from.page.url)).slice(0, 200) },
      createdAt: ts,
      updatedAt: ts,
    };
    const trashed: Note = { ...from, deletedAt: ts, updatedAt: ts };
    await chrome.storage.local.set({ [noteKey(moved.id)]: moved, [noteKey(from.id)]: trashed });
    return { board: moved, page: trashed };
  });
};

export type UndoMoveResult = { page: Note; board: Note | null } | 'limit' | 'gone' | 'invalid';

/**
 * The page note comes back first (refused on a full page), then the board note
 * goes to Trash, so a failure between the writes leaves both, never neither.
 */
export const undoMoveToBoard = (pageId: string, boardId: string, pageUrl?: string): Promise<UndoMoveResult> =>
  navigator.locks.request('note-create', async () => {
    const all = await notes.getAll();
    const page = all.find(n => n.id === pageId);
    if (!page?.page || (pageUrl !== undefined && page.page.url !== pageUrl)) return 'gone';
    const board = all.find(n => n.id === boardId) ?? null;
    if (board && (board.page || board.source?.url !== page.page.url)) return 'invalid';
    let restored = page;
    if (page.deletedAt) {
      if (notesOnPage(all, page.page.url).length >= PAGE_NOTE_LIMIT) return 'limit';
      restored = await notes.patch(pageId, { deletedAt: undefined });
    }
    const after = board && !board.deletedAt ? await notes.patch(boardId, { deletedAt: nowIso() }) : board;
    return { page: restored, board: after };
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

/**
 * Light became the default theme. Existing users who never saved one get `dark`
 * saved once, so their board doesn't change. Reads raw sync data, since
 * parseSettings would fill in the default.
 */
const settleThemeDefault = async (): Promise<void> => {
  const m = await meta.get();
  if (m.themeDefaultCheckedAt) return;
  try {
    const res = await chrome.storage.sync.get(SETTINGS_KEY);
    const raw = res[SETTINGS_KEY];
    const stored = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    if (m.onboardedAt && !('theme' in stored)) {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...stored, theme: 'dark' } });
    }
  } catch {
    return;
  }
  await meta.patch({ themeDefaultCheckedAt: nowIso() });
};

/** Migrations run in order by the background worker on install and update. */
export const runMigrations = async (): Promise<void> => {
  const m = await meta.get();
  if (m.schemaVersion < SCHEMA_VERSION) await meta.patch({ schemaVersion: SCHEMA_VERSION });
  else if (!(await chrome.storage.local.get(META_KEY))[META_KEY]) await meta.patch({ schemaVersion: SCHEMA_VERSION });
  await settleThemeDefault();
};
