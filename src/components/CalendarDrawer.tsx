import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { parseDateStr, toDateStr } from '../lib/dates';
import { Drawer } from './Drawer';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Month grid with a dot per note (solid done, outlined open); a day click opens that board. */
export function CalendarDrawer() {
  const { notes, currentDateStr, setCurrentDateStr, today, settings, openDrawer } = useStickyBoard();
  const [month, setMonth] = useState(() => {
    const d = parseDateStr(currentDateStr);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const counts = useMemo(() => {
    const map = new Map<string, { done: number; open: number }>();
    for (const n of notes) {
      if (!isActive(n)) continue;
      const c = map.get(n.dateStr) ?? { done: 0, open: 0 };
      if (n.isCompleted) c.done++;
      else c.open++;
      map.set(n.dateStr, c);
    }
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

  return (
    <Drawer title="Calendar" onClose={() => openDrawer(null)}>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-faint hover:bg-raise">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-[15px] font-semibold" aria-live="polite">
          {label}
        </span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-faint hover:bg-raise">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div role="grid" aria-label={label} className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((_, i) => {
          const idx = (i + start) % 7;
          return (
            <abbr key={idx} title={WEEKDAY_NAMES[idx]} className="pb-1 text-center text-[11px] font-semibold text-ink-faint no-underline">
              {WEEKDAYS[idx]}
            </abbr>
          );
        })}
        {cells.map((d, i) => {
          if (!d) return <span key={`blank-${i}`} aria-hidden="true" />;
          const c = counts.get(d) ?? { done: 0, open: 0 };
          const total = c.done + c.open;
          const dots = [...Array(Math.min(c.done, 3)).fill('done'), ...Array(Math.max(0, Math.min(c.open, 3 - Math.min(c.done, 3)))).fill('open')];
          const isToday = d === today;
          const isViewed = d === currentDateStr;
          return (
            <button
              key={d}
              type="button"
              aria-label={`${parseDateStr(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${c.done} done, ${c.open} open`}
              aria-current={isViewed ? 'date' : undefined}
              onClick={() => {
                setCurrentDateStr(d);
                openDrawer(null);
              }}
              className={`flex h-12 flex-col items-center justify-center gap-1 rounded-[10px] text-[13px] ${
                isViewed ? 'bg-accent font-bold text-accent-ink' : 'hover:bg-raise'
              } ${isToday ? 'ring-2 ring-accent-soft ring-offset-2 ring-offset-panel' : ''} ${d > today && !isViewed ? 'text-ink-faint' : ''}`}
            >
              <span>{parseDateStr(d).getDate()}</span>
              <span className="flex h-1.5 items-center gap-[3px]" aria-hidden="true">
                {dots.map((kind, j) => (
                  <span key={j} className={`h-1.5 w-1.5 rounded-full ${kind === 'done' ? 'bg-current' : 'border-[1.5px] border-current'}`} />
                ))}
                {total > 3 && <span className="text-[9px] leading-none font-bold">+</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-current" aria-hidden="true" />
          Open
        </span>
        <span className="ml-auto">Click a day to open it</span>
      </div>
    </Drawer>
  );
}
