import { useEffect, useState } from 'react';
import { useStickyBoard } from '../StickyBoardContext';
import { isActive, tiltFor } from '../../shared/notes';
import { formatTime, shortDay, weekdayName } from '../../shared/dates';
import { boardNotes } from '../../shared/pageNotes';
import { countOnDay, meta as metaStore, notes as noteStore } from '../../shared/storage';
import { DAY_NOTE_LIMIT, type Note } from '../../shared/types';

interface Offer {
  forDay: string; // the "today" this offer was made for
  lastDay: string;
  candidates: Note[];
}

/**
 * Finds the unfinished notes from the last active day, at most once per day
 * across all tabs (a `carry-over` lock makes tabs take turns).
 */
const findOffer = (today: string): Promise<Offer | null> =>
  navigator.locks.request('carry-over', async () => {
    const m = await metaStore.get();
    if (m.lastCarryOverPromptDate && m.lastCarryOverPromptDate >= today) return null;
    const all = boardNotes(await noteStore.getAll()).filter(isActive);
    const lastDay = all.reduce<string | null>((best, n) => (n.dateStr < today && (!best || n.dateStr > best) ? n.dateStr : best), null);
    if (!lastDay) return null;
    const candidates = all
      .filter(n => n.dateStr === lastDay && !n.isCompleted && !n.carriedToDate)
      .sort((a, b) => a.z - b.z);
    await metaStore.patch({ lastCarryOverPromptDate: today });
    return candidates.length ? { forDay: today, lastDay, candidates } : null;
  });

/** The morning card offering last active day's unfinished notes as copies. */
export function CarryOverPrompt() {
  const { loaded, meta, today, currentDateStr, toast } = useStickyBoard();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded || !meta.onboardedAt || currentDateStr !== today) return;
    let cancelled = false;
    findOffer(today)
      .then(o => {
        if (cancelled || !o) return;
        setOffer(o);
        setSelected(new Set(o.candidates.map(c => c.id)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [loaded, meta.onboardedAt, today, currentDateStr]);

  // An offer made for another day (time zone change, midnight) is stale: never show it.
  if (!offer || offer.forDay !== today || currentDateStr !== today) return null;

  const carry = async (ids: string[]) => {
    setBusy(true);
    try {
      const fresh = await noteStore.getAll();
      // Today holds at most DAY_NOTE_LIMIT notes: carry none rather than some at random.
      const room = DAY_NOTE_LIMIT - countOnDay(fresh, today);
      if (ids.length > room) {
        toast(room > 0 ? `Today has room for ${room} more ${room === 1 ? 'note' : 'notes'}. Untick some and try again.` : 'Today already has 50 notes, so nothing was carried over.', 'error');
        return;
      }
      const byId = new Map(fresh.map(n => [n.id, n]));
      const now = new Date().toISOString();
      const writes: Note[] = [];
      for (const id of ids) {
        const original = byId.get(id);
        if (!original || original.deletedAt || original.carriedToDate) continue;
        const copy: Note = {
          ...original,
          id: crypto.randomUUID(),
          dateStr: today,
          isCompleted: false,
          carriedFromId: original.id,
          createdAt: now,
          updatedAt: now,
        };
        delete copy.remindedAt;
        delete copy.carriedToDate;
        writes.push(copy, { ...original, carriedToDate: today, updatedAt: now });
      }
      await noteStore.putMany(writes);
      setOffer(null);
    } catch {
      toast("Couldn't carry those notes over. Please try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  const day = weekdayName(offer.lastDay);

  return (
    <section
      role="dialog"
      aria-labelledby="carry-title"
      className="absolute top-7 left-1/2 z-[9500] w-[480px] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[20px] border border-line bg-panel p-6 text-ink shadow-pop animate-fade-in"
    >
      <h2 id="carry-title" className="m-0 text-[21px] font-bold">
        Bring {day}'s unfinished notes?
      </h2>
      <p className="mt-1.5 mb-3.5 text-sm text-ink-faint">These weren't ticked off. Copies move to today; the originals stay on {day}.</p>
      <fieldset className="-mx-3 flex flex-col gap-1 border-0 p-0">
        <legend className="sr-only">Notes to carry over from {shortDay(offer.lastDay)}</legend>
        {offer.candidates.map(n => (
          <label
            key={n.id}
            className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-3 py-1.5 hover:bg-hover ${selected.has(n.id) ? 'bg-accent-wash' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.has(n.id)}
              onChange={e => {
                const next = new Set(selected);
                if (e.target.checked) next.add(n.id);
                else next.delete(n.id);
                setSelected(next);
              }}
              className="m-0 h-[18px] w-[18px] accent-[var(--color-accent)]"
            />
            <span
              aria-hidden="true"
              className={`paper-${n.noteColor} paper-swatch h-[30px] w-[30px] flex-none shadow-[-3px_4px_5px_-3px_rgba(0,0,0,0.4)]`}
              style={{ transform: `rotate(${tiltFor(n.id)}deg)` }}
            />
            <span className="min-w-0 flex-1 truncate font-hand text-[23px]">{n.title}</span>
            {n.dueTime && <span className="text-xs text-ink-faint">{formatTime(n.dueTime)}</span>}
          </label>
        ))}
      </fieldset>
      <div className="mt-[18px] flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void carry([...selected])}
          className="h-11 rounded-xl bg-accent px-[18px] text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          Carry selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void carry(offer.candidates.map(c => c.id))}
          className="h-11 rounded-xl bg-raise-strong px-[18px] text-sm font-semibold hover:bg-hover disabled:opacity-50"
        >
          Carry all
        </button>
        <button type="button" onClick={() => setOffer(null)} className="ml-auto h-11 rounded-xl px-2.5 text-sm font-semibold text-ink-faint hover:text-ink">
          Not today
        </button>
      </div>
    </section>
  );
}
