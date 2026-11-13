import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CalendarArrowDown, GripVertical, Minus, Plus, Trash2, X } from 'lucide-react';
import { Pin } from '../components/Pin';
import { tiltFor } from '../lib/board';
import { clampHeight, clampWidth, collapsedLabel, noteHeight, noteWidth, type PagePatch } from '../lib/pageNotes';
import { DESCRIPTION_MAX, SUBTASKS_MAX, TITLE_MAX, type Note, type Subtask } from '../types';
import { newId } from './ids';

const SAVE_DELAY = 500;
const DRAG_THRESHOLD = 3;

type Field = 'title' | 'description' | 'subtasks';

interface PageNoteProps {
  note: Note;
  x: number; // drawn spot (clamped to the page)
  y: number;
  allowed: boolean;
  onPatch: (fields: PagePatch) => void;
  onTrash: () => void;
  onAllow: () => void;
  /** Move to today's board. */
  onMove: () => void;
  /** True while the move waits for the background: the buttons are disabled. */
  moving: boolean;
  moveError?: string;
}

interface Gesture {
  kind: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  origA: number;
  origB: number;
  active: boolean;
}

/** One sticky note on a web page. Every change goes to the background through `onPatch`. */
export function PageNote({ note, x, y, allowed, onPatch, onTrash, onAllow, onMove, moving, moveError }: PageNoteProps) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [subtasks, setSubtasks] = useState<Subtask[]>(note.subtasks);
  const [newItem, setNewItem] = useState('');
  const [gesture, setGesture] = useState<Gesture | null>(null);
  // The on screen copy during and right after a drag or resize. It is tied to
  // the stored spot and size it started from, so once the saved note catches
  // up (or changes elsewhere) it is ignored.
  const basis = `${note.positionX},${note.positionY},${note.width},${note.height}`;
  const [liveRaw, setLive] = useState<{ x: number; y: number; w: number; h: number; basis: string } | null>(null);
  const live = liveRaw && liveRaw.basis === basis ? liveRaw : null;
  const focused = useRef<Field | null>(null);
  const pending = useRef<PagePatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Live updates from other tabs and the board: take them, except in the field you're typing in.
  useEffect(() => {
    if (focused.current !== 'title' && !('title' in pending.current)) setTitle(note.title);
    if (focused.current !== 'description' && !('description' in pending.current)) setDescription(note.description);
    if (focused.current !== 'subtasks' && !('subtasks' in pending.current)) setSubtasks(note.subtasks);
  }, [note.title, note.description, note.subtasks]);

  // Details grow with their text, so the note body scrolls as one piece.
  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [description, note.collapsed]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const fields = pending.current;
    pending.current = {};
    if (Object.keys(fields).length) onPatch(fields);
  };
  const flushRef = useRef(flush);
  useLayoutEffect(() => {
    flushRef.current = flush;
  });
  // Unsaved text is sent when the note goes away (address change, delete elsewhere).
  useEffect(() => () => flushRef.current(), []);
  // A reload or closed tab never unmounts, so send unsaved text as the page goes away.
  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  const queue = (fields: PagePatch) => {
    pending.current = { ...pending.current, ...fields };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  const changeTitle = (v: string) => {
    setTitle(v);
    if (v.trim()) queue({ title: v });
    else {
      const { title: _t, ...rest } = pending.current;
      pending.current = rest;
    }
  };
  const changeSubtasks = (next: Subtask[]) => {
    setSubtasks(next);
    queue({ subtasks: next });
  };

  const focusOn = (f: Field) => {
    focused.current = f;
  };
  const onBlur = () => {
    focused.current = null;
    flush();
    if (!title.trim()) setTitle(note.title); // a title can't be empty; put the saved one back
  };

  const w = live?.w ?? noteWidth(note);
  const h = live?.h ?? noteHeight(note);
  const left = live?.x ?? x;
  const top = live?.y ?? y;

  const start = (kind: Gesture['kind']) => (e: RPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (kind === 'move' && (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setGesture({
      kind,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origA: kind === 'move' ? left : w,
      origB: kind === 'move' ? top : h,
      active: false,
    });
  };

  const move = (e: RPointerEvent<HTMLElement>) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    if (!gesture.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!gesture.active) setGesture({ ...gesture, active: true });
    if (gesture.kind === 'move') setLive({ x: Math.max(0, gesture.origA + dx), y: Math.max(0, gesture.origB + dy), w, h, basis });
    else setLive({ x: left, y: top, w: clampWidth(gesture.origA + dx), h: clampHeight(gesture.origB + dy), basis });
  };

  const end = (e: RPointerEvent<HTMLElement>) => {
    if (!gesture || e.pointerId !== gesture.pointerId) return;
    if (gesture.active && live) {
      if (gesture.kind === 'move') onPatch({ positionX: Math.round(live.x), positionY: Math.round(live.y) });
      else onPatch({ width: live.w, height: live.h });
    } else {
      setLive(null);
    }
    setGesture(null);
  };

  const cancel = () => {
    setGesture(null);
    setLive(null);
  };

  const tilt = tiltFor(note.id);

  if (note.collapsed) {
    return (
      <button
        type="button"
        className={`sb-tab paper-note paper-${note.noteColor}`}
        style={{ left, top, zIndex: note.z, transform: `rotate(${tilt}deg)` }}
        aria-label={`Open note: ${note.title}`}
        title={note.title}
        onClick={() => onPatch({ collapsed: false })}
      >
        <span className="paper" aria-hidden="true">
          <Pin noteId={note.id} style={{ left: 19, top: 17, transform: 'scale(0.8)' }} />
        </span>
        <span className="sb-tab-label">{collapsedLabel(note.title)}</span>
      </button>
    );
  }

  const lifted = gesture?.active;

  return (
    <section
      className={`sb-note paper-note paper-${note.noteColor} ${lifted ? 'sb-lifted' : ''}`}
      aria-label={`Sticky note: ${note.title}`}
      style={{
        left,
        top,
        width: w,
        height: h,
        zIndex: lifted ? 100000 : note.z,
        transform: lifted ? 'translateY(-4px)' : `rotate(${tilt}deg)`,
      }}
    >
      <div className="paper">
        <Pin noteId={note.id} />
        <div
          className="sb-bar"
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={cancel}
          title="Drag to move"
        >
          <span className="sb-grip" aria-hidden="true">
            <GripVertical size={14} />
          </span>
          <button
            type="button"
            className="sb-icon"
            aria-label={`Move ${note.title} to today's board`}
            title="Move to today's board"
            disabled={moving}
            onClick={() => {
              flush(); // text typed in the last half second goes first
              onMove();
            }}
          >
            <CalendarArrowDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className="sb-icon" aria-label={`Collapse ${note.title}`} title="Collapse" disabled={moving} onClick={() => onPatch({ collapsed: true })}>
            <Minus size={14} aria-hidden="true" />
          </button>
          <button type="button" className="sb-icon" aria-label={`Move ${note.title} to Trash`} title="Move to Trash" disabled={moving} onClick={onTrash}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="sb-body">
          <label className="sb-sr" htmlFor={`sb-title-${note.id}`}>
            Title
          </label>
          <input
            id={`sb-title-${note.id}`}
            className="sb-field sb-title"
            value={title}
            maxLength={TITLE_MAX}
            onChange={e => changeTitle(e.target.value)}
            onFocus={() => focusOn('title')}
            onBlur={onBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                descRef.current?.focus();
              }
            }}
          />
          <label className="sb-sr" htmlFor={`sb-details-${note.id}`}>
            Details
          </label>
          <textarea
            id={`sb-details-${note.id}`}
            ref={descRef}
            rows={1}
            className="sb-field sb-details"
            placeholder="Details…"
            value={description}
            maxLength={DESCRIPTION_MAX}
            onChange={e => {
              setDescription(e.target.value);
              queue({ description: e.target.value });
            }}
            onFocus={() => focusOn('description')}
            onBlur={onBlur}
          />

          <ul className="sb-list" aria-label="Checklist">
            {subtasks.map(s => (
              <li key={s.id} className={`sb-item ${s.isCompleted ? 'sb-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={s.isCompleted}
                  aria-label={`Done: ${s.title || 'item'}`}
                  onChange={() => changeSubtasks(subtasks.map(x => (x.id === s.id ? { ...x, isCompleted: !x.isCompleted } : x)))}
                  onFocus={() => focusOn('subtasks')}
                  onBlur={onBlur}
                />
                <input
                  className="sb-field"
                  value={s.title}
                  maxLength={TITLE_MAX}
                  aria-label="Checklist item"
                  onChange={e => changeSubtasks(subtasks.map(x => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                  onFocus={() => focusOn('subtasks')}
                  onBlur={onBlur}
                />
                <button
                  type="button"
                  className="sb-icon"
                  aria-label={`Remove ${s.title || 'item'}`}
                  onClick={() => changeSubtasks(subtasks.filter(x => x.id !== s.id))}
                  onFocus={() => focusOn('subtasks')}
                  onBlur={onBlur}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
            {subtasks.length < SUBTASKS_MAX && (
              <li className="sb-item">
                <Plus size={14} aria-hidden="true" style={{ flex: 'none', opacity: 0.7 }} />
                <input
                  className="sb-field"
                  value={newItem}
                  placeholder="Add an item"
                  aria-label="Add a checklist item"
                  maxLength={TITLE_MAX}
                  onChange={e => setNewItem(e.target.value)}
                  onFocus={() => focusOn('subtasks')}
                  onBlur={onBlur}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newItem.trim()) {
                      e.preventDefault();
                      changeSubtasks([...subtasks, { id: newId(), title: newItem.trim(), isCompleted: false }]);
                      setNewItem('');
                    }
                  }}
                />
              </li>
            )}
          </ul>
        </div>

        {moveError && (
          <p className="sb-strip sb-error" role="alert">
            <span>{moveError}</span>
          </p>
        )}

        {!allowed && (
          <div className="sb-strip" role="note">
            <span>Show this note when you come back?</span>
            <button type="button" className="sb-btn" onClick={onAllow}>
              Allow
            </button>
          </div>
        )}

        <span
          className="sb-resize"
          role="presentation"
          title="Drag to resize"
          onPointerDown={start('resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={cancel}
        />
      </div>
    </section>
  );
}
