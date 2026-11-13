import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Pin } from '../shared/ui/Pin';
import { NOTE_SIZE, TITLE_MAX, type NoteColor } from '../shared/types';

export interface PageDraftState {
  key: number;
  x: number;
  y: number;
  color: NoteColor;
  title: string;
  saving: boolean;
  error?: string;
}

interface PageDraftProps {
  draft: PageDraftState;
  onChange: (title: string) => void;
  onCommit: () => void;
  onDiscard: () => void;
}

/**
 * A blank note that exists only on the page until it has a title.
 * Enter or clicking away saves; an empty title or Esc discards it.
 */
export function PageDraft({ draft, onChange, onCommit, onDiscard }: PageDraftProps) {
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [draft.key]);

  return (
    <section
      ref={rootRef}
      className={`sb-note sb-new sb-lifted paper-note paper-${draft.color}`}
      aria-label="New sticky note"
      style={{ left: draft.x, top: draft.y, width: NOTE_SIZE, height: NOTE_SIZE, zIndex: 99999, transform: 'translateY(-4px)' }}
      // Pressing on the paper keeps focus in the title, so it doesn't count as clicking away.
      onMouseDown={e => {
        if (e.target !== inputRef.current) e.preventDefault();
      }}
      onBlur={e => {
        if (rootRef.current?.contains(e.relatedTarget as Node | null)) return;
        // Wait a tick: if a site grabbed focus while you typed, the content script hands it back and the draft stays.
        setTimeout(() => {
          const root = rootRef.current;
          if (!root) return;
          const active = (root.getRootNode() as Document | ShadowRoot).activeElement;
          if (!root.contains(active)) onCommit();
        });
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') onDiscard();
      }}
    >
      <div className="paper">
        <Pin noteId={`page-draft-${draft.key}`} />
        <div className="sb-bar" style={{ cursor: 'default' }}>
          <span className="sb-grip" aria-hidden="true" />
          <button type="button" className="sb-icon" aria-label="Discard new note" title="Discard" onMouseDown={e => e.preventDefault()} onClick={onDiscard}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="sb-body" style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="sb-sr" htmlFor={`sb-draft-${draft.key}`}>
            New note title
          </label>
          <input
            id={`sb-draft-${draft.key}`}
            ref={inputRef}
            className="sb-field sb-title sb-draft-title"
            placeholder="Write a title…"
            value={draft.title}
            maxLength={TITLE_MAX}
            disabled={draft.saving}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommit();
              }
            }}
          />
          {!draft.error && <span className="sb-hint">Enter to save · Esc to discard</span>}
        </div>
        {draft.error && (
          <p className="sb-strip sb-error" role="alert">
            <span>{draft.error}</span>
            <button type="button" className="sb-btn" onMouseDown={e => e.preventDefault()} onClick={onDiscard}>
              Discard
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
