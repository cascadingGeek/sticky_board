import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import {
  ClipboardList, Calendar, BarChart3, Timer, Settings, LogOut,
  Plus, Sun, Moon, ChevronLeft, ChevronRight, CalendarCheck, Search, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { offsetDateStr } from '../lib/dates';

/**
 * ⌘K command palette + global keyboard shortcuts for the dashboard.
 *
 * Shortcuts (ignored while typing in inputs):
 *   ⌘/Ctrl+K  toggle the palette
 *   ←  / →    previous / next day (Board view)
 *   T         jump to today (Board view)
 *   N         new sticky note (Board view)
 */

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  run: () => void;
}

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
};

export const CommandPalette: React.FC = () => {
  const {
    user, activeTab, setActiveTab, currentDateStr, setCurrentDateStr,
    getToday, addTodo, updatePreferences, logout
  } = useStickyBoard();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };

  const commands = useMemo<Command[]>(() => {
    if (!user) return [];
    const nav = (tab: 'board' | 'calendar' | 'analytics' | 'focus' | 'settings') => () => {
      setActiveTab(tab);
      close();
    };
    return [
      { id: 'new-note', label: 'New sticky note', hint: 'N', icon: Plus, keywords: 'create add task todo pin', run: () => { setActiveTab('board'); window.dispatchEvent(new Event('sb:new-note')); close(); } },
      { id: 'board', label: 'Go to Board', icon: ClipboardList, keywords: 'board notes corkboard home', run: nav('board') },
      { id: 'calendar', label: 'Go to Calendar', icon: Calendar, keywords: 'calendar month dates history', run: nav('calendar') },
      { id: 'analytics', label: 'Go to Analytics', icon: BarChart3, keywords: 'analytics stats streak charts', run: nav('analytics') },
      { id: 'focus', label: 'Go to Focus Mode', icon: Timer, keywords: 'focus pomodoro timer deep work', run: nav('focus') },
      { id: 'settings', label: 'Go to Settings', icon: Settings, keywords: 'settings preferences theme accent', run: nav('settings') },
      { id: 'today', label: 'Jump to today', hint: 'T', icon: CalendarCheck, keywords: 'today now current day', run: () => { setCurrentDateStr(getToday()); setActiveTab('board'); close(); } },
      { id: 'prev-day', label: 'Previous day', hint: '←', icon: ChevronLeft, keywords: 'yesterday back previous day', run: () => { setCurrentDateStr(offsetDateStr(currentDateStr, -1)); setActiveTab('board'); close(); } },
      { id: 'next-day', label: 'Next day', hint: '→', icon: ChevronRight, keywords: 'tomorrow forward next day', run: () => { setCurrentDateStr(offsetDateStr(currentDateStr, 1)); setActiveTab('board'); close(); } },
      {
        id: 'toggle-theme',
        label: user.preferences.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: user.preferences.theme === 'dark' ? Sun : Moon,
        keywords: 'theme light dark appearance mode',
        run: () => { updatePreferences({ theme: user.preferences.theme === 'dark' ? 'light' : 'dark' }); close(); }
      },
      { id: 'logout', label: 'Exit workspace', icon: LogOut, keywords: 'logout sign out exit leave', run: () => { logout(); close(); } }
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentDateStr]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.keywords.includes(q));
  }, [commands, query]);

  // "Create note" fallback when the query matches nothing (or as an extra row)
  const canQuickCreate = query.trim().length > 2;

  const totalRows = filtered.length + (canQuickCreate ? 1 : 0);

  const runQuickCreate = async () => {
    await addTodo({ title: query.trim() });
    setActiveTab('board');
    close();
  };

  // Global shortcuts
  useEffect(() => {
    if (!user) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Palette toggle works everywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(open => !open);
        return;
      }
      if (isOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      // Board-level navigation shortcuts
      if (activeTab === 'board') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setCurrentDateStr(offsetDateStr(currentDateStr, -1));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setCurrentDateStr(offsetDateStr(currentDateStr, 1));
        } else if (e.key.toLowerCase() === 't') {
          setCurrentDateStr(getToday());
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          window.dispatchEvent(new Event('sb:new-note'));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen, activeTab, currentDateStr]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!user || !isOpen) return null;

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, totalRows - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filtered.length) filtered[selectedIndex]?.run();
      else if (canQuickCreate) runQuickCreate();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[18vh] p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: -8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-2xl"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <Search className="h-4 w-4 text-ink-faint flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a command or a note title…"
              className="flex-1 bg-transparent text-sm text-ink placeholder-zinc-500 outline-none"
            />
            <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.run}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected ? 'bg-accent/10 text-ink' : 'text-ink-soft'
                  }`}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-accent-soft' : 'text-ink-faint'}`} />
                  <span className="flex-1 font-display text-xs font-semibold">{cmd.label}</span>
                  {cmd.hint && (
                    <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">{cmd.hint}</kbd>
                  )}
                </button>
              );
            })}

            {canQuickCreate && (
              <button
                onClick={runQuickCreate}
                onMouseEnter={() => setSelectedIndex(filtered.length)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedIndex === filtered.length ? 'bg-accent/10 text-ink' : 'text-ink-soft'
                }`}
              >
                <Sparkles className={`h-4 w-4 flex-shrink-0 ${selectedIndex === filtered.length ? 'text-accent-soft' : 'text-ink-faint'}`} />
                <span className="flex-1 font-display text-xs font-semibold">
                  Create note: <span className="text-accent-soft">"{query.trim()}"</span>
                </span>
                <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-faint">↵</kbd>
              </button>
            )}

            {filtered.length === 0 && !canQuickCreate && (
              <p className="px-3 py-6 text-center text-xs text-ink-faint">No matching commands.</p>
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[9px] font-mono uppercase tracking-wider text-ink-faint">
            <span>↑↓ Navigate</span>
            <span>↵ Run</span>
            <span className="ml-auto">On Board: ←/→ days · T today · N new note</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
