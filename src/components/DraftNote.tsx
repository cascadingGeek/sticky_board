import { useEffect, useRef, useState } from 'react';
import { NOTE_SIZE, TITLE_MAX, type NoteColor } from '../types';

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
  const [showDetails, setShowDetails] = useState(draft.description.length > 0);

  useEffect(() => {
    titleRef.current?.focus();
  }, [focusSignal]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="New note"
      className={`paper-${draft.color} absolute rounded-[4px] animate-pin-drop`}
      style={{
        left: draft.x,
        top: draft.y,
        width: NOTE_SIZE,
        height: NOTE_SIZE,
        zIndex: 9000,
        boxShadow: 'var(--note-shadow-lift), 0 0 0 2px rgba(255,255,255,0.4)',
        transform: 'rotate(-1deg)',
      }}
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
      <span
        aria-hidden="true"
        className="absolute top-2 left-1/2 -ml-[7px] h-3.5 w-3.5 rounded-full"
        style={{ background: 'var(--pin)' }}
      />
      <div className="absolute inset-x-0 top-7 bottom-0 flex flex-col px-4 pb-3">
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
              setShowDetails(true);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              onCommit();
            }
          }}
          className="font-hand w-full border-0 bg-transparent p-0 text-[28px] font-bold outline-none placeholder:text-current placeholder:opacity-50"
        />
        {showDetails && (
          <>
            <label htmlFor={`draft-details-${draft.key}`} className="sr-only">
              Details
            </label>
            <textarea
              id={`draft-details-${draft.key}`}
              autoFocus
              value={draft.description}
              maxLength={5000}
              placeholder="Details…"
              onChange={e => onChange({ description: e.target.value })}
              className="mt-1 min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[13px] leading-snug outline-none placeholder:text-current placeholder:opacity-50"
            />
          </>
        )}
        <span className="mt-auto pt-1 text-[11px] font-semibold opacity-80">
          Enter to pin · Shift+Enter for details · Esc to cancel
        </span>
      </div>
    </div>
  );
}
