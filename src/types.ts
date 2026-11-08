/**
 * Sticky Board domain types (spec 0001, cross child contract).
 * Notes live in chrome.storage.local (one key per note), meta in
 * chrome.storage.local under `meta`, settings in chrome.storage.sync.
 */

export const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange', 'mint', 'cream'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface NoteSource {
  url: string;
  title: string;
}

export interface Note {
  id: string;
  title: string; // 1 to 200 chars
  description: string; // up to 5,000 chars
  isCompleted: boolean;
  dateStr: string; // YYYY-MM-DD in the resolved timezone
  noteColor: NoteColor;
  subtasks: Subtask[]; // max 50
  dueTime?: string; // HH:MM
  positionX: number;
  positionY: number;
  z: number; // stacking order, raised only on create or move
  remind: boolean;
  remindedAt?: string; // written only by the background worker
  source?: NoteSource;
  carriedFromId?: string;
  carriedToDate?: string;
  deletedAt?: string; // set means it is in Trash
  createdAt: string;
  updatedAt: string;
}

export interface Meta {
  schemaVersion: number;
  onboardedAt?: string;
  lastCarryOverPromptDate?: string;
}

export const THEMES = ['dark', 'light', 'midnight', 'cork', 'system'] as const;
export type ThemeSetting = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<ThemeSetting, 'system'>;

export interface Settings {
  theme: ThemeSetting;
  handwritingFont: boolean;
  soundEnabled: boolean;
  timezone: string; // 'auto' or an IANA zone the user picked
  startOfWeek: 0 | 1;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  handwritingFont: true,
  soundEnabled: true,
  timezone: 'auto',
  startOfWeek: 0,
};

export const SCHEMA_VERSION = 1;

export const NOTE_SIZE = 220;
export const NOTE_GAP = 24;
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const SUBTASKS_MAX = 50;
export const TRASH_DAYS = 30;
