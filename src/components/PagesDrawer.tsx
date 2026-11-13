import { useMemo } from 'react';
import { CalendarArrowDown, ExternalLink, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { isActive } from '../lib/board';
import { hostnameOf } from '../lib/pageAccess';
import { openPage, siteOf } from '../lib/pageNotes';
import { useSiteAccess } from '../lib/useSiteAccess';
import type { Note } from '../types';
import { Drawer } from './Drawer';
import { Pin } from './Pin';
import { SiteBadge } from './SiteBadge';

const kbd = 'rounded-md bg-kbd px-1.5 py-0.5 font-mono text-xs font-semibold text-ink';

/** Page notes grouped by site, newest first by when they were created. */
export function PagesDrawer() {
  const { allNotes, trashNote, moveToBoard, openDrawer } = useStickyBoard();
  const { access } = useSiteAccess();

  const { groups, total } = useMemo(() => {
    const list = allNotes.filter(n => n.page && isActive(n)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const bySite = new Map<string, Note[]>();
    for (const n of list) {
      const site = siteOf(n.page!.url);
      bySite.set(site, [...(bySite.get(site) ?? []), n]);
    }
    return { groups: [...bySite.entries()], total: list.length };
  }, [allNotes]);

  const showsByItself = (list: Note[]) =>
    !!access && (access.allSites.length > 0 || list.some(n => access.hosts.includes(hostnameOf(n.page!.url))));

  return (
    <Drawer title="Pages" subtitle={`Notes you pinned on websites${total ? ` · ${total}` : ''}`} onClose={() => openDrawer(null)}>
      {groups.length === 0 ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-1 text-center">
          <div aria-hidden="true" className="relative mb-3 h-[112px] w-[152px] rounded-[10px] border border-line-strong bg-raise">
            <span className="absolute top-2 left-2.5 flex gap-1">
              <i className="h-1 w-1 rounded-full bg-line-strong" />
              <i className="h-1 w-1 rounded-full bg-line-strong" />
              <i className="h-1 w-1 rounded-full bg-line-strong" />
            </span>
            <i className="absolute top-8 left-3 h-1.5 w-[100px] rounded-full bg-raise-strong" />
            <i className="absolute top-12 left-3 h-1.5 w-[76px] rounded-full bg-raise-strong" />
            <i className="absolute top-16 left-3 h-1.5 w-[90px] rounded-full bg-raise-strong" />
            <span className="paper-note paper-yellow absolute -right-4 bottom-4 h-[60px] w-[60px] rotate-3">
              <span className="paper">
                <Pin color="red" style={{ top: 6, left: '62%', transform: 'scale(0.75)' }} />
              </span>
            </span>
          </div>
          <p className="m-0 font-hand text-[30px] leading-none text-ink">No page notes yet</p>
          <p className="m-0 text-sm leading-relaxed text-ink-faint">Pin a note on any website and it waits for you there next time.</p>
          <ol className="m-0 mt-4 flex w-full list-none flex-col gap-3.5 rounded-[14px] bg-raise p-4 text-left text-sm leading-relaxed text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                1
              </span>
              <span>
                Right click on any website and choose <strong>Pin a note here</strong>, or press <kbd className={kbd}>Alt+Shift+N</kbd>.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
                2
              </span>
              <span>
                Click <strong>Allow</strong> on the note so it shows up every time you come back.
              </span>
            </li>
          </ol>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            {groups.map(([site, list]) => {
              const auto = showsByItself(list);
              return (
                <section key={site} aria-label={site} className="flex flex-col gap-1">
                  <h3 className="m-0 flex items-center gap-2.5 px-1 pb-1.5 text-[15px] font-semibold">
                    <SiteBadge site={site} />
                    <span className="min-w-0 flex-1 truncate">{site}</span>
                    {access && (
                      <span
                        className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          auto ? 'bg-ok-wash text-ok-ink' : 'bg-raise-strong text-ink-soft'
                        }`}
                      >
                        {auto ? 'Shows automatically' : 'On request'}
                      </span>
                    )}
                  </h3>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {list.map(n => (
                      <li key={n.id} className="group flex items-center gap-1 rounded-[12px] hover:bg-raise hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                        <button
                          type="button"
                          onClick={() => openPage(n)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] py-2 pl-1.5 text-left"
                          aria-label={`Open ${n.title} on ${site}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`paper-${n.noteColor} paper-swatch h-[34px] w-[34px] flex-none -rotate-3 shadow-[-1px_2px_3px_rgba(0,0,0,0.2)]`}
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="font-hand note-row-title truncate text-ink">{n.title}</span>
                            <span className="truncate text-xs text-ink-faint">{n.page!.title || n.page!.url}</span>
                          </span>
                          <ExternalLink size={15} aria-hidden="true" className="flex-none text-ink-faint opacity-0 group-hover:opacity-100" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${n.title} to today's board`}
                          title="Move to today's board"
                          onClick={() => void moveToBoard(n.id)}
                          className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink-faint hover:bg-hover hover:text-ink"
                        >
                          <CalendarArrowDown size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${n.title} to Trash`}
                          title="Move to Trash"
                          onClick={() => void trashNote(n.id)}
                          className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-ink-faint hover:bg-hover hover:text-ink"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <p className="mt-6 mb-0 px-1 text-[13px] leading-relaxed text-ink-faint">
            Click a note to open its page in a new tab. Right click any website and choose Pin a note here, or press{' '}
            <kbd className={kbd}>Alt+Shift+N</kbd>.
          </p>
        </>
      )}
    </Drawer>
  );
}
