import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { parseDateStr, toDateStr } from '../lib/dates';
import type { Note } from '../types';
import { Drawer } from './Drawer';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const plural = (n: number) => `${n} ${n === 1 ? 'note' : 'notes'}`;

/**
 * Month grid. Each day shows up to 3 small paper squares in the colours of
 * that day's board notes (not in Trash, first 3 by createdAt). Today is filled
 * with the primary colour, past days are muted. A day click opens that board.
 */
export function CalendarDrawer() {
  const { notes, currentDateStr, setCurrentDateStr, today, settings, openDrawer } = useStickyBoard();
  const [month, setMonth] = useState(() => {
    const d = parseDateStr(currentDateStr);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      if (!isActive(n)) continue;
      const list = map.get(n.dateStr) ?? [];
      list.push(n);
      map.set(n.dateStr, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    return map;
  }, [notes]);

  const start = settings.startOfWeek;
  const lead = (month.getDay() - start + 7) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateStr(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  const viewed = byDay.get(currentDateStr) ?? [];
  const viewedDone = viewed.filter(n => n.isCompleted).length;
  const viewedLabel = parseDateStr(currentDateStr).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const navBtn = 'flex h-11 w-11 items-center justify-center rounded-[10px] text-ink hover:bg-hover';

  return (
    <Drawer
      title="Calendar"
      onClose={() => openDrawer(null)}
      footer={
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-raise px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">{viewedLabel}</span>
            <span className="text-xs text-ink-faint">
              {viewed.length ? `${plural(viewed.length)} · ${viewedDone} done` : 'No notes'}
            </span>
          </span>
          {currentDateStr === today && (
            <span className="flex-none rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">Today</span>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className={navBtn}>
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold" aria-live="polite">
          {label}
        </span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className={navBtn}>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 mb-1.5 grid grid-cols-7 gap-1" aria-hidden="true">
        {WEEKDAYS.map((_, i) => {
          const idx = (i + start) % 7;
          return (
            <abbr key={idx} title={WEEKDAY_NAMES[idx]} className="text-center text-xs font-semibold text-ink-faint no-underline">
              {WEEKDAYS[idx]}
            </abbr>
          );
        })}
      </div>
      <div role="grid" aria-label={label} className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`blank-${i}`} aria-hidden="true" />;
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          const isViewed = d === currentDateStr;
          const isPast = d < today;
          const name = parseDateStr(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
          return (
            <button
              key={d}
              type="button"
              aria-label={`${name}, ${list.length ? plural(list.length) : 'no notes'}${isToday ? ', today' : ''}`}
              aria-current={isViewed ? 'date' : undefined}
              onClick={() => {
                setCurrentDateStr(d);
                openDrawer(null);
              }}
              className={`flex h-[58px] flex-col items-center justify-start gap-[5px] rounded-[10px] pt-[7px] text-sm font-medium ${
                isToday ? 'bg-accent text-accent-ink' : `hover:bg-hover ${isPast ? 'text-ink-faint' : 'text-ink'}`
              } ${isViewed && !isToday ? 'ring-2 ring-accent-soft ring-inset' : ''}`}
            >
              <span>{parseDateStr(d).getDate()}</span>
              <span className="flex h-[9px] gap-[3px]" aria-hidden="true">
                {list.slice(0, 3).map(n => (
                  <i key={n.id} className={`paper-${n.noteColor} paper-swatch block h-[9px] w-[9px] shadow-[-1px_1px_1px_rgba(0,0,0,0.25)]`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 mb-0 px-1 text-[13px] text-ink-faint">Click a day to open it</p>
    </Drawer>
  );
}
