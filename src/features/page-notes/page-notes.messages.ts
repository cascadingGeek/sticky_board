/** Messages between the content script, the Allow window and the background. Pages never write storage. */
import { DESCRIPTION_MAX, SUBTASKS_MAX, TITLE_MAX } from '@/features/notes/notes.constants';
import type { Note, NoteColor, Subtask } from '@/features/notes/notes.types';
import { clampHeight, clampWidth } from '@/features/notes/page-notes.rules';

/** Content script → background. */
export type PageRequest =
  | { type: 'page-notes/hello' }
  | { type: 'page-notes/create'; x: number; y: number; title: string; color?: NoteColor }
  | { type: 'page-notes/patch'; id: string; fields: PagePatch }
  | { type: 'page-notes/trash'; id: string }
  | { type: 'page-notes/move-to-board'; id: string }
  | { type: 'page-notes/undo-move'; pageId: string; boardId: string }
  | { type: 'page-notes/open-access'; host: string };

export type HelloReply = { allowed: boolean };
export type WriteReply = { note: Note } | { error: 'limit' | 'gone' | 'invalid' | 'failed' };
/** Moving a page note to today's board. */
export type MoveReply = { pageId: string; boardId: string } | { error: 'day-full' | 'gone' | 'invalid' | 'failed' };
export type UndoMoveReply = { ok: true } | { error: 'limit' | 'gone' | 'invalid' | 'failed' };

/** Site access window → background. */
export type AccessGranted = { type: 'site-access/granted'; tabId: number };

/** Background → content script. */
export type PageCommand =
  | { type: 'page-notes/ping' }
  | { type: 'page-notes/new-draft'; via: 'menu' | 'shortcut' }
  | { type: 'page-notes/access'; allowed: boolean };

export const PING_REPLY = 'page-notes/pong';

export const isPageRequest = (m: unknown): m is PageRequest =>
  !!m && typeof m === 'object' && typeof (m as { type?: unknown }).type === 'string' && (m as { type: string }).type.startsWith('page-notes/');

export type PagePatch = Partial<Pick<Note, 'title' | 'description' | 'subtasks' | 'positionX' | 'positionY' | 'width' | 'height' | 'collapsed'>>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A clean patch of the fields a page may change, or null if any is invalid. */
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
