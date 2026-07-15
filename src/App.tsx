import { useState } from 'react';
import { StickyBoardProvider, useStickyBoard } from './lib/StickyBoardContext';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { DailyBoard } from './components/DailyBoard';
import { CalendarView } from './components/CalendarView';
import { AnalyticsView } from './components/AnalyticsView';
import { FocusView } from './components/FocusView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import { CommandPalette } from './components/CommandPalette';

function AppContent() {
  const { user, activeTab, isLoading } = useStickyBoard();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app text-ink">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <span className="font-display text-xs font-semibold tracking-wider text-ink-faint uppercase">Loading board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app text-ink font-sans">
      {!user ? (
        // If not logged in, show the gorgeous immersive landing page
        <LandingPage onStartAuth={() => setIsAuthOpen(true)} />
      ) : (
        // Full dashboard layout
        <div className="flex">
          {/* Sidebar Navigation */}
          <Sidebar />

          {/* Main Workspace Frame */}
          <main className="flex-1 min-h-screen bg-app relative">
            {/* Direct dynamic layout loading */}
            {activeTab === 'board' && <DailyBoard />}
            {activeTab === 'calendar' && <CalendarView />}
            {activeTab === 'analytics' && <AnalyticsView />}
            {activeTab === 'focus' && <FocusView />}
            {activeTab === 'settings' && <SettingsView />}
          </main>
        </div>
      )}

      {/* Floating Auth Modal overlay */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      {/* ⌘K command palette + global keyboard shortcuts (signed-in only) */}
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <StickyBoardProvider>
      <AppContent />
    </StickyBoardProvider>
  );
}

