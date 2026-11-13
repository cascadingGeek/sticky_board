import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Plus, Trash2, X } from 'lucide-react';
import { useStickyBoard } from '../StickyBoardContext';
import { useFocusTrap, useScrollLock } from '../hooks/useFocusTrap';
import { formatTime, isDateStr } from '../../shared/dates';
import { isActive } from '../../shared/notes';
import { DAY_NOTE_LIMIT, DESCRIPTION_MAX, SUBTASKS_MAX, TITLE_MAX, type Note, type Subtask } from '../../shared/types';
import { Pin } from '../../shared/ui/Pin';

/** Saves 500 ms after you stop typing. */
const EDITOR_SAVE_DELAY = 500;
const SAVE_ERROR = "Couldn't save the note. Your text is still here, try again.";

interface Values {
  title: string;
  description: string;
  subtasks: Subtask[];
  dateStr: string;
  dueTime: string; // '' when there is none
  remind: boolean;
}

const valuesOf = (n: Note): Values => ({
  title: n.title,
  description: n.description,
  subtasks: n.subtasks,
  dateStr: n.dateStr,
  dueTime: n.dueTime ?? '',
  remind: n.remind && !!n.dueTime,
});

/**
 * The checklist to save. A closing save drops emptied items; a timed save keeps
 * an emptied item's last text (you may be retyping it) and skips new empty ones.
 */
const checklistToSave = (items: Subtask[], saved: Subtask[], closing: boolean): Subtask[] => {
  const savedById = new Map(saved.map(s => [s.id, s]));
  const out: Subtask[] = [];
  for (const s of items) {
    const title = s.title.trim();
    if (title) out.push({ ...s, title });
    else if (!closing && savedById.has(s.id)) out.push(savedById.get(s.id)!);
  }
  return out;
};

/** Only the fields that differ from what the editor last saved; never an empty title, an invalid day or a full day. */
const changedFields = (v: Values, saved: Values, closing: boolean, dayFull: (d: string) => boolean): Partial<Note> => {
  const fields: Partial<Note> = {};
  const title = v.title.trim();
  if (title && title !== saved.title) fields.title = title;
  if (v.description !== saved.description) fields.description = v.description;
  const list = checklistToSave(v.subtasks, saved.subtasks, closing);
  if (JSON.stringify(list) !== JSON.stringify(saved.subtasks)) fields.subtasks = list;
  if (isDateStr(v.dateStr) && v.dateStr !== saved.dateStr && !dayFull(v.dateStr)) fields.dateStr = v.dateStr;
  if (v.dueTime !== saved.dueTime) fields.dueTime = v.dueTime || undefined;
  if (v.remind !== saved.remind) fields.remind = v.remind;
  if ('dateStr' in fields || 'dueTime' in fields) fields.remindedAt = undefined; // a new time can remind again
  return fields;
};

const label = 'text-xs font-semibold text-[var(--paper-ink)]';
const lineField = 'w-full border-0 border-b-[1.5px] border-solid border-[var(--paper-line)] bg-transparent p-0 text-[var(--paper-ink)] outline-none placeholder:text-[var(--paper-ink)] placeholder:opacity-45 focus-visible:border-[var(--paper-ink)] focus-visible:outline-none';
const box = 'h-10 w-full rounded-[10px] border border-solid border-[var(--paper-box-line)] bg-[var(--paper-box)] px-3 text-sm text-[var(--paper-ink)] outline-none focus-visible:border-[var(--paper-ink)]';
const errorText = 'm-0 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--paper-danger)]';

/**
 * The note editor, saving as you type. Done, Close, Esc and the scrim send any
 * waiting change and close; there is no Cancel.
 */
export function NoteEditor({ note }: { note: Note }) {
  const { notes, setEditorId, patchNote, trashNote } = useStickyBoard();
  // Moving the note to another day needs room there (DAY_NOTE_LIMIT).
  const isFull = (list: Note[], d: string) => d !== note.dateStr && list.filter(n => n.dateStr === d && isActive(n) && n.id !== note.id).length >= DAY_NOTE_LIMIT;
  const notesRef = useRef(notes);
  useLayoutEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const dayFull = (d: string) => isFull(notesRef.current, d);
  const ref = useRef<HTMLElement>(null);
  useFocusTrap(ref);
  useScrollLock();

  const [values, setValuesState] = useState<Values>(() => valuesOf(note));
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(0); // writes waiting or running
  const [failed, setFailed] = useState(false);
  const [closeArmed, setCloseArmed] = useState(false); // after a failed save, the next close leaves anyway
  const [dayTouched, setDayTouched] = useState(false);
  const [closeTried, setCloseTried] = useState(false);

  // Refs so saves read the latest values even from event handlers that run before a re-render.
  const live = useRef(values);
  const saved = useRef<Values>(valuesOf(note));
  const newItemRef = useRef('');
  const failedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const gone = useRef(false);

  const setValues = useCallback((fields: Partial<Values>) => {
    live.current = { ...live.current, ...fields };
    setValuesState(live.current);
  }, []);
  const setFailedBoth = (v: boolean) => {
    failedRef.current = v;
    setFailed(v);
  };

  /** One save. Runs only after the previous one finished (see `enqueue`). */
  const saveNow = async (closing: boolean, silent: boolean): Promise<boolean> => {
    if (gone.current) return true;
    const fields = changedFields(live.current, saved.current, closing, dayFull);
    if (!Object.keys(fields).length) return true;
    const sent = { ...saved.current };
    if ('title' in fields) sent.title = fields.title!;
    if ('description' in fields) sent.description = fields.description!;
    if ('subtasks' in fields) sent.subtasks = fields.subtasks!;
    if ('dateStr' in fields) sent.dateStr = fields.dateStr!;
    if ('dueTime' in fields) sent.dueTime = fields.dueTime ?? '';
    if ('remind' in fields) sent.remind = fields.remind!;
    const message = silent || failedRef.current ? null : SAVE_ERROR; // one error toast, not one per retry
    const ok = await patchNote(note.id, fields, message);
    if (gone.current) return ok;
    if (ok) {
      saved.current = sent;
      setFailedBoth(false);
    } else {
      setFailedBoth(true);
    }
    return ok;
  };

  /** One save at a time: a new save waits for the running one. */
  const enqueue = (closing: boolean, silent = false): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      setBusy(b => b - 1);
    }
    setBusy(b => b + 1);
    const run = chain.current.then(() => saveNow(closing, silent));
    chain.current = run.catch(() => false);
    return run.finally(() => {
      if (!gone.current) setBusy(b => b - 1);
    });
  };

  // Keep the latest enqueue for timers and page listeners.
  const enqueueRef = useRef(enqueue);
  useLayoutEffect(() => {
    enqueueRef.current = enqueue;
  });

  /** Any edit: restart the 500 ms wait. */
  const edit = (fields: Partial<Values>) => {
    setValues(fields);
    setCloseArmed(false);
    if (timer.current) clearTimeout(timer.current);
    else setBusy(b => b + 1);
    timer.current = setTimeout(() => {
      timer.current = null;
      setBusy(b => b - 1);
      void enqueueRef.current(false);
    }, EDITOR_SAVE_DELAY);
  };

  /** Turns the "Add item" text into an item. Returns whether it added one. */
  const addItem = (): boolean => {
    const t = newItemRef.current.trim();
    if (!t || live.current.subtasks.length >= SUBTASKS_MAX) return false;
    newItemRef.current = '';
    setNewItem('');
    edit({ subtasks: [...live.current.subtasks, { id: crypto.randomUUID(), title: t, isCompleted: false }] });
    return true;
  };

  const close = () => setEditorId(null);

  /** Done, the close button, Esc or the scrim. */
  const requestClose = async (via: 'done' | 'dismiss') => {
    addItem();
    if (via === 'dismiss' && closeArmed) {
      close(); // a second close after a failed save leaves without saving
      return;
    }
    setCloseTried(true);
    const ok = await enqueue(true);
    if (ok) close();
    else if (via === 'dismiss') setCloseArmed(true);
  };

  const moveToTrash = async () => {
    addItem();
    await enqueue(true, true); // the note leaves anyway: no save error toast
    close();
    void trashNote(note.id);
  };

  const addItemRef = useRef(addItem);
  useLayoutEffect(() => {
    addItemRef.current = addItem;
  });

  // Leaving the tab: send waiting changes (best effort while the page tears down).
  useEffect(() => {
    const onHide = () => {
      addItemRef.current();
      void enqueueRef.current(true, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void enqueueRef.current(false);
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  // Closed from outside (the note was removed elsewhere): send nothing more.
  useEffect(
    () => () => {
      gone.current = true;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const titleEmpty = !values.title.trim();
  const dayInvalid = !isDateStr(values.dateStr);
  const dayIsFull = !dayInvalid && isFull(notes, values.dateStr);
  const showDayError = (dayInvalid && (dayTouched || closeTried)) || dayIsFull;
  const status = busy > 0 ? 'Saving…' : failed || titleEmpty || dayInvalid || dayIsFull ? 'Not saved' : 'Saved';
  const notSaved = status === 'Not saved';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="fixed inset-0 bg-scrim-strong animate-fade-in" onClick={() => void requestClose('dismiss')} />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Edit note"
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            void requestClose('dismiss');
          }
        }}
        className={`paper paper-static paper-editor paper-${note.noteColor} flex max-h-[calc(100vh-32px)] w-full max-w-[580px] flex-col animate-fade-in`}
      >
        <Pin noteId={note.id} large />
        <button
          type="button"
          onClick={() => void requestClose('dismiss')}
          aria-label="Close editor"
          className="absolute top-1.5 right-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-[10px] text-[var(--paper-ink)] hover:bg-[var(--paper-tool)]"
        >
          <X size={19} aria-hidden="true" />
        </button>

        <div className="note-scroll flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pt-16 pb-7 sm:px-10">
          <div className="flex flex-col gap-1">
            <label htmlFor="ed-title" className={label}>
              Title
            </label>
            <input
              id="ed-title"
              data-autofocus
              value={values.title}
              maxLength={TITLE_MAX}
              placeholder="Write a title…"
              onChange={e => edit({ title: e.target.value })}
              aria-invalid={titleEmpty}
              aria-describedby={titleEmpty ? 'ed-title-error' : undefined}
              className={`${lineField} font-hand editor-title ${titleEmpty ? 'border-b-2 border-[var(--paper-danger)]' : ''}`}
            />
            {titleEmpty && (
              <p id="ed-title-error" className={`${errorText} mt-1`}>
                <AlertCircle size={15} aria-hidden="true" />
                Give the note a title.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ed-desc" className={label}>
              Details
            </label>
            <textarea
              id="ed-desc"
              rows={3}
              value={values.description}
              maxLength={DESCRIPTION_MAX}
              onChange={e => edit({ description: e.target.value })}
              className={`${lineField} font-hand editor-text min-h-24 resize-none`}
            />
          </div>

          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className={`${label} mb-1.5`}>Checklist</legend>
            {values.subtasks.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={s.isCompleted}
                  aria-label={`${s.title || 'Item'} done`}
                  onClick={() => edit({ subtasks: live.current.subtasks.map(x => (x.id === s.id ? { ...x, isCompleted: !x.isCompleted } : x)) })}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-[var(--paper-ink)]"
                >
                  <span className="note-check h-3.5 w-3.5">{s.isCompleted && <Check size={10} strokeWidth={4} aria-hidden="true" />}</span>
                </button>
                <input
                  value={s.title}
                  maxLength={TITLE_MAX}
                  aria-label={`Checklist item ${i + 1}`}
                  onChange={e => edit({ subtasks: live.current.subtasks.map(x => (x.id === s.id ? { ...x, title: e.target.value } : x)) })}
                  className={`font-hand editor-item min-w-0 flex-1 border-0 bg-transparent p-0 text-[var(--paper-ink)] outline-none focus-visible:underline ${s.isCompleted ? 'line-through opacity-60' : ''}`}
                />
                <button
                  type="button"
                  aria-label={`Remove ${s.title || 'item'}`}
                  onClick={() => edit({ subtasks: live.current.subtasks.filter(x => x.id !== s.id) })}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--paper-ink)] opacity-60 hover:bg-[var(--paper-tool)] hover:opacity-100"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            {values.subtasks.length < SUBTASKS_MAX && (
              <div className="flex items-center gap-2.5 text-[var(--paper-ink)]">
                <span className="flex h-8 w-8 flex-none items-center justify-center opacity-70" aria-hidden="true">
                  <Plus size={14} />
                </span>
                <label htmlFor="ed-new-item" className="sr-only">
                  Add a checklist item
                </label>
                <input
                  id="ed-new-item"
                  value={newItem}
                  maxLength={TITLE_MAX}
                  placeholder="Add item"
                  onChange={e => {
                    newItemRef.current = e.target.value;
                    setNewItem(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  onBlur={() => addItem()}
                  className="font-hand editor-item min-w-0 flex-1 border-0 bg-transparent p-0 text-[var(--paper-ink)] outline-none placeholder:text-[var(--paper-ink)] placeholder:opacity-60 focus-visible:underline"
                />
              </div>
            )}
          </fieldset>

          <div className="mt-auto grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-day" className={label}>
                Day
              </label>
              <input
                id="ed-day"
                type="date"
                value={values.dateStr}
                onChange={e => edit({ dateStr: e.target.value })}
                onBlur={() => setDayTouched(true)}
                aria-invalid={showDayError}
                aria-describedby={showDayError ? 'ed-day-error' : undefined}
                className={`${box} ${showDayError ? 'border-2 border-[var(--paper-danger)]' : ''}`}
              />
              {showDayError && (
                <p id="ed-day-error" className={errorText}>
                  {dayIsFull ? 'That day already has 50 notes. Pick another day.' : 'Pick a valid day.'}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-time" className={label}>
                Due time
              </label>
              <input
                id="ed-time"
                type="time"
                value={values.dueTime}
                onChange={e => edit(e.target.value ? { dueTime: e.target.value } : { dueTime: '', remind: false })}
                className={box}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-[var(--paper-ink)]">
            <span className="flex flex-col">
              <span id="ed-remind-label" className={`text-sm font-semibold ${values.dueTime ? '' : 'opacity-75'}`}>
                {values.dueTime ? `Remind me at ${formatTime(values.dueTime)}` : 'Remind me'}
              </span>
              <span className="text-xs">{values.dueTime ? "A Chrome notification when it's due" : 'Set a due time first'}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={values.remind}
              aria-labelledby="ed-remind-label"
              disabled={!values.dueTime}
              onClick={() => edit({ remind: !live.current.remind })}
              className={`relative h-[26px] w-11 flex-none rounded-full transition-colors disabled:cursor-not-allowed ${
                values.remind ? 'bg-[var(--paper-btn)]' : 'bg-[var(--paper-switch-off)]'
              }`}
            >
              <span
                className={`absolute top-[3px] h-5 w-5 rounded-full bg-[var(--paper-btn-ink)] transition-all ${values.remind ? 'right-[3px]' : 'left-[3px]'} ${
                  values.dueTime ? '' : 'opacity-80'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[var(--paper-rule)] pt-3.5">
            <button
              type="button"
              onClick={() => void moveToTrash()}
              className="flex h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[var(--paper-danger)] hover:bg-[var(--paper-tool)]"
            >
              <Trash2 size={16} aria-hidden="true" />
              Move to Trash
            </button>
            <span className="flex items-center gap-3">
              <span role="status" className={`text-xs ${notSaved ? 'font-semibold text-[var(--paper-danger)]' : 'text-[var(--paper-ink)]'}`}>
                {status}
              </span>
              <button
                type="button"
                onClick={() => void requestClose('done')}
                className="h-11 rounded-xl bg-[var(--paper-btn)] px-[18px] text-sm font-semibold text-[var(--paper-btn-ink)] hover:opacity-90"
              >
                {failed ? 'Try again' : 'Done'}
              </button>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
