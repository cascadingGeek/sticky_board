import { CalendarDays, ChevronLeft, ChevronRight, Globe, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { daySubtitle, offsetDateStr, parseDateStr } from '../lib/dates';

const iconBtn = 'relative flex h-11 w-11 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-hover';
const activeBtn = 'bg-accent-wash';

/** The only lasting UI: the day with ←/→, then Search, Calendar, Pages, Trash, Settings and New note. */
export function TopBar() {
  const { currentDateStr, setCurrentDateStr, today, notes, allNotes, openDrawer, drawer, searchOpen, setSearchOpen, requestNewNote } =
    useStickyBoard();
  const trashCount = allNotes.filter(n => n.deletedAt).length;
  const dayCount = notes.filter(n => n.dateStr === currentDateStr && isActive(n)).length;
  const isToday = currentDateStr === today;
  const dateLabel = parseDateStr(currentDateStr).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <header className="relative z-30 flex h-16 items-center gap-2 border-b border-bar-line bg-bar px-4 text-ink backdrop-blur-md sm:px-6">
      <button
        type="button"
        aria-label="Previous day"
        title="Previous day (←)"
        className={iconBtn}
        onClick={() => setCurrentDateStr(offsetDateStr(currentDateStr, -1))}
      >
        <ChevronLeft size={19} aria-hidden="true" />
      </button>
      <h1 className="m-0 flex min-w-0 flex-col px-1 leading-[1.15]" aria-live="polite">
        <span className="truncate text-[17px] font-semibold">{dateLabel}</span>
        <span className="truncate text-xs font-normal text-ink-faint">{daySubtitle(currentDateStr, today, dayCount)}</span>
      </h1>
      <button
        type="button"
        aria-label="Next day"
        title="Next day (→)"
        className={iconBtn}
        onClick={() => setCurrentDateStr(offsetDateStr(currentDateStr, 1))}
      >
        <ChevronRight size={19} aria-hidden="true" />
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={() => setCurrentDateStr(today)}
          title="Go to today (T)"
          className="ml-1 min-h-11 rounded-full px-3 text-xs font-semibold text-ink hover:bg-hover"
        >
          <span className="rounded-full bg-accent-wash px-3 py-1.5">Today</span>
        </button>
      )}

      <nav aria-label="Tools" className="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Search"
          aria-expanded={searchOpen}
          title="Search (⌘K)"
          className={`${iconBtn} ${searchOpen ? activeBtn : ''}`}
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Calendar"
          title="Calendar"
          className={`${iconBtn} ${drawer === 'calendar' ? activeBtn : ''}`}
          onClick={() => openDrawer('calendar')}
        >
          <CalendarDays size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Notes on web pages"
          title="Notes on web pages"
          className={`${iconBtn} ${drawer === 'pages' ? activeBtn : ''}`}
          onClick={() => openDrawer('pages')}
        >
          <Globe size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={trashCount ? `Trash, ${trashCount} ${trashCount === 1 ? 'note' : 'notes'}` : 'Trash'}
          title="Trash"
          className={`${iconBtn} ${drawer === 'trash' ? activeBtn : ''}`}
          onClick={() => openDrawer('trash')}
        >
          <Trash2 size={19} aria-hidden="true" />
          {trashCount > 0 && (
            <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink">
              {trashCount > 99 ? '99+' : trashCount}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          className={`${iconBtn} ${drawer === 'settings' ? activeBtn : ''}`}
          onClick={() => openDrawer('settings')}
        >
          <SlidersHorizontal size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="New note"
          title="New note (N)"
          onMouseDown={e => e.preventDefault()}
          onClick={requestNewNote}
          className="ml-2 flex h-11 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-ink hover:opacity-90 sm:px-[18px]"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span className="hidden sm:inline">New note</span>
        </button>
      </nav>
    </header>
  );
}
