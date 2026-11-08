import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { useFocusTrap, useScrollLock } from '../lib/useFocusTrap';
import { isDateStr } from '../lib/dates';
import { DESCRIPTION_MAX, SUBTASKS_MAX, TITLE_MAX, type Note, type Subtask } from '../types';

const field = 'rounded-[10px] border border-line-strong bg-field px-3.5 text-ink outline-none focus:border-accent-soft';

/** Editor for one note: Title, Details, Checklist, Day, Due time with Remind. */
export function NoteEditor({ note }: { note: Note }) {
  const { setEditorId, patchNote, trashNote } = useStickyBoard();
  const ref = useRef<HTMLFormElement>(null);
  useFocusTrap(ref);
  useScrollLock();

  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [subtasks, setSubtasks] = useState<Subtask[]>(note.subtasks);
  const [newItem, setNewItem] = useState('');
  const [dateStr, setDateStr] = useState(note.dateStr);
  const [dueTime, setDueTime] = useState(note.dueTime ?? '');
  const [remind, setRemind] = useState(note.remind && !!note.dueTime);
  const [error, setError] = useState('');

  const close = () => setEditorId(null);

  const addItem = () => {
    const t = newItem.trim();
    if (!t || subtasks.length >= SUBTASKS_MAX) return;
    setSubtasks([...subtasks, { id: crypto.randomUUID(), title: t, isCompleted: false }]);
    setNewItem('');
  };

  const save = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Give the note a title.');
      return;
    }
    if (!isDateStr(dateStr)) {
      setError('Pick a valid day.');
      return;
    }
    const cleanSubtasks = subtasks.map(s => ({ ...s, title: s.title.trim() })).filter(s => s.title);
    const fields: Partial<Note> = {};
    if (cleanTitle !== note.title) fields.title = cleanTitle;
    if (description !== note.description) fields.description = description;
    if (JSON.stringify(cleanSubtasks) !== JSON.stringify(note.subtasks)) fields.subtasks = cleanSubtasks;
    if (dateStr !== note.dateStr) fields.dateStr = dateStr;
    if ((dueTime || undefined) !== note.dueTime) fields.dueTime = dueTime || undefined;
    if (remind !== note.remind) fields.remind = remind;
    if ('dateStr' in fields || 'dueTime' in fields) fields.remindedAt = undefined; // an edited time can remind again
    if (Object.keys(fields).length) await patchNote(note.id, fields);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-16">
      <div aria-hidden="true" className="fixed inset-0 bg-scrim animate-fade-in" onClick={close} />
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onSubmit={e => {
          e.preventDefault();
          void save();
        }}
        className="relative w-full max-w-[520px] overflow-hidden rounded-[20px] border border-line bg-panel text-ink shadow-2xl animate-fade-in"
      >
        <div aria-hidden="true" className={`paper-${note.noteColor} h-2`} />
        <div className="flex flex-col gap-[18px] p-6">
          <div className="flex items-center justify-between">
            <h2 id="editor-title" className="font-display text-lg font-bold">
              Edit note
            </h2>
            <button type="button" onClick={close} aria-label="Close editor" className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-faint hover:bg-raise">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ed-title" className="text-[13px] font-semibold text-ink-soft">
              Title
            </label>
            <input
              id="ed-title"
              data-autofocus
              value={title}
              maxLength={TITLE_MAX}
              onChange={e => {
                setTitle(e.target.value);
                setError('');
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'ed-error' : undefined}
              className={`${field} font-hand h-12 text-[26px] font-bold`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ed-desc" className="text-[13px] font-semibold text-ink-soft">
              Details
            </label>
            <textarea
              id="ed-desc"
              rows={3}
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={e => setDescription(e.target.value)}
              className={`${field} resize-y py-3 text-sm leading-relaxed`}
            />
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-soft">Checklist</legend>
            {subtasks.map((s, i) => (
              <div key={s.id} className="flex min-h-10 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={s.isCompleted}
                  aria-label={`${s.title || 'Item'} done`}
                  onChange={() => setSubtasks(subtasks.map(x => (x.id === s.id ? { ...x, isCompleted: !x.isCompleted } : x)))}
                  className="h-[18px] w-[18px] accent-[var(--color-accent)]"
                />
                <input
                  value={s.title}
                  aria-label={`Checklist item ${i + 1}`}
                  onChange={e => setSubtasks(subtasks.map(x => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                  className={`flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm outline-none focus:bg-raise ${s.isCompleted ? 'text-ink-faint line-through' : ''}`}
                />
                <button
                  type="button"
                  aria-label={`Remove ${s.title || 'item'}`}
                  onClick={() => setSubtasks(subtasks.filter(x => x.id !== s.id))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-raise"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            {subtasks.length < SUBTASKS_MAX && (
              <div className="flex min-h-10 items-center gap-2.5">
                <Plus size={16} className="mx-px text-accent-soft" aria-hidden="true" />
                <label htmlFor="ed-new-item" className="sr-only">
                  Add a checklist item
                </label>
                <input
                  id="ed-new-item"
                  value={newItem}
                  placeholder="Add item"
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  onBlur={addItem}
                  className="flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-accent-soft focus:bg-raise"
                />
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-day" className="text-[13px] font-semibold text-ink-soft">
                Day
              </label>
              <input id="ed-day" type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className={`${field} h-11 text-sm`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ed-time" className="text-[13px] font-semibold text-ink-soft">
                Due time
              </label>
              <input id="ed-time" type="time" value={dueTime} onChange={e => {
                  setDueTime(e.target.value);
                  if (!e.target.value) setRemind(false);
                }} className={`${field} h-11 text-sm`} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-raise px-3.5 py-3">
            <span className="flex flex-col">
              <span id="ed-remind-label" className={`text-sm font-semibold ${dueTime ? '' : 'text-ink-faint'}`}>
                {dueTime ? `Remind me at ${dueTime}` : 'Remind me'}
              </span>
              <span className="text-xs text-ink-faint">{dueTime ? "A Chrome notification when it's due" : 'Set a due time first'}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={remind}
              aria-labelledby="ed-remind-label"
              disabled={!dueTime}
              onClick={() => setRemind(!remind)}
              className={`relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-40 ${remind ? 'bg-accent' : 'bg-raise-strong'}`}
            >
              <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${remind ? 'right-[3px]' : 'left-[3px]'}`} />
            </button>
          </div>

          {error && (
            <p id="ed-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
            <button
              type="button"
              onClick={() => {
                close();
                void trashNote(note.id);
              }}
              className="h-11 px-2.5 text-sm text-danger hover:underline"
            >
              Move to Trash
            </button>
            <button type="button" onClick={close} className="ml-auto h-11 rounded-[10px] border border-line-strong px-4 text-sm hover:bg-raise">
              Cancel
            </button>
            <button type="submit" className="h-11 rounded-[10px] bg-accent px-5 text-sm font-semibold text-accent-ink hover:brightness-110">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
