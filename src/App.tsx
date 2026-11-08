import { useEffect } from 'react';
import { StickyBoardProvider, useStickyBoard } from './lib/StickyBoardContext';
import { offsetDateStr } from './lib/dates';
import { Board } from './components/Board';
import { CalendarDrawer } from './components/CalendarDrawer';
import { NoteEditor } from './components/NoteEditor';
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
        if (editorId) setEditorId(null);
        else if (searchOpen) setSearchOpen(false);
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

  if (!loaded) {
    return (
      <div className="board-surface min-h-screen" aria-busy="true">
        <p role="status" className="sr-only">
          Loading your board
        </p>
      </div>
    );
  }
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
      {drawer === 'trash' && <TrashDrawer />}
      {drawer === 'settings' && <SettingsDrawer />}
      {editing && <NoteEditor key={editing.id} note={editing} />}
      <Toasts />
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
