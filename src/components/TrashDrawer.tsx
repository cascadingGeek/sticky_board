import { useMemo, useState } from 'react';
import { Globe, Trash2 } from 'lucide-react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { shortDay } from '../lib/dates';
import { siteOf } from '../lib/pageNotes';
import { TRASH_DAYS } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { Drawer } from './Drawer';

const DAY = 24 * 60 * 60 * 1000;

/** Trashed notes, newest deleted first, with Restore and Delete forever. */
export function TrashDrawer() {
  const { allNotes, restoreNote, deleteForever, openDrawer } = useStickyBoard();
  const [confirm, setConfirm] = useState<{ ids: string[]; title: string; message: string; label: string } | null>(null);
  const [now] = useState(() => Date.now());

  const trashed = useMemo(
    () => allNotes.filter(n => n.deletedAt).sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1)),
    [allNotes],
  );

  const countLabel = `${trashed.length} ${trashed.length === 1 ? 'note' : 'notes'}`;

  return (
    <Drawer
      title="Trash"
      subtitle={trashed.length ? countLabel : undefined}
      onClose={() => openDrawer(null)}
      footer={
        trashed.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              setConfirm({
                ids: trashed.map(n => n.id),
                title: 'Empty trash?',
                message: `This deletes ${countLabel} for good. You can't undo it.`,
                label: 'Empty trash',
              })
            }
            className="h-11 w-full rounded-[10px] border border-danger-line text-sm font-semibold text-danger hover:bg-hover"
          >
            Empty trash
          </button>
        ) : undefined
      }
    >
      {trashed.length === 0 ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <Trash2 size={64} strokeWidth={1.2} aria-hidden="true" className="text-line-strong" />
          <p className="m-0 font-hand text-[30px] leading-none text-ink">Trash is empty</p>
          <p className="m-0 text-sm leading-relaxed text-ink-faint">Deleted notes stay here for 30 days, then they're gone for good.</p>
        </div>
      ) : (
        <>
          <p className="m-0 rounded-[12px] bg-raise-strong px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
            Deleted notes stay here for 30 days, then they're gone for good.
          </p>
          <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
            {trashed.map(n => {
              const left = Math.max(0, TRASH_DAYS - Math.floor((now - Date.parse(n.deletedAt!)) / DAY));
              const soon = left <= 1;
              return (
                <li key={n.id} className="flex items-center gap-3 rounded-[12px] bg-raise px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                  <span
                    aria-hidden="true"
                    className={`paper-${n.noteColor} paper-swatch h-[38px] w-[38px] flex-none -rotate-3 shadow-[-1px_2px_3px_rgba(0,0,0,0.2)]`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-hand note-row-title break-words text-ink">{n.title}</span>
                    <span className={`flex flex-wrap items-center gap-x-1 text-xs ${soon ? 'font-semibold text-danger' : 'text-ink-faint'}`}>
                      {n.page && <Globe size={12} aria-hidden="true" className="flex-none" />}
                      <span className="break-all">{n.page ? `On ${siteOf(n.page.url)}` : `From ${shortDay(n.dateStr)}`}</span>
                      <span className="whitespace-nowrap">· {left <= 1 ? 'gone tomorrow' : `${left} days left`}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void restoreNote(n.id)}
                    className="h-9 flex-none rounded-[9px] bg-raise-strong px-3 text-[13px] font-semibold text-ink hover:bg-line-strong"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${n.title} forever`}
                    title="Delete forever"
                    onClick={() =>
                      setConfirm({
                        ids: [n.id],
                        title: 'Delete forever?',
                        message: `“${n.title}” will be deleted for good. You can't undo it.`,
                        label: 'Delete forever',
                      })
                    }
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-danger hover:bg-hover"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            void deleteForever(confirm.ids);
            setConfirm(null);
          }}
        />
      )}
    </Drawer>
  );
}
