import { useEffect, useState } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { shortDay, weekdayName } from '../lib/dates';
import { boardNotes } from '../lib/pageNotes';
import { meta as metaStore, notes as noteStore } from '../lib/storage';
import type { Note } from '../types';

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
      className="absolute top-4 left-1/2 z-[9500] w-[480px] -translate-x-1/2 max-w-[calc(100%-32px)] rounded-[20px] border border-line bg-panel p-6 text-ink shadow-2xl animate-fade-in"
    >
      <h2 id="carry-title" className="font-display text-xl font-bold">
        Bring {day}'s unfinished notes?
      </h2>
      <p className="mt-1 text-sm text-ink-faint">Copies go on today. {day} keeps the originals.</p>
      <fieldset className="mt-4 flex flex-col gap-1.5">
        <legend className="sr-only">Notes to carry over from {shortDay(offer.lastDay)}</legend>
        {offer.candidates.map(n => (
          <label key={n.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-raise px-3 hover:bg-raise-strong">
            <input
              type="checkbox"
              checked={selected.has(n.id)}
              onChange={e => {
                const next = new Set(selected);
                if (e.target.checked) next.add(n.id);
                else next.delete(n.id);
                setSelected(next);
              }}
              className="h-[18px] w-[18px] accent-[var(--color-accent)]"
            />
            <span aria-hidden="true" className={`paper-${n.noteColor} h-3 w-3 flex-none rounded-[3px]`} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{n.title}</span>
            {n.dueTime && <span className="text-xs text-ink-faint">{n.dueTime}</span>}
          </label>
        ))}
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void carry([...selected])}
          className="h-11 rounded-[11px] bg-accent px-[18px] text-sm font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50"
        >
          Carry selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void carry(offer.candidates.map(c => c.id))}
          className="h-11 rounded-[11px] border border-line-strong px-4 text-sm hover:bg-raise disabled:opacity-50"
        >
          Carry all
        </button>
        <button type="button" onClick={() => setOffer(null)} className="ml-auto h-11 px-2.5 text-sm text-ink-faint hover:text-ink">
          Not today
        </button>
      </div>
    </section>
  );
}
