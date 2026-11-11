import { useEffect, useRef } from 'react';
import { DESCRIPTION_MAX, NOTE_SIZE, TITLE_MAX, type NoteColor } from '../types';
import { Pin } from './Pin';

export interface Draft {
  key: number;
  x: number;
  y: number;
  dateStr: string;
  color: NoteColor;
  title: string;
  description: string;
  saving: boolean;
}

interface DraftNoteProps {
  draft: Draft;
  onChange: (fields: Partial<Draft>) => void;
  onCommit: () => void;
  onDiscard: () => void;
  focusSignal: number;
}

/**
 * A blank note that exists only on screen until saved. Enter or leaving it
 * saves when the title has text; Esc or an empty title discards it.
 */
export function DraftNote({ draft, onChange, onCommit, onDiscard, focusSignal }: DraftNoteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [focusSignal]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="New note"
      className="absolute animate-pin-drop"
      style={{ left: draft.x, top: draft.y, width: NOTE_SIZE, zIndex: 9000 }}
      onBlur={e => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) onCommit();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDiscard();
        }
      }}
    >
      <div className={`paper-note paper-lifted paper-${draft.color} relative`} style={{ width: NOTE_SIZE, height: NOTE_SIZE, transform: 'translateY(-4px)' }}>
        <div className="paper focus-ring flex flex-col gap-1 px-[18px] pt-11 pb-4">
          <Pin noteId={`draft-${draft.key}`} />
          <label htmlFor={`draft-${draft.key}`} className="sr-only">
            New note title
          </label>
          <input
            id={`draft-${draft.key}`}
            ref={titleRef}
            type="text"
            value={draft.title}
            maxLength={TITLE_MAX}
            placeholder="Write a title…"
            disabled={draft.saving}
            onChange={e => onChange({ title: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                detailsRef.current?.focus();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                onCommit();
              }
            }}
            className="note-title w-full border-0 bg-transparent p-0 text-[var(--paper-ink)] outline-none placeholder:text-[var(--paper-ink)] placeholder:opacity-45 focus-visible:outline-none"
          />
          <label htmlFor={`draft-details-${draft.key}`} className="sr-only">
            Details
          </label>
          <textarea
            id={`draft-details-${draft.key}`}
            ref={detailsRef}
            value={draft.description}
            maxLength={DESCRIPTION_MAX}
            placeholder="Details…"
            disabled={draft.saving}
            onChange={e => onChange({ description: e.target.value })}
            className="note-text min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[var(--paper-ink)] outline-none placeholder:text-[var(--paper-ink)] placeholder:opacity-45 focus-visible:outline-none"
          />
          <p className="m-0 text-[11px] font-medium text-[var(--paper-ink)] opacity-75">Enter to save · Esc to discard</p>
        </div>
      </div>
      <p className="mt-7 -ml-5 flex w-max items-center gap-2 rounded-full bg-toast px-3 py-[7px] text-xs text-toast-ink shadow-toast">
        <span aria-hidden="true" className={`paper-${draft.color} paper-swatch h-[7px] w-[7px] rounded-full`} />
        Lands in the first free spot · drag it anywhere
      </p>
    </div>
  );
}
