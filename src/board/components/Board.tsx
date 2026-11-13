import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStickyBoard } from '../StickyBoardContext';
import { firstFreeSpot, isActive, pickColor } from '../../shared/notes';
import { DAY_FULL_MESSAGE, DAY_NOTE_LIMIT, NOTE_SIZE } from '../../shared/types';
import { CarryOverPrompt } from './CarryOverPrompt';
import { DraftNote, type Draft } from './DraftNote';
import { NoteCard } from './NoteCard';
import { Pin } from '../../shared/ui/Pin';
import { Plus } from 'lucide-react';

const TOP_BAR = 64;

/** The full screen freeform board for the day being viewed. */
export function Board({ inert }: { inert: boolean }) {
  const { notes, allNotes, currentDateStr, newNoteSignal, createNote, requestNewNote, toast } = useStickyBoard();
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const draftKey = useRef(0);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dayNotes = useMemo(
    () => notes.filter(n => n.dateStr === currentDateStr && isActive(n)).sort((a, b) => a.z - b.z),
    [notes, currentDateStr],
  );
  const originDays = useMemo(() => new Map(notes.map(n => [n.id, n.dateStr])), [notes]);

  const draftRef = useRef(draft);
  useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  /** Saves the draft to its own day when it has a title; otherwise drops it. Returns whether it saved a note. */
  const commitDraft = useCallback(async (): Promise<boolean> => {
    const d = draftRef.current;
    if (!d || d.saving) return false;
    const title = d.title.trim();
    if (!title) {
      setDraft(null);
      return false;
    }
    setDraft({ ...d, saving: true });
    const note = await createNote({
      title,
      description: d.description.trim(),
      dateStr: d.dateStr,
      position: { x: d.x, y: d.y },
      preferredColor: d.color,
    });
    setDraft(cur => (cur && cur.key === d.key ? (note ? null : { ...cur, saving: false }) : cur));
    return !!note;
  }, [createNote]);

  /** `justSaved`: a note saved a moment ago that `dayNotes` doesn't show yet. */
  const startDraft = useCallback((justSaved = false) => {
    // A full day takes no new note: say so instead of opening a blank one.
    if (dayNotes.length + (justSaved ? 1 : 0) >= DAY_NOTE_LIMIT) {
      toast(DAY_FULL_MESSAGE, 'error');
      return;
    }
    const top = Math.max(0, window.scrollY - TOP_BAR);
    const pos = firstFreeSpot(dayNotes, { top, width });
    draftKey.current += 1;
    setDraft({ key: draftKey.current, x: pos.x, y: pos.y, dateStr: currentDateStr, color: pickColor(allNotes), title: '', description: '', saving: false });
    setFocusSignal(s => s + 1);
    const bottom = TOP_BAR + pos.y + NOTE_SIZE;
    if (pos.y + TOP_BAR < window.scrollY || bottom > window.scrollY + window.innerHeight) {
      window.scrollTo({ top: Math.max(0, pos.y + TOP_BAR - 80), behavior: 'smooth' });
    }
  }, [dayNotes, width, currentDateStr, allNotes, toast]);

  // "+" or N: refocus an empty draft, save a titled one first, then start a new one.
  const lastSignal = useRef(newNoteSignal);
  useEffect(() => {
    if (newNoteSignal === lastSignal.current) return;
    lastSignal.current = newNoteSignal;
    const d = draftRef.current;
    if (d && !d.title.trim()) {
      setFocusSignal(s => s + 1);
      return;
    }
    if (d) void commitDraft().then(saved => startDraft(saved));
    else startDraft();
  }, [newNoteSignal, commitDraft, startDraft]);

  // Switching day saves a titled draft to its own day.
  useEffect(() => {
    void commitDraft();
  }, [currentDateStr, commitDraft]);

  const lowest = dayNotes.reduce((max, n) => Math.max(max, n.positionY + NOTE_SIZE), draft ? draft.y + NOTE_SIZE : 0);
  const height = Math.max(window.innerHeight - TOP_BAR, lowest + 240);

  return (
    <main aria-label="Board" inert={inert}>
      {/* isolate: note z values stack only among themselves, never above the top bar, drawers or editor. */}
      <div ref={boardRef} className="relative isolate" style={{ height }}>
        <CarryOverPrompt />
        {dayNotes.map(n => (
          <NoteCard key={n.id} note={n} boardWidth={width} originDay={n.carriedFromId ? originDays.get(n.carriedFromId) : undefined} />
        ))}
        {draft && (
          <DraftNote
            key={draft.key}
            draft={draft}
            focusSignal={focusSignal}
            onChange={fields => setDraft(d => (d ? { ...d, ...fields } : d))}
            onCommit={() => void commitDraft()}
            onDiscard={() => setDraft(null)}
          />
        )}
        {!dayNotes.length && !draft && <EmptyDay onNew={requestNewNote} />}
      </div>
    </main>
  );
}

const kbd = 'rounded-md bg-kbd px-[7px] py-0.5 font-sans font-semibold text-ink';

/** The empty day: three loose pins, the hint and a button. */
function EmptyDay({ onNew }: { onNew: () => void }) {
  return (
    <div className="absolute top-[min(30vh,260px)] left-1/2 flex w-[min(440px,calc(100%-32px))] -translate-x-1/2 flex-col items-center gap-[18px] text-center">
      <div aria-hidden="true" className="relative h-[120px] w-[160px]">
        <Pin color="red" style={{ left: 52, top: 50, transform: 'scale(1.6)' }} />
        <Pin color="yellow" style={{ left: 100, top: 36, transform: 'scale(1.3) rotate(10deg)' }} />
        <Pin color="blue" style={{ left: 116, top: 84, transform: 'scale(1.2) rotate(-8deg)' }} />
      </div>
      <div className="board-backing flex flex-col items-center gap-3 px-4 py-2">
        <p className="m-0 font-hand text-[44px] leading-none text-ink">Nothing pinned yet.</p>
        <p className="m-0 text-[15px] text-ink-faint">
          Press <kbd className={kbd}>N</kbd> or <kbd className={kbd}>+</kbd> to add a note.
        </p>
      </div>
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={onNew}
        className="mt-1.5 flex h-11 items-center gap-2 rounded-xl bg-accent px-[18px] text-sm font-semibold text-accent-ink hover:opacity-90"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        Pin your first note
      </button>
    </div>
  );
}
