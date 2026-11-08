import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Bell, Check, Clock, CornerDownRight, Link2, Pencil, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { clampX, hostOf, linkify, nextZ, tiltFor } from '../lib/board';
import { shortDay } from '../lib/dates';
import { NOTE_SIZE, type Note } from '../types';

interface NoteCardProps {
  note: Note;
  boardWidth: number;
  originDay?: string; // the day a carried copy came from
}

const DRAG_THRESHOLD = 4;
const KEY_STEP = 24;
const NO_DRAG = 'button, a, input, textarea, select, [data-nodrag]';

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  x: number;
  y: number;
  active: boolean;
}

/** One 220 × 220 sticky note: drag anywhere, scroll inside, keyboard operable. */
export function NoteCard({ note, boardWidth, originDay }: NoteCardProps) {
  const { patchNote, trashNote, setEditorId, highlightId, notes, sound } = useStickyBoard();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [keyPos, setKeyPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlighted = highlightId === note.id;

  const maxX = Math.max(0, boardWidth - NOTE_SIZE - 16);
  const drawnX = clampX(note.positionX, boardWidth);
  const x = drag?.active ? drag.x : keyPos ? keyPos.x : drawnX;
  const y = drag?.active ? drag.y : keyPos ? keyPos.y : note.positionY;

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlighted]);

  // Esc or leaving the window cancels a drag and puts the note back.
  useEffect(() => {
    if (!drag) return;
    const cancel = () => setDrag(null);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', cancel);
    };
  }, [drag]);

  const saveMove = (px: number, py: number) =>
    patchNote(note.id, {
      positionX: Math.round(Math.max(0, Math.min(px, maxX))),
      positionY: Math.round(Math.max(0, py)),
      z: nextZ(notes, note.dateStr),
    });

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(NO_DRAG)) return;
    const sc = scrollRef.current;
    if (sc && sc.contains(target) && e.clientX > sc.getBoundingClientRect().left + sc.clientWidth) return; // scrollbar
    setDrag({ pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: drawnX, origY: note.positionY, x: drawnX, y: note.positionY, active: false });
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.active) e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ ...drag, active: true, x: Math.max(0, Math.min(drag.origX + dx, maxX)), y: Math.max(0, drag.origY + dy) });
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) void saveMove(drag.x, drag.y);
    setDrag(null);
  };

  /** Trashes the note and moves focus to a neighbouring note, so focus is never lost. */
  const trashAndRefocus = () => {
    const el = cardRef.current;
    const neighbour = [el?.nextElementSibling, el?.previousElementSibling].find(n => n?.tagName === 'ARTICLE') as HTMLElement | undefined;
    void trashNote(note.id);
    (neighbour ?? document.querySelector<HTMLElement>('[aria-label="New note"]'))?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.altKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      e.stopPropagation();
      const base = keyPos ?? { x: drawnX, y: note.positionY };
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-KEY_STEP, 0],
        ArrowRight: [KEY_STEP, 0],
        ArrowUp: [0, -KEY_STEP],
        ArrowDown: [0, KEY_STEP],
      };
      const d = moves[e.key];
      if (d) setKeyPos({ x: Math.max(0, Math.min(base.x + d[0], maxX)), y: Math.max(0, base.y + d[1]) });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditorId(note.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      trashAndRefocus();
    }
  };

  const onKeyUp = (e: KeyboardEvent<HTMLElement>) => {
    if (keyPos && (e.key === 'Alt' || e.key.startsWith('Arrow'))) {
      const pos = keyPos;
      void saveMove(pos.x, pos.y).then(() => setKeyPos(null));
    }
  };

  const toggleComplete = () => {
    if (!note.isCompleted) sound('check');
    void patchNote(note.id, { isCompleted: !note.isCompleted });
  };

  const toggleSubtask = (id: string) =>
    void patchNote(note.id, {
      subtasks: note.subtasks.map(s => (s.id === id ? { ...s, isCompleted: !s.isCompleted } : s)),
    });

  const lifted = drag?.active || keyPos;
  const [isNew] = useState(() => Date.now() - Date.parse(note.createdAt) < 1500);

  return (
    <article
      ref={cardRef}
      tabIndex={0}
      aria-label={`Note: ${note.title}${note.isCompleted ? ', done' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={e => {
        if (!(e.target as HTMLElement).closest(NO_DRAG)) setEditorId(note.id);
      }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={`note-card paper-${note.noteColor} absolute touch-none select-none rounded-[4px] ${drag?.active ? 'cursor-grabbing' : 'cursor-grab'} ${isNew ? 'animate-pin-drop' : ''}`}
      style={{
        left: x,
        top: y,
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        zIndex: lifted ? 10000 : note.z,
        transform: `rotate(${lifted ? 0 : tiltFor(note.id)}deg)`,
        boxShadow: lifted ? 'var(--note-shadow-lift)' : 'var(--note-shadow)',
        opacity: note.isCompleted ? 0.6 : 1,
        outline: highlighted ? '4px solid var(--color-accent-soft)' : undefined,
        outlineOffset: highlighted ? 6 : undefined,
        transition: drag?.active ? 'none' : 'box-shadow 160ms ease, transform 160ms ease',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-2 left-1/2 -ml-[7px] h-3.5 w-3.5 rounded-full shadow-[0_3px_4px_rgba(0,0,0,0.35)]"
        style={{ background: 'var(--pin)' }}
      />

      <div className="note-tools absolute inset-x-1.5 top-1.5 z-10 flex justify-between">
        <button
          type="button"
          role="checkbox"
          aria-checked={note.isCompleted}
          aria-label={`Mark ${note.title} ${note.isCompleted ? 'not done' : 'done'}`}
          onClick={toggleComplete}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 hover:bg-black/20"
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border-2 border-current">
            {note.isCompleted && <Check size={10} strokeWidth={4} aria-hidden="true" />}
          </span>
        </button>
        <span className="flex gap-1">
          <button
            type="button"
            aria-label={`Edit ${note.title}`}
            onClick={() => setEditorId(note.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 hover:bg-black/20"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${note.title} to Trash`}
            onClick={trashAndRefocus}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 hover:bg-black/20"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div ref={scrollRef} className="note-scroll absolute inset-x-0 top-9 bottom-0 overflow-y-auto px-4 pb-3.5">
        <h2 className={`font-hand text-[28px] leading-none font-bold break-words ${note.isCompleted ? 'line-through' : ''}`}>
          {note.title}
        </h2>

        {note.description && (
          <p className="mt-1.5 text-[13px] leading-snug break-words whitespace-pre-wrap">
            {linkify(note.description).map((p, i) =>
              p.href ? (
                <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  {p.text}
                </a>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
        )}

        {note.subtasks.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {note.subtasks.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.isCompleted}
                  onClick={() => toggleSubtask(s.id)}
                  className="flex w-full items-start gap-2 text-left text-[13px] leading-snug"
                >
                  <span className="mt-[3px] flex h-3 w-3 flex-none items-center justify-center rounded-[3px] border-[1.5px] border-current">
                    {s.isCompleted && <Check size={9} strokeWidth={4} aria-hidden="true" />}
                  </span>
                  <span className={s.isCompleted ? 'line-through opacity-65' : ''}>{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {(note.dueTime || note.carriedFromId || note.carriedToDate || note.source) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {note.dueTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                {note.dueTime}
                {note.remind && <Bell size={12} fill="currentColor" aria-label="Reminder on" />}
              </span>
            )}
            {note.carriedFromId && (
              <span className="flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5">
                <CornerDownRight size={11} aria-hidden="true" />
                {originDay ? `Carried from ${shortDay(originDay).split(',')[0]}` : 'Carried over'}
              </span>
            )}
            {note.carriedToDate && (
              <span className="rounded-full bg-black/10 px-2 py-0.5">Carried to {shortDay(note.carriedToDate)}</span>
            )}
            {note.source && (
              <a
                href={note.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full min-w-0 items-center gap-1 underline"
              >
                <Link2 size={12} className="flex-none" aria-hidden="true" />
                <span className="truncate">{note.source.title || hostOf(note.source.url)}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
