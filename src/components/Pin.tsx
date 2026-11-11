import type { CSSProperties } from 'react';
import { pinFor, type PinColor } from '../lib/board';

interface PinProps {
  /** The note this pin holds: its colour comes from the id, so it is the same everywhere (spec 0003, AC-5). */
  noteId?: string;
  /** A fixed colour, for decoration with no note behind it. */
  color?: PinColor;
  large?: boolean;
  style?: CSSProperties;
}

/** The modelled pushpin from src/styles/paper.css. */
export function Pin({ noteId, color, large = false, style }: PinProps) {
  const c = color ?? pinFor(noteId ?? '');
  return (
    <span aria-hidden="true" className={`pin pin-${c} ${large ? 'pin-large' : ''}`} style={style}>
      <i className="pin-shadow" />
      <i className="pin-collar" />
      <i className="pin-body" />
      <i className="pin-head" />
    </span>
  );
}
