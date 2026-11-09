/**
 * Sticky Board app state. Holds notes, settings and meta in memory, writes
 * through the storage layer (src/lib/storage), and stays in sync with other
 * tabs and the background worker through chrome.storage change events.
 */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isDateStr, msUntilNextMidnight, resolveTz, todayInTz } from './dates';
import { playSound, type SoundType } from './sounds';
import { boardNotes } from './pageNotes';
import {
  createNote as storageCreate,
  meta as metaStore,
  notes as noteStore,
  restoreNote as storageRestore,
  settings as settingsStore,
  type NewNoteInput,
} from './storage';
import { DEFAULT_SETTINGS, type Meta, type Note, type ResolvedTheme, type Settings, type ThemeSetting } from '../types';

export type DrawerName = 'calendar' | 'trash' | 'settings' | 'pages';
export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

interface StickyBoardContextType {
  loaded: boolean;
  /** Day board notes only (page notes are never on the board, spec 0002). */
  notes: Note[];
  /** Every note, board and page: for search, Trash, the Pages drawer and Settings. */
  allNotes: Note[];
  settings: Settings;
  meta: Meta;
  tz: string;
  today: string;
  currentDateStr: string;
  setCurrentDateStr: (d: string) => void;

  updateSettings: (fields: Partial<Settings>) => void;
  setThemeOverride: (t: ThemeSetting | null) => void;
  patchMeta: (fields: Partial<Meta>) => Promise<void>;

  createNote: (input: NewNoteInput) => Promise<Note | null>;
  patchNote: (id: string, fields: Partial<Note>) => Promise<boolean>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  deleteForever: (ids: string[]) => Promise<void>;
  sound: (type: SoundType) => void;

  drawer: DrawerName | null;
  openDrawer: (d: DrawerName | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  editorId: string | null;
  setEditorId: (id: string | null) => void;
  highlightId: string | null;
  highlight: (id: string) => void;
  newNoteSignal: number;
  requestNewNote: () => void;

  toasts: Toast[];
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<StickyBoardContextType | undefined>(undefined);

const resolveTheme = (t: ThemeSetting): ResolvedTheme =>
  t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;

const readHashDate = (): string | null => {
  const m = window.location.hash.match(/date=(\d{4}-\d{2}-\d{2})/);
  if (m && isDateStr(m[1])) {
    history.replaceState(null, '', window.location.pathname);
    return m[1];
  }
  return null;
};

export const StickyBoardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded, setLoaded] = useState(false);
  const [noteMap, setNoteMap] = useState<Map<string, Note>>(new Map());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [meta, setMeta] = useState<Meta>({ schemaVersion: 1 });
  const [themeOverride, setThemeOverride] = useState<ThemeSetting | null>(null);
  const tz = resolveTz(settings.timezone);
  const [today, setToday] = useState(() => todayInTz(resolveTz('auto')));
  const [currentDateStr, setCurrentDateStr] = useState(() => readHashDate() ?? todayInTz(resolveTz('auto')));
  const hashDateUsed = useRef(currentDateStr !== todayInTz(resolveTz('auto')));

  const [drawer, setDrawer] = useState<DrawerName | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [newNoteSignal, setNewNoteSignal] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const noteMapRef = useRef(noteMap);
  useLayoutEffect(() => {
    noteMapRef.current = noteMap;
  }, [noteMap]);
  const lastSaved = useRef(new Map<string, Note>());
  const pending = useRef(new Map<string, number>());
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'info', action?: Toast['action']) => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, message, tone, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), action ? 6000 : 4000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const sound = useCallback((type: SoundType) => {
    if (settingsRef.current.soundEnabled) playSound(type);
  }, []);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    Promise.all([noteStore.getAll(), metaStore.get(), settingsStore.get()])
      .then(([all, m, s]) => {
        if (cancelled) return;
        const map = new Map(all.map(n => [n.id, n]));
        lastSaved.current = new Map(map);
        setNoteMap(map);
        setMeta(m);
        setSettings(s);
        const t = todayInTz(resolveTz(s.timezone));
        setToday(t);
        if (!hashDateUsed.current) setCurrentDateStr(t);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
          toast("Couldn't load your notes. Try reopening the tab.", 'error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Live updates from other tabs and the background worker.
  useEffect(() => {
    const unsubNotes = noteStore.subscribe(({ upserted, removed }) => {
      setNoteMap(prev => {
        const next = new Map(prev);
        for (const n of upserted) {
          lastSaved.current.set(n.id, n);
          if (pending.current.get(n.id)) continue; // our own save is in flight; its result wins
          const local = next.get(n.id);
          if (!local || n.updatedAt >= local.updatedAt) next.set(n.id, n);
        }
        for (const id of removed) {
          lastSaved.current.delete(id);
          next.delete(id);
        }
        return next;
      });
    });
    const unsubSettings = settingsStore.subscribe(s => setSettings(s));
    const onMessage = (msg: unknown) => {
      const m = msg as { type?: string; dateStr?: string };
      if (m?.type === 'go-to-date' && isDateStr(m.dateStr)) {
        setDrawer(null);
        setSearchOpen(false);
        setCurrentDateStr(m.dateStr);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    const flush = () => void settingsStore.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubNotes();
      unsubSettings();
      chrome.runtime.onMessage.removeListener(onMessage);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Theme and handwriting on <html>; raw theme cached for the next first paint.
  useEffect(() => {
    const raw = themeOverride ?? settings.theme;
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(raw);
    };
    apply();
    document.documentElement.classList.toggle('no-handwriting', !settings.handwritingFont);
    if (!themeOverride) {
      try {
        localStorage.setItem('sb_theme', settings.theme);
      } catch {
        // Storage can be unavailable; the theme still applies once settings load.
      }
    }
    if (raw !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme, settings.handwritingFont, themeOverride]);

  // Day change: a timer for the next midnight, plus a check whenever the tab is shown.
  const todayRef = useRef(today);
  useLayoutEffect(() => {
    todayRef.current = today;
  }, [today]);
  useEffect(() => {
    const check = () => {
      const t = todayInTz(tz);
      if (t !== todayRef.current) {
        const old = todayRef.current;
        setToday(t);
        setCurrentDateStr(cur => (cur === old ? t : cur));
      }
    };
    check();
    let timer = setTimeout(function tick() {
      check();
      timer = setTimeout(tick, msUntilNextMidnight(tz));
    }, msUntilNextMidnight(tz));
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tz]);

  const updateSettings = useCallback((fields: Partial<Settings>) => {
    setSettings(s => ({ ...s, ...fields }));
    settingsStore.patch(fields);
  }, []);

  const patchMeta = useCallback(async (fields: Partial<Meta>) => {
    setMeta(m => ({ ...m, ...fields }));
    try {
      setMeta(await metaStore.patch(fields));
    } catch {
      toast("Couldn't save that. Please try again.", 'error');
    }
  }, [toast]);

  const createNote = useCallback(async (input: NewNoteInput) => {
    try {
      const note = await storageCreate(input);
      lastSaved.current.set(note.id, note);
      setNoteMap(prev => new Map(prev).set(note.id, note));
      sound('pop');
      return note;
    } catch {
      toast("Couldn't save the note. Your text is still here, try again.", 'error');
      return null;
    }
  }, [sound, toast]);

  const patchNote = useCallback(async (id: string, fields: Partial<Note>) => {
    const before = noteMapRef.current.get(id);
    if (!before) return false;
    const optimistic = { ...before, ...fields, updatedAt: new Date().toISOString() } as Note;
    for (const [k, v] of Object.entries(fields)) if (v === undefined) delete (optimistic as unknown as Record<string, unknown>)[k];
    setNoteMap(prev => new Map(prev).set(id, optimistic));
    pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    let ok = true;
    try {
      lastSaved.current.set(id, await noteStore.patch(id, fields));
    } catch {
      ok = false;
    }
    const left = (pending.current.get(id) ?? 1) - 1;
    if (left > 0) pending.current.set(id, left);
    else pending.current.delete(id);
    if (left === 0) {
      setNoteMap(prev => {
        const next = new Map(prev);
        const latest = lastSaved.current.get(id);
        if (latest) next.set(id, latest);
        else next.delete(id);
        return next;
      });
    }
    if (!ok) toast("Couldn't save that change, so it was undone.", 'error');
    return ok;
  }, [toast]);

  const trashNote = useCallback(async (id: string) => {
    const note = noteMapRef.current.get(id);
    sound('crumple');
    const ok = await patchNote(id, { deletedAt: new Date().toISOString() });
    if (ok && note) {
      toast(`“${note.title}” moved to Trash`, 'info', {
        label: 'Undo',
        run: () => void restoreRef.current(id),
      });
    }
  }, [patchNote, sound, toast]);

  /** Takes a note out of Trash; a full page (50 notes) refuses it (spec 0002 AC-10). */
  const restoreNote = useCallback(async (id: string) => {
    try {
      const r = await storageRestore(id);
      if (r === 'limit') {
        toast('This page already has 50 notes.', 'error');
        return;
      }
      if (r) {
        lastSaved.current.set(id, r);
        setNoteMap(prev => new Map(prev).set(id, r));
      }
    } catch {
      toast("Couldn't restore that note. Please try again.", 'error');
    }
  }, [toast]);
  const restoreRef = useRef(restoreNote);
  useLayoutEffect(() => {
    restoreRef.current = restoreNote;
  }, [restoreNote]);

  const deleteForever = useCallback(async (ids: string[]) => {
    try {
      await noteStore.remove(ids);
      setNoteMap(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    } catch {
      toast("Couldn't delete that. Please try again.", 'error');
    }
  }, [toast]);

  const highlight = useCallback((id: string) => {
    setHighlightId(id);
    setTimeout(() => setHighlightId(h => (h === id ? null : h)), 2000);
  }, []);

  const openDrawer = useCallback((d: DrawerName | null) => {
    setSearchOpen(false);
    setDrawer(d);
  }, []);

  const openSearch = useCallback((open: boolean) => {
    if (open) setDrawer(null);
    setSearchOpen(open);
  }, []);

  const allNotes = useMemo(() => [...noteMap.values()], [noteMap]);
  const notes = useMemo(() => boardNotes(allNotes), [allNotes]);

  const value: StickyBoardContextType = {
    loaded,
    notes,
    allNotes,
    settings,
    meta,
    tz,
    today,
    currentDateStr,
    setCurrentDateStr,
    updateSettings,
    setThemeOverride,
    patchMeta,
    createNote,
    patchNote,
    trashNote,
    restoreNote,
    deleteForever,
    sound,
    drawer,
    openDrawer,
    searchOpen,
    setSearchOpen: openSearch,
    editorId,
    setEditorId,
    highlightId,
    highlight,
    newNoteSignal,
    requestNewNote: () => setNewNoteSignal(n => n + 1),
    toasts,
    toast,
    dismissToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useStickyBoard = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStickyBoard must be used within a StickyBoardProvider');
  return c;
};
