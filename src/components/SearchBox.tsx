import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, Search, SlidersHorizontal, Sun, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { shortDay } from '../lib/dates';
import { openPage, siteOf } from '../lib/pageNotes';
import type { Note } from '../types';

const MAX_RESULTS = 50;

interface Command {
  id: string;
  label: string;
  icon: typeof Search;
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
    { id: 'new', label: 'New note', icon: Plus, run: () => { close(); requestNewNote(); } },
    { id: 'today', label: 'Go to today', icon: Sun, run: () => { close(); setCurrentDateStr(today); } },
    { id: 'calendar', label: 'Open calendar', icon: CalendarDays, run: () => openDrawer('calendar') },
    { id: 'trash', label: 'Open trash', icon: Trash2, run: () => openDrawer('trash') },
    { id: 'settings', label: 'Open settings', icon: SlidersHorizontal, run: () => openDrawer('settings') },
  ];

  const matches = useMemo(() => {
    if (debounced.length < 2) return [];
    // Board notes from every day plus page notes (spec 0002, AC-12).
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

  const renderTitle = (title: string) => {
    const i = title.toLowerCase().indexOf(debounced);
    if (i < 0 || !debounced) return title;
    return (
      <>
        {title.slice(0, i)}
        <mark className="rounded-[3px] bg-[rgba(250,204,21,0.3)] px-0.5 text-inherit">{title.slice(i, i + debounced.length)}</mark>
        {title.slice(i + debounced.length)}
      </>
    );
  };

  return (
    <div
      ref={panelRef}
      role="search"
      className="fixed top-16 right-4 z-40 w-[480px] max-w-[calc(100%-32px)] overflow-hidden rounded-2xl border border-line bg-panel text-ink shadow-2xl animate-fade-in sm:right-6"
    >
      <label className="flex h-[52px] items-center gap-2.5 border-b border-line px-4 text-accent-soft">
        <Search size={18} aria-hidden="true" />
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
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
        <kbd className="rounded-md bg-raise px-2 py-0.5 font-mono text-[11px] text-ink-faint">Esc</kbd>
      </label>

      <div id="search-results" role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-1.5">
        {items.map((item, i) => {
          const selected = i === safeActive;
          const base = `flex w-full items-start gap-3 rounded-[10px] px-3 py-2.5 text-left ${selected ? 'bg-accent-wash' : 'hover:bg-raise'}`;
          if (item.kind === 'cmd') {
            const Icon = item.c.icon;
            return (
              <button key={item.c.id} id={`search-item-${i}`} type="button" role="option" aria-selected={selected} onMouseEnter={() => setActive(i)} onClick={() => runItem(i)} className={`${base} items-center`}>
                <Icon size={16} className="text-ink-faint" aria-hidden="true" />
                <span className="text-sm">{item.c.label}</span>
              </button>
            );
          }
          const n = item.n;
          return (
            <button key={n.id} id={`search-item-${i}`} type="button" role="option" aria-selected={selected} onMouseEnter={() => setActive(i)} onClick={() => runItem(i)} className={base}>
              <span aria-hidden="true" className={`paper-${n.noteColor} mt-1.5 h-2.5 w-2.5 flex-none rounded-[3px]`} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{renderTitle(n.title)}</span>
                  <span className="max-w-[45%] truncate text-xs whitespace-nowrap text-ink-faint">
                    {n.page ? siteOf(n.page.url) : n.dateStr === today ? 'Today' : shortDay(n.dateStr)}
                  </span>
                </span>
                <span className="truncate text-xs text-ink-faint">{snippetFor(n, debounced)}</span>
              </span>
            </button>
          );
        })}
        {debounced.length < 2 && (
          <p className="px-3 py-3 text-xs text-ink-faint">Type to search all your notes.</p>
        )}
        {debounced.length >= 2 && matches.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-ink-faint">No notes match.</p>
        )}
        {matches.length > MAX_RESULTS && (
          <p className="px-3 py-2 text-xs text-ink-faint">Showing the first {MAX_RESULTS}.</p>
        )}
      </div>
      <div className="border-t border-line px-4 py-2.5 text-xs text-ink-faint">↑ ↓ to move · Enter to open</div>
    </div>
  );
}
