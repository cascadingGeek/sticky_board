import { NOTE_COLORS, NOTE_GAP, NOTE_SIZE, type Note, type NoteColor } from '../types';

/** Notes that are not in Trash. */
export const isActive = (n: Note) => !n.deletedAt;

/**
 * The "latest note" for the random color rule: greatest createdAt among notes
 * that are not carry over copies, ties broken by the greater id.
 */
export const latestNoteColor = (notes: Note[]): NoteColor | undefined => {
  let latest: Note | undefined;
  for (const n of notes) {
    if (n.carriedFromId) continue;
    if (!latest || n.createdAt > latest.createdAt || (n.createdAt === latest.createdAt && n.id > latest.id)) latest = n;
  }
  return latest?.noteColor;
};

/** Uniform pick from the 8 presets, never the latest note's color. */
export const pickColor = (notes: Note[], preferred?: NoteColor): NoteColor => {
  const previous = latestNoteColor(notes);
  if (preferred && preferred !== previous) return preferred;
  const allowed = NOTE_COLORS.filter(c => c !== previous);
  return allowed[Math.floor(Math.random() * allowed.length)] ?? 'yellow';
};

export const nextZ = (notes: Note[], dateStr: string): number =>
  notes.reduce((max, n) => (n.dateStr === dateStr && isActive(n) ? Math.max(max, n.z ?? 0) : max), 0) + 1;

/** Drawn (clamped) x: keeps a note inside the board width minus a 16 px margin. */
export const clampX = (x: number, boardWidth: number): number =>
  Math.max(0, Math.min(x, Math.max(0, boardWidth - NOTE_SIZE - 16)));

export interface Viewport {
  top: number; // board scrollTop at this moment
  width: number; // visible board width
}

const MIN_WIDTH = 268;

/**
 * First free spot: 220 px cells with 24 px gaps, left to right then top to
 * bottom, starting 24 px inside the visible top left. Falls back to a cascade
 * from the most recently created note on this day (up to 8 steps), then wraps.
 */
export const firstFreeSpot = (dayNotes: Note[], viewport: Viewport): { x: number; y: number } => {
  const width = Math.max(MIN_WIDTH, viewport.width);
  const step = NOTE_SIZE + NOTE_GAP;
  const cols = Math.max(1, Math.floor((width - NOTE_GAP) / step));
  const rows = 3;
  const startY = Math.max(0, viewport.top) + NOTE_GAP;
  const placed = dayNotes.map(n => ({ x: clampX(n.positionX, width), y: n.positionY }));
  const overlaps = (x: number, y: number) =>
    placed.some(p => x < p.x + NOTE_SIZE && x + NOTE_SIZE > p.x && y < p.y + NOTE_SIZE && y + NOTE_SIZE > p.y);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = NOTE_GAP + c * step;
      const y = startY + r * step;
      if (!overlaps(x, y)) return { x, y };
    }
  }

  const newest = [...dayNotes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (!newest) return { x: NOTE_GAP, y: startY };
  const base = { x: NOTE_GAP, y: startY };
  for (let i = 1; i <= 8; i++) {
    const x = clampX(newest.positionX + NOTE_GAP * i, width);
    const y = newest.positionY + NOTE_GAP * i;
    if (!placed.some(p => p.x === x && p.y === y)) return { x, y };
  }
  return base;
};

/** Stable tilt between -2 and 2 degrees, derived from the note id. */
export const tiltFor = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 401) / 100) - 2;
};

export interface TextPart {
  text: string;
  href?: string;
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TRAILING = /[.,;:!?)\]]+$/;

/** Splits text into plain parts and http(s) link parts, minus trailing punctuation. */
export const linkify = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let url = match[0];
    const trail = url.match(TRAILING)?.[0] ?? '';
    url = url.slice(0, url.length - trail.length);
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const hostOf = (value: string): string => {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
};
