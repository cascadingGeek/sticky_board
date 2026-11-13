import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Globe, Plus, Search, SlidersHorizontal, Sun, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../StickyBoardContext';
import { isActive } from '../../shared/notes';
import { shortDay } from '../../shared/dates';
import { openPage, siteOf } from '../../shared/pageNotes';
import type { Note } from '../../shared/types';
import { Pin } from '../../shared/ui/Pin';

const MAX_RESULTS = 50;

interface Command {
  id: string;
  label: string;
  icon: typeof Search;
  /** The board shortcut for this command, shown as a key hint. */
  key?: string;
  run: () => void;
}

const snippetFor = (n: Note, q: string): string => {
  const text = n.description || n.subtasks.map(s => s.title).join(' · ') || n.source?.title || '';
  const i = text.toLowerCase().indexOf(q);
  if (i <= 30) return text.slice(0, 120);
  return `…${text.slice(i - 30, i + 90)}`;
};

/** The search box (also the ⌘K palette): commands plus notes across every day. */
export function SearchBox() {
  const { allNotes, setSearchOpen, setCurrentDateStr, highlight, today, requestNewNote, openDrawer } = useStickyBoard();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);

  // Clicking outside the panel closes it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest('[aria-label="Search"]')) setSearchOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [setSearchOpen]);

  const close = () => setSearchOpen(false);

  const commands: Command[] = [
    { id: 'today', label: 'Go to today', icon: Sun, key: 'T', run: () => { close(); setCurrentDateStr(today); } },
    { id: 'new', label: 'New note', icon: Plus, key: 'N', run: () => { close(); requestNewNote(); } },
    { id: 'calendar', label: 'Open calendar', icon: CalendarDays, run: () => openDrawer('calendar') },
    { id: 'trash', label: 'Open trash', icon: Trash2, run: () => openDrawer('trash') },
    { id: 'settings', label: 'Open settings', icon: SlidersHorizontal, run: () => openDrawer('settings') },
  ];

  const matches = useMemo(() => {
    if (debounced.length < 2) return [];
    // Board notes from every day plus page notes.
    return allNotes
      .filter(n => isActive(n) && !n.carriedToDate)
      .filter(n =>
        [n.title, n.description, n.source?.title ?? '', ...n.subtasks.map(s => s.title)].some(t => t.toLowerCase().includes(debounced)),
      )
      .sort((a, b) => (a.dateStr === b.dateStr ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.dateStr < b.dateStr ? 1 : -1));
  }, [allNotes, debounced]);

  const shownCommands = commands.filter(c => !debounced || c.label.toLowerCase().includes(debounced));
  const shownNotes = matches.slice(0, MAX_RESULTS);
  const items = [...shownCommands.map(c => ({ kind: 'cmd' as const, c })), ...shownNotes.map(n => ({ kind: 'note' as const, n }))];
  const safeActive = Math.min(active, Math.max(0, items.length - 1));

  const openNote = (n: Note) => {
    close();
    if (n.page) {
      openPage(n);
      return;
    }
    setCurrentDateStr(n.dateStr);
    setTimeout(() => highlight(n.id), 50);
  };
  const runItem = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (item.kind === 'cmd') item.c.run();
    else openNote(item.n);
  };

  const marked = (text: string) => {
    const i = debounced ? text.toLowerCase().indexOf(debounced) : -1;
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="rounded-[3px] bg-mark px-0.5 text-ink">{text.slice(i, i + debounced.length)}</mark>
        {text.slice(i + debounced.length)}
      </>
    );
  };

  const searching = debounced.length >= 2;
  const anyPage = shownNotes.some(n => n.page);
  const heading = 'm-0 px-[18px] pt-3 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-faint uppercase';
  const kbd = 'rounded-md bg-kbd px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink';

  const renderItem = (i: number) => {
    const item = items[i]!;
    const selected = i === safeActive;
    const base = `flex w-full items-center gap-3 px-[18px] text-left ${selected ? 'bg-accent-wash' : 'hover:bg-hover'}`;
    if (item.kind === 'cmd') {
      const Icon = item.c.icon;
      return (
        <button
          key={item.c.id}
          id={`search-item-${i}`}
          type="button"
          role="option"
          aria-selected={selected}
          onMouseEnter={() => setActive(i)}
          onClick={() => runItem(i)}
          className={`${base} min-h-[46px]`}
        >
          <Icon size={17} className="flex-none text-ink-soft" aria-hidden="true" />
          <span className="flex-1 text-[15px]">{item.c.label}</span>
          {item.c.key && <kbd className={kbd}>{item.c.key}</kbd>}
        </button>
      );
    }
    const n = item.n;
    return (
      <button
        key={n.id}
        id={`search-item-${i}`}
        type="button"
        role="option"
        aria-selected={selected}
        onMouseEnter={() => setActive(i)}
        onClick={() => runItem(i)}
        className={`${base} py-2.5`}
      >
        <span
          aria-hidden="true"
          className={`paper-${n.noteColor} paper-swatch h-[34px] w-[34px] flex-none -rotate-2 shadow-[-1px_2px_3px_rgba(0,0,0,0.2)]`}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`font-hand note-row-title truncate text-ink ${n.isCompleted ? 'line-through opacity-70' : ''}`}>{marked(n.title)}</span>
          <span className="truncate text-[13px] text-ink-soft">{marked(snippetFor(n, debounced))}</span>
        </span>
        {n.page ? (
          <span className="flex max-w-[40%] flex-none items-center gap-1 truncate rounded-full bg-ok-wash px-2 py-0.5 text-xs font-semibold text-ok-ink">
            <Globe size={11} aria-hidden="true" className="flex-none" />
            <span className="truncate">{siteOf(n.page.url)}</span>
          </span>
        ) : (
          <span className="flex-none text-xs font-medium whitespace-nowrap text-ink-soft">{n.dateStr === today ? 'Today' : shortDay(n.dateStr)}</span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-center px-4 pt-24">
      <div aria-hidden="true" className="absolute inset-0 bg-scrim animate-fade-in" />
      <div
        ref={panelRef}
        role="search"
        className="relative flex max-h-[calc(100vh-128px)] w-[640px] max-w-full flex-col self-start overflow-hidden rounded-[18px] bg-raise text-ink shadow-pop animate-fade-in"
      >
        <label className="flex h-[60px] flex-none items-center gap-3 border-b border-line px-[18px] text-ink-soft">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Search all notes</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={items.length ? `search-item-${safeActive}` : undefined}
            placeholder="Search notes or type a command"
            onChange={e => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(safeActive + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(safeActive - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runItem(safeActive);
              }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-lg text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          <kbd className={kbd}>Esc</kbd>
        </label>

        <div id="search-results" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto pb-1.5">
          {!searching && <p className="m-0 px-[18px] pt-4 pb-1 text-sm text-ink-soft">Type to search all your notes.</p>}
          {shownCommands.length > 0 && (
            <div role="group" aria-label="Commands">
              <p aria-hidden="true" className={heading}>
                Commands
              </p>
              {shownCommands.map((_, i) => renderItem(i))}
            </div>
          )}
          {searching && shownNotes.length > 0 && (
            <div role="group" aria-label="Notes">
              <p aria-hidden="true" className={heading}>
                Results · {matches.length}
              </p>
              {shownNotes.map((_, j) => renderItem(shownCommands.length + j))}
            </div>
          )}
          {searching && matches.length === 0 && shownCommands.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 pt-8 pb-7 text-center">
              <span aria-hidden="true" className="paper-note paper-cream relative mb-2 h-[78px] w-[78px] -rotate-3">
                <span className="paper flex items-center justify-center pt-2 font-hand text-[26px] text-[var(--paper-ink)] opacity-70">
                  <Pin color="red" style={{ top: 8, transform: 'scale(0.8)' }} />?
                </span>
              </span>
              <p className="m-0 font-hand text-[30px] leading-none text-ink">No notes match.</p>
              <p className="m-0 max-w-[380px] text-sm leading-relaxed text-ink-soft">
                Search looks at titles, details and checklists, including notes pinned on websites. Try a shorter word.
              </p>
            </div>
          )}
          {matches.length > MAX_RESULTS && <p className="m-0 px-[18px] py-2 text-xs text-ink-faint">Showing the first {MAX_RESULTS}.</p>}
        </div>
        <div className="flex flex-none items-center justify-between gap-3 border-t border-line px-[18px] py-2.5 text-xs text-ink-soft">
          <span>↑ ↓ to move · Enter to open</span>
          {anyPage && <span className="truncate">Page notes open their website in a new tab</span>}
        </div>
      </div>
    </div>
  );
}
