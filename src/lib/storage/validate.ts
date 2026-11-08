import { isDateStr, isTimeStr } from '../dates';
import { isHttpUrl } from '../board';
import {
  DEFAULT_SETTINGS,
  DESCRIPTION_MAX,
  NOTE_COLORS,
  SUBTASKS_MAX,
  THEMES,
  TITLE_MAX,
  type Note,
  type NoteColor,
  type Settings,
} from '../../types';

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Checks one stored or imported object against the Note shape and returns a
 * clean Note with only known fields, or null when it is invalid. Missing
 * positions and z are allowed here (older files); the caller fills them.
 */
export const parseNote = (raw: unknown): (Omit<Note, 'positionX' | 'positionY' | 'z'> & Partial<Pick<Note, 'positionX' | 'positionY' | 'z'>>) | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.title !== 'string' || !r.title.trim() || r.title.length > TITLE_MAX) return null;
  const description = r.description ?? '';
  if (typeof description !== 'string' || description.length > DESCRIPTION_MAX) return null;
  if (!isDateStr(r.dateStr)) return null;
  if (!NOTE_COLORS.includes(r.noteColor as NoteColor)) return null;
  if (!isIso(r.createdAt) || !isIso(r.updatedAt)) return null;

  const subtasksRaw = r.subtasks ?? [];
  if (!Array.isArray(subtasksRaw) || subtasksRaw.length > SUBTASKS_MAX) return null;
  const subtasks = [];
  for (const s of subtasksRaw) {
    if (!s || typeof s !== 'object') return null;
    const st = s as Record<string, unknown>;
    if (typeof st.id !== 'string' || typeof st.title !== 'string' || typeof st.isCompleted !== 'boolean') return null;
    subtasks.push({ id: st.id, title: st.title, isCompleted: st.isCompleted });
  }

  if (r.dueTime !== undefined && !isTimeStr(r.dueTime)) return null;
  if (r.positionX !== undefined && !isNum(r.positionX)) return null;
  if (r.positionY !== undefined && !isNum(r.positionY)) return null;
  if (r.z !== undefined && !isNum(r.z)) return null;
  if (r.remindedAt !== undefined && !isIso(r.remindedAt)) return null;
  if (r.deletedAt !== undefined && !isIso(r.deletedAt)) return null;
  if (r.carriedToDate !== undefined && !isDateStr(r.carriedToDate)) return null;
  if (r.carriedFromId !== undefined && typeof r.carriedFromId !== 'string') return null;

  let source: Note['source'];
  if (r.source !== undefined) {
    const s = r.source as Record<string, unknown> | null;
    if (!s || typeof s.url !== 'string' || !isHttpUrl(s.url)) return null;
    source = { url: s.url, title: typeof s.title === 'string' ? s.title : '' };
  }

  return {
    id: r.id,
    title: r.title,
    description,
    isCompleted: r.isCompleted === true,
    dateStr: r.dateStr,
    noteColor: r.noteColor as NoteColor,
    subtasks,
    dueTime: r.dueTime as string | undefined,
    positionX: r.positionX as number | undefined,
    positionY: r.positionY as number | undefined,
    z: r.z as number | undefined,
    remind: r.remind === true,
    remindedAt: r.remindedAt as string | undefined,
    source,
    carriedFromId: r.carriedFromId as string | undefined,
    carriedToDate: r.carriedToDate as string | undefined,
    deletedAt: r.deletedAt as string | undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

/** Each settings field is checked on its own; an invalid one falls back to its default. */
export const parseSettings = (raw: unknown): Settings => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: THEMES.includes(r.theme as Settings['theme']) ? (r.theme as Settings['theme']) : DEFAULT_SETTINGS.theme,
    handwritingFont: typeof r.handwritingFont === 'boolean' ? r.handwritingFont : DEFAULT_SETTINGS.handwritingFont,
    soundEnabled: typeof r.soundEnabled === 'boolean' ? r.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    timezone: typeof r.timezone === 'string' && r.timezone ? r.timezone : DEFAULT_SETTINGS.timezone,
    startOfWeek: r.startOfWeek === 1 ? 1 : 0,
  };
};
