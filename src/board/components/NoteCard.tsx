import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Bell, Check, CornerDownRight, Link2, Pencil, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../StickyBoardContext';
import { clampX, hostOf, linkify, nextZ, tiltFor } from '../../shared/notes';
import { formatTime, shortDay } from '../../shared/dates';
import { NOTE_SIZE, type Note } from '../../shared/types';
import { Pin } from '../../shared/ui/Pin';

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

  const lifted = !!(drag?.active || keyPos);
  const [isNew] = useState(() => Date.now() - Date.parse(note.createdAt) < 1500);
  const tool = 'flex h-11 w-11 items-center justify-center rounded-full';
  const toolFace = 'flex h-7 w-7 items-center justify-center rounded-full bg-[var(--paper-tool)] group-hover/tool:bg-[var(--paper-tool-hover)]';

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
      className={`note-card paper-note paper-${note.noteColor} absolute touch-none select-none ${lifted ? 'paper-lifted' : ''} ${drag?.active ? 'cursor-grabbing' : 'cursor-grab'} ${isNew ? 'animate-pin-drop' : ''} ${highlighted ? 'focus-ring' : ''}`}
      style={{
        left: x,
        top: y,
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        zIndex: lifted ? 10000 : note.z,
        transform: lifted ? 'translateY(-4px)' : `rotate(${tiltFor(note.id)}deg)`,
        opacity: note.isCompleted ? 0.6 : 1,
        willChange: drag?.active ? 'transform' : undefined,
        transition: drag?.active ? 'none' : 'transform 160ms ease',
      }}
    >
      <div className="paper">
        <Pin noteId={note.id} />

        <div className="note-tools absolute -top-1.5 -right-1.5 -left-1.5 z-10 flex justify-between text-[var(--paper-ink)]">
          <button
            type="button"
            role="checkbox"
            aria-checked={note.isCompleted}
            aria-label={`Mark ${note.title} ${note.isCompleted ? 'not done' : 'done'}`}
            onClick={toggleComplete}
            className={`group/tool ${tool}`}
          >
            <span className={toolFace}>
              <span className="note-check">{note.isCompleted && <Check size={9} strokeWidth={4} aria-hidden="true" />}</span>
            </span>
          </button>
          <span className="flex">
            <button type="button" aria-label={`Edit ${note.title}`} onClick={() => setEditorId(note.id)} className={`group/tool ${tool}`}>
              <span className={toolFace}>
                <Pencil size={14} aria-hidden="true" />
              </span>
            </button>
            <button type="button" aria-label={`Move ${note.title} to Trash`} onClick={trashAndRefocus} className={`group/tool ${tool}`}>
              <span className={toolFace}>
                <Trash2 size={14} aria-hidden="true" />
              </span>
            </button>
          </span>
        </div>

        <div ref={scrollRef} className="note-scroll absolute inset-x-0 top-10 bottom-0 overflow-y-auto px-[18px] pb-4">
          <h2 className={`note-title ${note.isCompleted ? 'line-through' : ''}`}>{note.title}</h2>

          {note.description && (
            <p className="note-text mt-2 mb-0 whitespace-pre-wrap">
              {linkify(note.description).map((p, i) =>
                p.href ? (
                  <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="underline">
                    {p.text}
                  </a>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </p>
          )}

          {note.subtasks.length > 0 && (
            <ul className="note-text mt-2 flex flex-col gap-1">
              {note.subtasks.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.isCompleted}
                    onClick={() => toggleSubtask(s.id)}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span className="note-check">{s.isCompleted && <Check size={9} strokeWidth={4} aria-hidden="true" />}</span>
                    <span className={s.isCompleted ? 'line-through opacity-60' : ''}>{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(note.dueTime || note.carriedFromId || note.carriedToDate || note.source) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {note.dueTime && (
                <span className="note-chip">
                  <Bell size={11} fill={note.remind ? 'currentColor' : 'none'} aria-hidden="true" />
                  <span>{formatTime(note.dueTime)}</span>
                  {note.remind && <span className="sr-only">, reminder on</span>}
                </span>
              )}
              {note.carriedFromId && (
                <span className="note-chip">
                  <CornerDownRight size={11} aria-hidden="true" />
                  <span>{originDay ? `Carried from ${shortDay(originDay).split(',')[0]}` : 'Carried over'}</span>
                </span>
              )}
              {note.carriedToDate && (
                <span className="note-chip">
                  <span>Carried to {shortDay(note.carriedToDate)}</span>
                </span>
              )}
              {note.source && (
                <a href={note.source.url} target="_blank" rel="noopener noreferrer" className="note-chip" title={note.source.title || note.source.url}>
                  <Link2 size={11} className="flex-none" aria-hidden="true" />
                  <span>{hostOf(note.source.url)}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
