import React, { useState } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { motion } from 'motion/react';

export const CalendarView: React.FC = () => {
  const { todos, currentDateStr, setCurrentDateStr, setActiveTab } = useStickyBoard();
  const [viewDate, setViewDate] = useState<Date>(new Date(currentDateStr));

  const years = [2026, 2027];
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
    const dateStr = selected.toISOString().split('T')[0];
    setCurrentDateStr(dateStr);
    setActiveTab('board'); // Jump back to the board view
  };

  const year = viewDate.getFullYear();
  const monthIdx = viewDate.getMonth();
  const totalDays = getDaysInMonth(year, monthIdx);
  const firstDay = getFirstDayOfMonth(year, monthIdx);

  // Pad empty days at the start of calendar grid
  const pads = Array.from({ length: firstDay });
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Mock historic data density for heatmaps (if not currently present in db)
  // Maps date strings to mock task statistics for visual interest
  const getDayStats = (dayNum: number) => {
    const formattedDay = String(dayNum).padStart(2, '0');
    const formattedMonth = String(monthIdx + 1).padStart(2, '0');
    const targetDateStr = `${year}-${formattedMonth}-${formattedDay}`;

    // If viewing the current day, pull from actual state
    if (targetDateStr === currentDateStr) {
      const completed = todos.filter(t => t.isCompleted).length;
      const pending = todos.filter(t => !t.isCompleted).length;
      return { completed, pending, total: completed + pending };
    }

    // Otherwise, generate realistic mock densities based on hash of date
    let hash = 0;
    for (let i = 0; i < targetDateStr.length; i++) {
      hash = targetDateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const total = Math.abs(hash % 5);
    const completed = total > 0 ? Math.abs(hash % (total + 1)) : 0;
    const pending = total - completed;

    return { completed, pending, total };
  };

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-bold">Time Machine</span>
        <h1 className="font-display text-3xl font-extrabold text-white tracking-tight">Calendar Workspace</h1>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* Main Calendar Grid Card */}
        <div className="lg:col-span-8 rounded-2xl border border-white/5 bg-[#0c0c0e] p-6 shadow-xl">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between pb-6 border-b border-white/5">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-indigo-400" />
              <h2 className="font-display text-lg font-bold text-white">
                {months[monthIdx]} {year}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 p-1 bg-zinc-950">
              <button 
                onClick={() => handleMonthChange('prev')} 
                className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleMonthChange('next')} 
                className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekdays indicator line */}
          <div className="mt-6 grid grid-cols-7 text-center text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 pb-3">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-2 mt-2">
            {/* Blank pads */}
            {pads.map((_, idx) => (
              <div key={`pad-${idx}`} className="h-20 rounded-xl bg-zinc-950/20 opacity-30" />
            ))}

            {/* Days list */}
            {daysArray.map((day) => {
              const stats = getDayStats(day);
              const isToday = day === new Date().getDate() && monthIdx === new Date().getMonth() && year === new Date().getFullYear();
              
              // Color coding logic
              let cellColor = "bg-zinc-950/30 text-zinc-500 border-white/5"; // Empty default
              if (stats.total > 0) {
                if (stats.pending === 0) {
                  cellColor = "bg-emerald-950/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-950/30"; // Green: completed
                } else if (stats.completed > 0) {
                  cellColor = "bg-amber-950/20 text-amber-400 border-amber-500/20 hover:bg-amber-950/30"; // Orange: busy
                } else {
                  cellColor = "bg-indigo-950/20 text-indigo-400 border-indigo-500/20 hover:bg-indigo-950/30"; // Indigo: missed/all pending
                }
              }

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => selectDate(day)}
                  className={`group relative h-20 rounded-xl border p-2 flex flex-col justify-between items-start text-left transition-all hover:scale-103 hover:border-indigo-500 ${cellColor} ${
                    isToday ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
                  }`}
                >
                  <span className="font-display font-bold text-xs text-inherit">{day}</span>

                  {/* Indicator Pills */}
                  {stats.total > 0 && (
                    <div className="flex flex-col gap-1 w-full">
                      <div className="h-1 rounded-full w-full bg-zinc-800 overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
                        <div className="h-full bg-indigo-500" style={{ width: `${(stats.pending / stats.total) * 100}%` }} />
                      </div>
                      
                      {/* Detailed task text tags (only visible on hover/desktops) */}
                      <span className="text-[8px] font-semibold text-zinc-400 truncate opacity-0 group-hover:opacity-100 transition-opacity">
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
          <div className="rounded-2xl border border-white/5 bg-[#0c0c0e] p-5 shadow-xl">
            <h3 className="font-display text-sm font-bold text-white mb-4">Legend Indicator</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="h-5 w-5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-white">High Completion Rate</span>
                  <span className="block text-[10px] text-zinc-500">All tasks completed successfully.</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="h-5 w-5 rounded-lg bg-amber-950/20 border border-amber-500/20 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-white">Busy Workloads</span>
                  <span className="block text-[10px] text-zinc-500">Mixture of completed & pending tasks.</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="h-5 w-5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-center">
                  <AlertCircle className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-white">Overdue or Missed</span>
                  <span className="block text-[10px] text-zinc-500">Tasks remain incomplete or pending.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-gradient-to-tr from-indigo-950/10 to-zinc-950 p-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-3">
              <Info className="h-4 w-4" />
            </div>
            <h4 className="font-display text-xs font-bold text-white uppercase tracking-wider">Mindful Time Blocking</h4>
            <p className="text-[11px] text-zinc-400 leading-normal mt-1">
              "You cannot step into the same river twice." StickyBoard locks each day's board on the date specified. 
              Clicking past dates navigates back to explore how you structured those moments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
