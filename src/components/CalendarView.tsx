import React, { useState } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { toDateStr } from '../lib/dates';

export const CalendarView: React.FC = () => {
  const { allTodos, currentDateStr, setCurrentDateStr, setActiveTab, user, getToday } = useStickyBoard();
  const [viewDate, setViewDate] = useState<Date>(new Date(`${currentDateStr}T00:00:00`));

  // Week layout respects the user's start-of-week preference
  const startOfWeek = user?.preferences.startOfWeek ?? 0;
  const weekdayLabels = startOfWeek === 1
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper: Get number of days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper: Get first day of week for month (0 = Sun, 1 = Mon, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const nextDate = new Date(viewDate);
    if (direction === 'prev') {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setViewDate(nextDate);
  };

  const selectDate = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setCurrentDateStr(toDateStr(selected));
    setActiveTab('board'); // Jump back to the board view
  };

  const year = viewDate.getFullYear();
  const monthIdx = viewDate.getMonth();
  const totalDays = getDaysInMonth(year, monthIdx);
  const firstDay = (getFirstDayOfMonth(year, monthIdx) - startOfWeek + 7) % 7;

  // Pad empty days at the start of calendar grid
  const pads = Array.from({ length: firstDay });
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Real task density per day, computed from board data
  const getDayStats = (dayNum: number) => {
    const targetDateStr = toDateStr(new Date(year, monthIdx, dayNum));
    const dayTodos = allTodos.filter(t => t.dateStr === targetDateStr);
    const completed = dayTodos.filter(t => t.isCompleted).length;
    return { completed, pending: dayTodos.length - completed, total: dayTodos.length };
  };

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <span className="text-[10px] uppercase font-mono tracking-wider text-accent-soft font-bold">Time Machine</span>
        <h1 className="font-display text-3xl font-extrabold text-ink tracking-tight">Calendar Workspace</h1>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* Main Calendar Grid Card */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-surface p-6 shadow-xl">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between pb-6 border-b border-line">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-accent-soft" />
              <h2 className="font-display text-lg font-bold text-ink">
                {months[monthIdx]} {year}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-line-strong p-1 bg-field">
              <button 
                onClick={() => handleMonthChange('prev')} 
                className="rounded-md p-1.5 text-ink-soft hover:bg-raise hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleMonthChange('next')} 
                className="rounded-md p-1.5 text-ink-soft hover:bg-raise hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekdays indicator line */}
          <div className="mt-6 grid grid-cols-7 text-center text-xs font-mono font-bold uppercase tracking-wider text-ink-faint pb-3">
            {weekdayLabels.map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-2 mt-2">
            {/* Blank pads */}
            {pads.map((_, idx) => (
              <div key={`pad-${idx}`} className="h-20 rounded-xl bg-field/20 opacity-30" />
            ))}

            {/* Days list */}
            {daysArray.map((day) => {
              const stats = getDayStats(day);
              const isToday = toDateStr(new Date(year, monthIdx, day)) === getToday();
              
              // Color coding logic
              let cellColor = "bg-field/30 text-ink-faint border-line"; // Empty default
              if (stats.total > 0) {
                if (stats.pending === 0) {
                  cellColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20"; // Green: completed
                } else if (stats.completed > 0) {
                  cellColor = "bg-amber-500/10 text-amber-600 border-amber-500/25 hover:bg-amber-500/20"; // Orange: busy
                } else {
                  cellColor = "bg-accent/10 text-accent-soft border-accent/20 hover:bg-accent/15"; // Indigo: missed/all pending
                }
              }

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => selectDate(day)}
                  className={`group relative h-20 rounded-xl border p-2 flex flex-col justify-between items-start text-left transition-all hover:scale-103 hover:border-accent ${cellColor} ${
                    isToday ? 'ring-2 ring-accent border-accent' : ''
                  }`}
                >
                  <span className="font-display font-bold text-xs text-inherit">{day}</span>

                  {/* Indicator Pills */}
                  {stats.total > 0 && (
                    <div className="flex flex-col gap-1 w-full">
                      <div className="h-1 rounded-full w-full bg-muted-strong overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
                        <div className="h-full bg-accent" style={{ width: `${(stats.pending / stats.total) * 100}%` }} />
                      </div>
                      
                      {/* Detailed task text tags (only visible on hover/desktops) */}
                      <span className="text-[8px] font-semibold text-ink-soft truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {stats.completed}/{stats.total} Done
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side Panel: Calendar Legend & Insights */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <h3 className="font-display text-sm font-bold text-ink mb-4">Legend Indicator</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="h-5 w-5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-ink">High Completion Rate</span>
                  <span className="block text-[10px] text-ink-faint">All tasks completed successfully.</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="h-5 w-5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-ink">Busy Workloads</span>
                  <span className="block text-[10px] text-ink-faint">Mixture of completed & pending tasks.</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="h-5 w-5 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-accent-soft" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-ink">Overdue or Missed</span>
                  <span className="block text-[10px] text-ink-faint">Tasks remain incomplete or pending.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-gradient-to-tr from-accent/5 to-field p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent-soft mb-3">
              <Info className="h-4 w-4" />
            </div>
            <h4 className="font-display text-xs font-bold text-ink uppercase tracking-wider">Mindful Time Blocking</h4>
            <p className="text-[11px] text-ink-soft leading-normal mt-1">
              "You cannot step into the same river twice." StickyBoard locks each day's board on the date specified. 
              Clicking past dates navigates back to explore how you structured those moments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
