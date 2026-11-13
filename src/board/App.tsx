import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Pin } from '../shared/ui/Pin';
import { StickyBoardProvider, useStickyBoard } from './StickyBoardContext';
import { offsetDateStr } from '../shared/dates';
import { Board } from './components/Board';
import { CalendarDrawer } from './components/CalendarDrawer';
import { NoteEditor } from './components/NoteEditor';
import { PagesDrawer } from './components/PagesDrawer';
import { SearchBox } from './components/SearchBox';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { TrashDrawer } from './components/TrashDrawer';
import { WelcomeScreen } from './components/WelcomeScreen';

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
};

function AppContent() {
  const {
    loaded,
    loadFailed,
    meta,
    notes,
    drawer,
    openDrawer,
    searchOpen,
    setSearchOpen,
    editorId,
    setEditorId,
    currentDateStr,
    setCurrentDateStr,
    today,
    requestNewNote,
  } = useStickyBoard();

  const editing = editorId ? notes.find(n => n.id === editorId && !n.deletedAt) : undefined;
  const { toast } = useStickyBoard();

  // The note being edited was removed elsewhere: close the editor.
  useEffect(() => {
    if (editorId && loaded && !editing) {
      setEditorId(null);
      toast('This note was removed.');
    }
  }, [editorId, editing, loaded, setEditorId, toast]);

  // Global keys. Esc closes the topmost thing: editor, then search, then a drawer
  // (confirm boxes and drafts handle their own Esc first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
        return;
      }
      if (e.key === 'Escape') {
        // The editor handles its own Esc, so it can save first.
        if (editorId) return;
        if (searchOpen) setSearchOpen(false);
        else if (drawer) openDrawer(null);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || editorId || drawer) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setSearchOpen(false);
        requestNewNote();
      } else if (e.key === 't' || e.key === 'T') {
        setCurrentDateStr(today);
      } else if (e.key === 'ArrowLeft') {
        setCurrentDateStr(offsetDateStr(currentDateStr, -1));
      } else if (e.key === 'ArrowRight') {
        setCurrentDateStr(offsetDateStr(currentDateStr, 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, setSearchOpen, editorId, setEditorId, drawer, openDrawer, currentDateStr, setCurrentDateStr, today, requestNewNote]);

  if (!loaded) return <LoadingBoard />;
  if (loadFailed) return <BoardLoadError />;
  if (!meta.onboardedAt) return <WelcomeScreen />;

  const overlayOpen = !!drawer || !!editing;

  return (
    <div className="board-surface min-h-screen text-ink">
      <div inert={overlayOpen}>
        <TopBar />
      </div>
      <Board inert={overlayOpen} />
      {searchOpen && <SearchBox />}
      {drawer === 'calendar' && <CalendarDrawer />}
      {drawer === 'pages' && <PagesDrawer />}
      {drawer === 'trash' && <TrashDrawer />}
      {drawer === 'settings' && <SettingsDrawer />}
      {editing && <NoteEditor key={editing.id} note={editing} />}
      <Toasts />
    </div>
  );
}

const GHOSTS = [
  { left: 110, top: 130, r: -2 },
  { left: 420, top: 112, r: 1.5 },
  { left: 735, top: 150, r: -1 },
  { left: 210, top: 480, r: 1 },
  { left: 540, top: 505, r: -2.5 },
];

/** First load: faint paper ghosts and a "Loading your board" pill. */
function LoadingBoard() {
  return (
    <div className="board-surface relative min-h-screen overflow-hidden text-ink" aria-busy="true">
      <div aria-hidden="true">
        {GHOSTS.map((g, i) => (
          <div
            key={i}
            className="absolute h-[220px] w-[220px] border border-line bg-ghost"
            style={{ left: g.left, top: g.top + 64, transform: `rotate(${g.r}deg)` }}
          />
        ))}
      </div>
      <p
        role="status"
        className="absolute top-1/2 left-1/2 m-0 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-panel px-[22px] py-3.5 text-[15px] font-medium shadow-pop"
      >
        <Loader2 size={18} className="animate-spin text-ink-faint" aria-hidden="true" />
        Loading your board
      </p>
    </div>
  );
}

/** The first load failed. Notes are still in storage; a reload tries again. */
function BoardLoadError() {
  return (
    <div className="board-surface relative min-h-screen text-ink">
      <main role="alert" className="absolute top-1/2 left-1/2 flex w-[min(360px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 text-center">
        <div aria-hidden="true" className="paper-note paper-cream relative h-24 w-24 -rotate-6">
          <div className="paper" />
          <Pin color="red" style={{ left: 'auto', right: 4, top: 6, transform: 'rotate(30deg)' }} />
        </div>
        <div className="board-backing flex flex-col items-center gap-3 px-4 py-2">
          <h1 className="m-0 mt-1.5 font-hand text-[32px] leading-none font-normal">Couldn't load your notes.</h1>
          <p className="m-0 text-sm leading-normal text-ink-faint">Try reopening the tab. Your notes are still saved in this browser.</p>
        </div>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-1 h-11 rounded-xl bg-accent px-[18px] text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Reload board
        </button>
      </main>
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
