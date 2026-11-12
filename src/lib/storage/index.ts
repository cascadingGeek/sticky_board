/**
 * The storage layer (spec 0001 child 0002). It is the ONLY code that calls
 * chrome.storage. The new tab page and the background worker both use it.
 *
 * Notes: one key per note in chrome.storage.local (`note:<id>`).
 * Meta: `meta` in chrome.storage.local. Settings: `settings` in chrome.storage.sync.
 */
import { firstFreeSpot, hostOf, isActive, nextZ, pickColor, type Viewport } from '../board';
import { resolveTz, todayInTz } from '../dates';
import { boardNotes, nextPageZ, notesOnPage } from '../pageNotes';
import { DAY_FULL_MESSAGE, DAY_NOTE_LIMIT, DEFAULT_SETTINGS, PAGE_NOTE_LIMIT, SCHEMA_VERSION, type Meta, type Note, type NoteColor, type PageRef, type Settings } from '../../types';
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

/** Thrown when a day's board already holds DAY_NOTE_LIMIT notes. */
export class DayFullError extends Error {
  constructor() {
    super(DAY_FULL_MESSAGE);
    this.name = 'DayFullError';
  }
}

/** Active board notes on `dateStr`, leaving out `exceptId`. */
export const countOnDay = (all: Note[], dateStr: string, exceptId?: string) =>
  boardNotes(all).filter(n => n.dateStr === dateStr && isActive(n) && n.id !== exceptId).length;

/**
 * Creates a note inside the `note-create` lock shared by every tab and the
 * background worker, so the color rule, z and the day limit never race.
 * Throws DayFullError when the day already has DAY_NOTE_LIMIT notes.
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
  page: PageRef; // built by the background from the sender tab, never from the page's message
  x: number;
  y: number;
  dateStr: string;
  preferredColor?: NoteColor;
}

/** Creates a page note, or refuses with 'limit' when the page already has 50 active notes (AC-18). */
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
 * Takes a note out of Trash. A page note goes back only when its page has
 * room (AC-10), a board note only when its day has room ('day-full'); the
 * check runs in the same `note-create` lock as creating.
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
 * Moves a page note to today's board (spec 0004): a new board note built from
 * it, and the page note to Trash, in one write inside the `note-create` lock.
 * `pageUrl` (from the sender) limits a website to notes on its own address.
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
      noteColor: from.noteColor, // kept as is: the move skips the no repeat color rule
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
 * Undoes a move (spec 0004): the page note comes back first (refused on a full
 * page), then the board note goes to Trash. Two writes in that order, so a
 * failure between them leaves both notes, never neither.
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
 * Spec 0003, AC-2: Light became the default theme. Once only, an existing user
 * (onboarding finished) who never saved a theme gets `dark` saved so their
 * board doesn't change. Reads the raw sync object (parseSettings would fill in
 * the default and hide the missing key) and writes only the theme key on top
 * of it. If sync storage fails, the marker stays unset so the next update tries again.
 */
export const settleThemeDefault = async (): Promise<void> => {
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
