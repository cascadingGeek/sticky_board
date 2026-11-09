/**
 * Page notes (spec 0002): the shared rules for notes pinned on web pages.
 * Used by the board, the background worker and the page-notes content script.
 */
import {
  DESCRIPTION_MAX,
  NOTE_GAP,
  NOTE_SIZE,
  PAGE_NOTE_MAX_H,
  PAGE_NOTE_MAX_W,
  PAGE_NOTE_MIN_H,
  PAGE_NOTE_MIN_W,
  PAGE_URL_MAX,
  SUBTASKS_MAX,
  TITLE_MAX,
  type Note,
  type Subtask,
} from '../types';
import { isActive } from './board';

/** A page address without its `#part`, or null when it isn't a usable http(s) address. */
export const normalizePageUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    // Keep scheme, host, path and query exactly as given; only the #part goes.
    const i = value.indexOf('#');
    const out = i === -1 ? value : value.slice(0, i);
    return out.length <= PAGE_URL_MAX ? out : null;
  } catch {
    return null;
  }
};

export const isPageNote = (n: Note): boolean => !!n.page;

/** The one selector that keeps page notes off the day board, calendar, carry over and reminders. */
export const boardNotes = (all: Note[]): Note[] => all.filter(n => !n.page);

/** Active notes pinned to exactly this (normalized) address. */
export const notesOnPage = (all: Note[], url: string): Note[] => all.filter(n => isActive(n) && n.page?.url === url);

/** The site label used in the Pages drawer, search and Trash: the host, as is. */
export const siteOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export const pageTitleFrom = (title: string | undefined): string => (title ?? '').slice(0, 200);

export const clampWidth = (w: number) => Math.round(Math.min(PAGE_NOTE_MAX_W, Math.max(PAGE_NOTE_MIN_W, w)));
export const clampHeight = (h: number) => Math.round(Math.min(PAGE_NOTE_MAX_H, Math.max(PAGE_NOTE_MIN_H, h)));
export const noteWidth = (n: Note) => clampWidth(n.width ?? NOTE_SIZE);
export const noteHeight = (n: Note) => clampHeight(n.height ?? NOTE_SIZE);

/** 1 more than the highest z among active notes on the same page. */
export const nextPageZ = (all: Note[], url: string): number =>
  notesOnPage(all, url).reduce((max, n) => Math.max(max, n.z ?? 0), 0) + 1;

/**
 * The shortcut spot (AC-3): 24 px in from the visible top left, moved down and
 * right 24 px for each active note whose saved spot is within 12 px of it.
 */
export const stackedSpot = (pageNotes: Note[], scrollX: number, scrollY: number): { x: number; y: number } => {
  let x = Math.round(scrollX + NOTE_GAP);
  let y = Math.round(scrollY + NOTE_GAP);
  for (let i = 0; i < pageNotes.length + 1; i++) {
    const taken = pageNotes.some(n => isActive(n) && Math.abs(n.positionX - x) <= 12 && Math.abs(n.positionY - y) <= 12);
    if (!taken) break;
    x += NOTE_GAP;
    y += NOTE_GAP;
  }
  return { x, y };
};

/** Where a note is drawn (never saved): kept inside the page so it can't get lost. */
export const drawnSpot = (n: Note, scrollWidth: number, scrollHeight: number): { x: number; y: number } => ({
  x: Math.max(0, Math.min(n.positionX, scrollWidth - noteWidth(n) - 8)),
  y: Math.max(0, Math.min(n.positionY, scrollHeight - 40)),
});

/** The label on a collapsed note: the first 20 characters of its title. */
export const collapsedLabel = (title: string) => title.slice(0, 20);

export type PagePatch = Partial<Pick<Note, 'title' | 'description' | 'subtasks' | 'positionX' | 'positionY' | 'width' | 'height' | 'collapsed'>>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Checks the fields a page may change and returns a clean patch, or null when
 * anything is invalid. Unknown fields are dropped.
 */
export const sanitizePagePatch = (raw: unknown): PagePatch | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: PagePatch = {};
  if ('title' in r) {
    if (typeof r.title !== 'string' || !r.title.trim() || r.title.length > TITLE_MAX) return null;
    out.title = r.title;
  }
  if ('description' in r) {
    if (typeof r.description !== 'string' || r.description.length > DESCRIPTION_MAX) return null;
    out.description = r.description;
  }
  if ('subtasks' in r) {
    if (!Array.isArray(r.subtasks) || r.subtasks.length > SUBTASKS_MAX) return null;
    const list: Subtask[] = [];
    for (const s of r.subtasks) {
      const st = s as Record<string, unknown> | null;
      if (!st || typeof st.id !== 'string' || typeof st.title !== 'string' || typeof st.isCompleted !== 'boolean') return null;
      list.push({ id: st.id, title: st.title.slice(0, TITLE_MAX), isCompleted: st.isCompleted });
    }
    out.subtasks = list;
  }
  for (const k of ['positionX', 'positionY'] as const) {
    if (k in r) {
      if (!isNum(r[k])) return null;
      out[k] = Math.round(r[k]);
    }
  }
  if ('width' in r) {
    if (!isNum(r.width)) return null;
    out.width = clampWidth(r.width);
  }
  if ('height' in r) {
    if (!isNum(r.height)) return null;
    out.height = clampHeight(r.height);
  }
  if ('collapsed' in r) {
    if (typeof r.collapsed !== 'boolean') return null;
    out.collapsed = r.collapsed;
  }
  return out;
};

/** Opens a page note's page in a new tab (Pages drawer and search). */
export const openPage = (n: Note) => {
  if (n.page) void chrome.tabs.create({ url: n.page.url });
};
