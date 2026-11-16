/** The Note shape. Board notes and page notes are the same entity; `page` tells them apart. */

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

/** The page a page note is pinned to. `url` has no `#part`. */
export interface PageRef {
  url: string;
  title: string;
}

export interface Note {
  id: string;
  title: string; // 1 to 200 chars
  description: string; // up to 10,000 chars
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
  page?: PageRef; // present means a page note
  width?: number; // page notes only, 160 to 480
  height?: number; // page notes only, 120 to 480
  collapsed?: boolean; // page notes only
  createdAt: string;
  updatedAt: string;
}
