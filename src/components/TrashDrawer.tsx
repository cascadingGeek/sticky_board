import { useMemo, useState } from 'react';
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

  return (
    <Drawer
      title="Trash"
      onClose={() => openDrawer(null)}
      footer={
        trashed.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              setConfirm({
                ids: trashed.map(n => n.id),
                title: 'Empty trash?',
                message: `This deletes ${trashed.length} ${trashed.length === 1 ? 'note' : 'notes'} for good. You can't undo it.`,
                label: 'Empty trash',
              })
            }
            className="h-11 w-full rounded-[10px] border border-danger-line text-sm font-medium text-danger hover:bg-raise"
          >
            Empty trash
          </button>
        ) : undefined
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-faint">Deleted notes stay here for 30 days, then they're gone for good.</p>

      {trashed.length === 0 ? (
        <p className="mt-16 text-center font-hand text-2xl text-ink-faint">Trash is empty</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {trashed.map(n => {
            const left = Math.max(0, TRASH_DAYS - Math.floor((now - Date.parse(n.deletedAt!)) / DAY));
            const soon = left <= 3;
            return (
              <li key={n.id} className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-raise p-3.5">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className={`paper-${n.noteColor} h-7 w-7 flex-none -rotate-3 rounded`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{n.title}</span>
                    <span className="truncate text-xs text-ink-faint">{n.page ? `On ${siteOf(n.page.url)}` : `From ${shortDay(n.dateStr)}`}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                      soon ? 'bg-warn-wash text-warn-ink' : 'bg-raise-strong text-ink-soft'
                    }`}
                  >
                    {left === 1 ? '1 day left' : `${left} days left`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void restoreNote(n.id)} className="h-9 rounded-[9px] border border-line-strong px-3.5 text-[13px] font-medium hover:bg-raise">
                    Restore
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${n.title} forever`}
                    onClick={() =>
                      setConfirm({
                        ids: [n.id],
                        title: 'Delete forever?',
                        message: `“${n.title}” will be gone for good. You can't undo it.`,
                        label: 'Delete forever',
                      })
                    }
                    className="h-9 px-2.5 text-[13px] text-danger hover:underline"
                  >
                    Delete forever
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
