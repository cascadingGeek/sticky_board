import { useEffect, useRef, useState } from 'react';

/** How long the message after a move stays. */
export const MOVED_MESSAGE_MS = 6000;

export interface Notice {
  key: number;
  x: number;
  y: number;
  /** Set for a move that can be undone; absent for a plain notice. */
  undo?: { pageId: string; boardId: string };
  text: string;
}

interface MovedMessageProps {
  notice: Notice;
  /** Resolves to an error text, or null when Undo worked. */
  onUndo: (undo: NonNullable<Notice['undo']>) => Promise<string | null>;
  onDone: () => void;
}

/** "Moved to today's board" with Undo, where the note was. */
export function MovedMessage({ notice, onUndo, onDone }: MovedMessageProps) {
  const [text, setText] = useState(notice.text);
  const [undoing, setUndoing] = useState(false);
  const [canUndo, setCanUndo] = useState(!!notice.undo);
  const undoRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  // Each message clears itself after MOVED_MESSAGE_MS. The clock stops while Undo runs,
  // so a slow answer is still seen, and an Undo error gets a fresh MOVED_MESSAGE_MS.
  useEffect(() => {
    if (undoing) return;
    const t = setTimeout(() => doneRef.current(), MOVED_MESSAGE_MS);
    return () => clearTimeout(t);
  }, [undoing]);

  // Focus goes to Undo, since the button you pressed is gone.
  useEffect(() => {
    undoRef.current?.focus({ preventScroll: true });
  }, []);

  const undo = async () => {
    if (!notice.undo || undoing) return;
    setUndoing(true);
    const error = await onUndo(notice.undo);
    if (error === null) {
      doneRef.current();
      return;
    }
    setUndoing(false);
    setCanUndo(false);
    setText(error);
  };

  return (
    <div className="sb-moved" style={{ left: notice.x, top: notice.y }} role="status">
      {/* Undo comes first: it sits in the moved note's own corner, clear of the next note's buttons. */}
      {canUndo && (
        <button ref={undoRef} type="button" className="sb-btn" disabled={undoing} onClick={() => void undo()}>
          Undo
        </button>
      )}
      <span>{undoing ? 'Undoing…' : text}</span>
    </div>
  );
}
