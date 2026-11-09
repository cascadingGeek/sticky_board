import { CalendarDays, ChevronLeft, ChevronRight, Globe, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { longDate, offsetDateStr, weekdayName } from '../lib/dates';

const iconBtn =
  'relative flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-faint transition-colors hover:bg-raise hover:text-ink';

/** The only lasting UI: the day with ←/→, and icons for Search, Calendar, Pages, Trash, Settings and New note. */
export function TopBar() {
  const { currentDateStr, setCurrentDateStr, today, allNotes, openDrawer, drawer, searchOpen, setSearchOpen, requestNewNote } =
    useStickyBoard();
  const trashCount = allNotes.filter(n => n.deletedAt).length;
  const isToday = currentDateStr === today;

  return (
    <header className="on-board relative z-30 flex h-16 items-center gap-2 px-4 text-ink sm:px-6">
      <button
        type="button"
        aria-label="Previous day"
        title="Previous day (←)"
        className={iconBtn}
        onClick={() => setCurrentDateStr(offsetDateStr(currentDateStr, -1))}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <h1 className="flex min-w-0 items-baseline gap-2.5" aria-live="polite">
        <span className="font-display text-[22px] font-bold tracking-tight">{weekdayName(currentDateStr)}</span>
        <span className="truncate text-sm text-ink-faint">{longDate(currentDateStr)}</span>
      </h1>
      <button
        type="button"
        aria-label="Next day"
        title="Next day (→)"
        className={iconBtn}
        onClick={() => setCurrentDateStr(offsetDateStr(currentDateStr, 1))}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={() => setCurrentDateStr(today)}
          title="Go to today (T)"
          className="ml-1 rounded-full bg-accent-wash px-3 py-1.5 text-xs font-semibold text-accent-soft hover:brightness-110"
        >
          Today
        </button>
      )}

      <nav aria-label="Tools" className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Search"
          aria-expanded={searchOpen}
          title="Search (⌘K)"
          className={`${iconBtn} ${searchOpen ? 'bg-accent-wash text-accent-soft' : ''}`}
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Calendar"
          title="Calendar"
          className={`${iconBtn} ${drawer === 'calendar' ? 'bg-accent-wash text-accent-soft' : ''}`}
          onClick={() => openDrawer('calendar')}
        >
          <CalendarDays size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Pages"
          title="Notes on web pages"
          className={`${iconBtn} ${drawer === 'pages' ? 'bg-accent-wash text-accent-soft' : ''}`}
          onClick={() => openDrawer('pages')}
        >
          <Globe size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={trashCount ? `Trash, ${trashCount} ${trashCount === 1 ? 'note' : 'notes'}` : 'Trash'}
          title="Trash"
          className={`${iconBtn} ${drawer === 'trash' ? 'bg-accent-wash text-accent-soft' : ''}`}
          onClick={() => openDrawer('trash')}
        >
          <Trash2 size={19} aria-hidden="true" />
          {trashCount > 0 && (
            <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-raise-strong px-1 text-[10px] font-semibold text-ink">
              {trashCount > 99 ? '99+' : trashCount}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          className={`${iconBtn} ${drawer === 'settings' ? 'bg-accent-wash text-accent-soft' : ''}`}
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
          className="ml-2 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-lg hover:brightness-110"
        >
          <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </nav>
    </header>
  );
}
