import React from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { ClipboardList, Calendar, BarChart3, Timer, Settings, LogOut, Flame, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const Sidebar: React.FC = () => {
  const { user, activeTab, setActiveTab, logout, stats } = useStickyBoard();

  if (!user) return null;

  const menuItems = [
    { id: 'board', label: 'My Board', icon: ClipboardList },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'focus', label: 'Focus Mode', icon: Timer },
    { id: 'settings', label: 'Settings', icon: Settings }
  ] as const;

  // Calculate quick stats for display
  const completionRate = stats?.completionRate ?? 0;
  const currentStreak = stats?.streak?.currentStreak ?? 0;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed top-0 bottom-0 left-0 z-30 flex w-64 flex-col sidebar-glass p-6">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-display text-sm font-bold tracking-tight text-ink">StickyBoard</span>
            <span className="block text-[9px] font-semibold tracking-wider text-accent-soft uppercase">Daily Planner</span>
          </div>
        </div>

        {/* Profile summary with Streak Flame */}
        <div className="mt-8 flex items-center justify-between rounded-xl bg-raise-faint border border-line p-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent-soft font-bold text-xs uppercase flex-shrink-0">
              {user.name.substring(0, 2)}
            </div>
            <div className="min-w-0">
              <span className="block font-medium text-xs text-ink truncate">{user.name}</span>
              <span className="block text-[10px] text-ink-faint truncate">{user.email}</span>
            </div>
          </div>

          {/* Streak indicator */}
          {currentStreak > 0 && (
            <div className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-500">
              <Flame className="h-3.5 w-3.5 fill-amber-500" />
              <span className="font-mono text-xs font-bold">{currentStreak}</span>
            </div>
          )}
        </div>

        {/* Navigation menu */}
        <nav className="mt-8 flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium outline-none transition-all ${
                  isActive 
                    ? 'text-ink font-semibold' 
                    : 'text-ink-soft hover:bg-raise-faint hover:text-ink'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-raise border-l-2 border-accent"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={`relative z-10 h-4 w-4 transition-transform group-hover:scale-105 ${
                  isActive ? 'text-accent-soft' : 'text-ink-faint group-hover:text-ink-soft'
                }`} />
                <span className="relative z-10 font-display">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Progress Ring Widget */}
        <div className="mt-auto border-t border-line pt-6">
          <div className="rounded-xl bg-raise-faint border border-line p-4 flex flex-col items-center">
            <div className="relative flex items-center justify-center h-20 w-20">
              {/* SVG Progress Circle */}
              <svg className="absolute transform -rotate-90 w-full h-full">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-muted-strong"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-accent transition-all duration-500"
                  strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - completionRate / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-mono text-sm font-extrabold text-ink">{completionRate}%</span>
            </div>
            <span className="mt-3 block font-display text-xs font-semibold text-ink-soft uppercase tracking-wider">Today's Focus</span>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="mt-6 flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-ink-faint hover:bg-muted-strong hover:text-ink-soft transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Exit Workspace</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 border-t border-line-strong px-4 py-2 pb-5 flex justify-around items-center backdrop-blur-md shadow-lg">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center gap-1 text-ink-soft hover:text-ink relative px-2 py-1 min-w-14"
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-accent-soft' : 'text-ink-faint'}`} />
              <span className={`text-[9px] font-medium tracking-tight ${isActive ? 'text-ink font-semibold' : 'text-ink-soft'}`}>
                {item.label === 'Focus Mode' ? 'Focus' : item.label === 'My Board' ? 'Board' : item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute -bottom-1 h-1 w-5 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
