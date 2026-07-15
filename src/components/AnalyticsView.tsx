import React from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { Flame, CheckCircle2, CircleAlert, PieChart, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

export const AnalyticsView: React.FC = () => {
  const { stats } = useStickyBoard();

  const completionRate = stats?.completionRate ?? 0;
  const totalCompleted = stats?.totalCompleted ?? 0;
  const totalPending = stats?.totalPending ?? 0;
  const streak = stats?.streak ?? { currentStreak: 0, longestStreak: 0 };
  const categories = stats?.categoryDistribution ?? [];
  const weekly = stats?.weeklyActivity ?? [];

  // Calculate coordinates for a custom SVG line or spline to show Weekly Trends
  const maxVal = Math.max(...weekly.map(w => w.completed + w.pending), 1);

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <span className="text-[10px] uppercase font-mono tracking-wider text-accent-soft font-bold">Metrics Dashboard</span>
        <h1 className="font-display text-3xl font-extrabold text-ink tracking-tight">Productivity Analytics</h1>
      </div>

      {/* STATS COUNT BENTO GRID */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Completion rate */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">Completion</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-ink">{completionRate}%</span>
            <span className="text-xs text-emerald-400">rate</span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Calculated across all created sticky notes</p>
        </div>

        {/* Card 2: Completed count */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-blue-500/5 blur-2xl" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-ink">{totalCompleted}</span>
            <span className="text-xs text-ink-faint">tasks</span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Total push pins popped from corkboard</p>
        </div>

        {/* Card 3: Pending counts */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-rose-500/5 blur-2xl" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">Active Board</span>
            <CircleAlert className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-ink">{totalPending}</span>
            <span className="text-xs text-ink-faint font-semibold">notes</span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Todos currently pinned to board</p>
        </div>

        {/* Card 4: Daily streaks */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-ink-faint">Habit Streak</span>
            <Flame className="h-4 w-4 text-amber-500 fill-amber-500/10" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-3xl font-extrabold text-ink">{streak.currentStreak}</span>
            <span className="text-xs text-amber-500 font-bold">days</span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Longest Streak record is {streak.longestStreak} days</p>
        </div>
      </div>

      {/* CHARTS CONTAINER BENTO GRID */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* Weekly activity custom bar chart */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent-soft" />
              <h3 className="font-display text-sm font-bold text-ink">Weekly Activity Flow</h3>
            </div>
            <span className="text-[10px] font-mono uppercase text-ink-faint">Distribution per weekday</span>
          </div>

          {/* Interactive Bars Grid */}
          <div className="mt-8 flex h-60 items-end justify-between gap-4 px-4">
            {weekly.map((w, idx) => {
              const totalTasks = w.completed + w.pending;
              const completedHeight = totalTasks > 0 ? (w.completed / maxVal) * 100 : 0;
              const pendingHeight = totalTasks > 0 ? (w.pending / maxVal) * 100 : 0;

              return (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  {/* Floating tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-16 bg-field border border-line-strong rounded px-2 py-1 text-[9px] text-ink-soft font-mono text-center pointer-events-none shadow-xl">
                    <span className="block font-bold text-emerald-400">{w.completed} Done</span>
                    <span className="block text-rose-400">{w.pending} Pinned</span>
                  </div>

                  {/* Visual Bar Stack */}
                  <div className="relative flex flex-col justify-end w-7 sm:w-10 h-44 rounded-lg bg-raise-faint overflow-hidden border border-line hover:border-accent/30 transition-all">
                    {/* Pending segment */}
                    <div 
                      className="bg-rose-500/25 transition-all duration-500" 
                      style={{ height: `${pendingHeight}%` }} 
                    />
                    {/* Completed segment */}
                    <div 
                      className="bg-emerald-500/75 transition-all duration-500" 
                      style={{ height: `${completedHeight}%` }} 
                    />
                  </div>

                  {/* Day Label */}
                  <span className="mt-4 font-display text-xs text-ink-faint font-semibold uppercase tracking-wider">
                    {w.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Allocation list */}
        <div className="lg:col-span-4 rounded-2xl border border-line bg-surface p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-accent-soft" />
              <h3 className="font-display text-sm font-bold text-ink">Category Allocation</h3>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {categories.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-semibold text-ink-soft">{cat.name}</span>
                  <span className="font-mono font-bold text-ink-soft">{cat.value} items</span>
                </div>
                {/* Custom ProgressBar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.value / (totalCompleted + totalPending || 1)) * 100}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center h-full">
                <span className="text-ink-faint text-xs">No categorised notes found</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
