import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { firstFreeSpot, isActive, pickColor } from '../lib/board';
import { NOTE_SIZE } from '../types';
import { CarryOverPrompt } from './CarryOverPrompt';
import { DraftNote, type Draft } from './DraftNote';
import { NoteCard } from './NoteCard';

const TOP_BAR = 64;

/** The full screen freeform board for the day being viewed. */
export function Board({ inert }: { inert: boolean }) {
  const { notes, currentDateStr, newNoteSignal, createNote } = useStickyBoard();
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

  /** Saves the draft to its own day when it has a title; otherwise drops it. */
  const commitDraft = useCallback(async () => {
    const d = draftRef.current;
    if (!d || d.saving) return;
    const title = d.title.trim();
    if (!title) {
      setDraft(null);
      return;
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
  }, [createNote]);

  const startDraft = useCallback(() => {
    const top = Math.max(0, window.scrollY - TOP_BAR);
    const pos = firstFreeSpot(dayNotes, { top, width });
    draftKey.current += 1;
    setDraft({ key: draftKey.current, x: pos.x, y: pos.y, dateStr: currentDateStr, color: pickColor(notes), title: '', description: '', saving: false });
    setFocusSignal(s => s + 1);
    const bottom = TOP_BAR + pos.y + NOTE_SIZE;
    if (pos.y + TOP_BAR < window.scrollY || bottom > window.scrollY + window.innerHeight) {
      window.scrollTo({ top: Math.max(0, pos.y + TOP_BAR - 80), behavior: 'smooth' });
    }
  }, [dayNotes, width, currentDateStr, notes]);

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
    if (d) void commitDraft().then(startDraft);
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
      <div ref={boardRef} className="relative" style={{ height }}>
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
        {!dayNotes.length && !draft && (
          <p className="on-board pointer-events-none absolute inset-x-0 top-[30%] px-6 text-center font-hand text-3xl text-ink-faint">
            Nothing pinned yet. Press N or + to add a note.
          </p>
        )}
      </div>
    </main>
  );
}
