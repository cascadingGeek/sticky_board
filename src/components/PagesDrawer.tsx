import { useMemo } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { openPage, siteOf } from '../lib/pageNotes';
import type { Note } from '../types';
import { Drawer } from './Drawer';

/** Page notes grouped by site, newest first by when they were created (spec 0002, AC-11). */
export function PagesDrawer() {
  const { allNotes, trashNote, openDrawer } = useStickyBoard();

  const groups = useMemo(() => {
    const list = allNotes.filter(n => n.page && isActive(n)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const bySite = new Map<string, Note[]>();
    for (const n of list) {
      const site = siteOf(n.page!.url);
      bySite.set(site, [...(bySite.get(site) ?? []), n]);
    }
    return [...bySite.entries()];
  }, [allNotes]);

  return (
    <Drawer title="Pages" onClose={() => openDrawer(null)}>
      <p className="text-[13px] leading-relaxed text-ink-faint">
        Notes you pinned on web pages. Right click a page and choose “Pin a note here”, or press{' '}
        <kbd className="rounded-md bg-raise px-1.5 py-0.5 font-mono text-xs text-ink">Alt+Shift+N</kbd>.
      </p>

      {groups.length === 0 ? (
        <p className="mt-16 text-center font-hand text-2xl text-ink-faint">No page notes yet</p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {groups.map(([site, list]) => (
            <section key={site} aria-label={site} className="flex flex-col gap-2">
              <h3 className="flex items-baseline justify-between text-xs font-semibold tracking-[0.06em] text-ink-faint uppercase">
                <span className="truncate normal-case tracking-normal text-[13px] text-ink-soft">{site}</span>
                <span className="font-normal normal-case tracking-normal">
                  {list.length} {list.length === 1 ? 'note' : 'notes'}
                </span>
              </h3>
              <ul className="flex flex-col gap-2">
                {list.map(n => (
                  <li key={n.id} className="flex items-start gap-2 rounded-[14px] border border-line bg-raise p-2">
                    <button
                      type="button"
                      onClick={() => openPage(n)}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-[10px] p-1.5 text-left hover:bg-raise"
                      aria-label={`Open ${n.title} on ${site}`}
                    >
                      <span aria-hidden="true" className={`paper-${n.noteColor} mt-0.5 h-6 w-6 flex-none -rotate-3 rounded`} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{n.title}</span>
                        <span className="truncate text-xs text-ink-faint">{n.page!.title || n.page!.url}</span>
                      </span>
                      <ExternalLink size={14} className="mt-1 flex-none text-ink-faint" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${n.title} to Trash`}
                      title="Move to Trash"
                      onClick={() => void trashNote(n.id)}
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-ink-faint hover:bg-raise-strong hover:text-ink"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}
